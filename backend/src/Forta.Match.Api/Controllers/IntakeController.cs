using Forta.Match.Api.Data;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Models;
using Forta.Match.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forta.Match.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IntakeController : ControllerBase
{
    private readonly FortaDbContext _db;
    private readonly CompletenessService _completeness;
    private readonly DocumentTextExtractor _documentText;
    private readonly IWebHostEnvironment _env;

    public IntakeController(
        FortaDbContext db,
        CompletenessService completeness,
        DocumentTextExtractor documentText,
        IWebHostEnvironment env)
    {
        _db = db;
        _completeness = completeness;
        _documentText = documentText;
        _env = env;
    }

    [HttpPost("upload")]
    [RequestSizeLimit(20_000_000)]
    public async Task<ActionResult<UploadResult>> Upload(IFormFile file, [FromForm] Guid? referralId, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        var uploadsDir = Path.Combine(_env.ContentRootPath, "uploads");
        Directory.CreateDirectory(uploadsDir);

        var safeName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
        var filePath = Path.Combine(uploadsDir, safeName);

        await using (var stream = new FileStream(filePath, FileMode.Create))
            await file.CopyToAsync(stream, ct);

        string? extractedText = null;
        var text = await _documentText.ExtractFromFileAsync(filePath, ct);
        if (DocumentTextExtractor.LooksReadable(text))
            extractedText = text;

        Referral referral;
        if (referralId.HasValue)
        {
            referral = await _db.Referrals.FindAsync(new object[] { referralId.Value }, ct)
                         ?? throw new InvalidOperationException("Referral not found");
            referral.UploadedFileName = file.FileName;
            referral.UploadedFilePath = safeName;
            if (extractedText != null)
                referral.LetterText = extractedText;
            referral.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            var patient = new Patient { Name = "Pending", Bsn = "", ContactDetails = "" };
            referral = new Referral
            {
                Patient = patient,
                UploadedFileName = file.FileName,
                UploadedFilePath = safeName,
                LetterText = extractedText,
                Status = ReferralStatus.Draft
            };
            _db.Referrals.Add(referral);
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new UploadResult(referral.Id, file.FileName, "File uploaded successfully"));
    }

    [HttpPost("register")]
    public async Task<ActionResult<ReferralDetailDto>> Register([FromBody] RegisterReferralRequest request, CancellationToken ct)
    {
        Referral referral;
        Patient patient;

        if (request.ReferralId.HasValue)
        {
            referral = await _db.Referrals.Include(r => r.Patient)
                .FirstOrDefaultAsync(r => r.Id == request.ReferralId, ct)
                ?? throw new InvalidOperationException("Referral not found");
            patient = referral.Patient;
        }
        else
        {
            patient = new Patient();
            referral = new Referral { Patient = patient };
            _db.Referrals.Add(referral);
        }

        patient.Name = request.Name;
        patient.Bsn = request.Bsn;
        patient.ContactDetails = request.ContactDetails;
        patient.Email = request.Email;
        patient.Phone = request.Phone;

        referral.ReferrerAgb = string.IsNullOrWhiteSpace(request.ReferrerAgb)
            ? null
            : request.ReferrerAgb.Trim();
        referral.ReferralDate = request.ReferralDate;
        referral.HasSignature = request.HasSignature;
        referral.ProbableDsm = request.ProbableDsm;
        referral.Complaint = request.Complaint;
        referral.Location = request.Location;
        referral.Insurer = request.Insurer;
        referral.LetterText = request.LetterText;
        referral.UpdatedAt = DateTime.UtcNow;

        var (isComplete, missing) = _completeness.Validate(referral, patient);
        referral.Status = isComplete ? ReferralStatus.Complete : ReferralStatus.Incomplete;

        await _db.SaveChangesAsync(ct);

        var svc = HttpContext.RequestServices.GetRequiredService<ReferralService>();
        return Ok(svc.ToDetailDto(await _db.Referrals.Include(r => r.Patient).Include(r => r.Extraction).Include(r => r.Decisions)
            .FirstAsync(r => r.Id == referral.Id, ct)));
    }

    [HttpPost("{referralId:guid}/prescan")]
    public async Task<ActionResult<PrescanResult>> Prescan(Guid referralId, CancellationToken ct)
    {
        var referral = await _db.Referrals.Include(r => r.Patient)
            .FirstOrDefaultAsync(r => r.Id == referralId, ct);
        if (referral == null) return NotFound();

        var fileText = DocumentTextExtractor.LooksReadable(referral.LetterText)
            ? referral.LetterText!
            : "";

        if (!string.IsNullOrWhiteSpace(referral.UploadedFilePath))
        {
            var filePath = Path.Combine(_env.ContentRootPath, "uploads", referral.UploadedFilePath);
            if (System.IO.File.Exists(filePath))
            {
                var extracted = await _documentText.ExtractFromFileAsync(filePath, ct);
                if (DocumentTextExtractor.LooksReadable(extracted))
                {
                    fileText = extracted;
                    referral.LetterText = extracted;
                    referral.UpdatedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync(ct);
                }
            }
        }

        var mistral = HttpContext.RequestServices.GetRequiredService<MistralAiService>();
        var result  = await mistral.PrescanForIntakeAsync(referralId, fileText, ct);
        return Ok(result);
    }

    [HttpPost("{referralId:guid}/validate")]
    public async Task<ActionResult<CompletenessResult>> Validate(Guid referralId, CancellationToken ct)
    {
        var referral = await _db.Referrals.Include(r => r.Patient)
            .FirstOrDefaultAsync(r => r.Id == referralId, ct);
        if (referral == null) return NotFound();

        var (isComplete, missing) = _completeness.Validate(referral, referral.Patient);
        referral.Status = isComplete ? ReferralStatus.Complete : ReferralStatus.Incomplete;
        referral.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new CompletenessResult(isComplete, missing, referralId));
    }
}
