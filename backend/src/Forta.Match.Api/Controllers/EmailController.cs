using Forta.Match.Api.Data;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forta.Match.Api.Controllers;

[ApiController]
[Route("api/email")]
public class EmailController : ControllerBase
{
    private readonly FortaDbContext _db;
    private readonly EmailService   _email;

    public EmailController(FortaDbContext db, EmailService email)
    {
        _db    = db;
        _email = email;
    }

    [HttpPost("send")]
    public async Task<ActionResult> Send([FromBody] SendEmailRequest req, CancellationToken ct)
    {
        var body = req.Body;

        // Gebruik template als opgegeven
        if (!string.IsNullOrWhiteSpace(req.TemplateName))
        {
            var tmpl = await _db.EmailTemplates
                .FirstOrDefaultAsync(t => t.Name == req.TemplateName, ct);
            if (tmpl != null) body = tmpl.Body;
        }

        var sent = await _email.SendAsync(req.To, req.Subject, body, ct);
        if (!sent)
            return StatusCode(503, "E-mail kon niet worden verzonden. Controleer de Gmail-instellingen.");

        return Ok(new { message = "E-mail verzonden." });
    }

    // ── Templates ─────────────────────────────────────────────────────────────

    [HttpGet("templates")]
    public async Task<ActionResult<List<EmailTemplateDto>>> GetTemplates(CancellationToken ct)
    {
        var templates = await _db.EmailTemplates
            .OrderBy(t => t.DisplayName)
            .ToListAsync(ct);

        return Ok(templates.Select(t => new EmailTemplateDto(
            t.Id, t.Name, t.DisplayName, t.Subject, t.Body, t.UpdatedAt)).ToList());
    }

    [HttpGet("templates/{name}")]
    public async Task<ActionResult<EmailTemplateDto>> GetTemplate(string name, CancellationToken ct)
    {
        var t = await _db.EmailTemplates.FirstOrDefaultAsync(t => t.Name == name, ct);
        if (t == null) return NotFound();
        return Ok(new EmailTemplateDto(t.Id, t.Name, t.DisplayName, t.Subject, t.Body, t.UpdatedAt));
    }

    [HttpPut("templates/{name}")]
    public async Task<ActionResult<EmailTemplateDto>> UpdateTemplate(
        string name,
        [FromBody] UpdateEmailTemplateRequest req,
        CancellationToken ct)
    {
        var t = await _db.EmailTemplates.FirstOrDefaultAsync(t => t.Name == name, ct);
        if (t == null) return NotFound();

        t.Subject   = req.Subject;
        t.Body      = req.Body;
        t.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new EmailTemplateDto(t.Id, t.Name, t.DisplayName, t.Subject, t.Body, t.UpdatedAt));
    }
}
