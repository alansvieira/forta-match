using Forta.Match.Api.Data;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Models;
using Forta.Match.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forta.Match.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReviewController : ControllerBase
{
    private readonly FortaDbContext _db;
    private readonly ReferralService _referrals;

    public ReviewController(FortaDbContext db, ReferralService referrals)
    {
        _db = db;
        _referrals = referrals;
    }

    [HttpGet("queue")]
    public async Task<ActionResult<List<ReferralSummaryDto>>> GetQueue(CancellationToken ct)
    {
        var items = await _db.Referrals
            .Include(r => r.Patient)
            .Where(r => r.AiRecommendation == Recommendation.Uncertain
                        || r.Status == ReferralStatus.RecommendedUncertain
                        || r.Status == ReferralStatus.ScreeningReview)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync(ct);

        return Ok(items.Select(r => new ReferralSummaryDto(
            r.Id, r.Patient.Name, r.Status.ToString(),
            r.AiRecommendation.ToString(), r.FinalDecision.ToString(),
            r.CreatedAt, r.Location, r.ProbableDsm)).ToList());
    }

    [HttpGet("{referralId:guid}")]
    public async Task<ActionResult<ReferralDetailDto>> GetForReview(Guid referralId, CancellationToken ct)
    {
        var referral = await _referrals.GetWithDetailsAsync(referralId, ct);
        if (referral == null) return NotFound();
        return Ok(_referrals.ToDetailDto(referral));
    }

    [HttpPost("{referralId:guid}/decide")]
    public async Task<ActionResult<ReferralDetailDto>> Decide(Guid referralId, [FromBody] DecideRequest request, CancellationToken ct)
    {
        var referral = await _referrals.GetWithDetailsAsync(referralId, ct);
        if (referral == null) return NotFound();

        var outcome = request.Outcome.Equals("accept", StringComparison.OrdinalIgnoreCase)
            ? FinalDecision.Accept : FinalDecision.Reject;

        referral.FinalDecision = outcome;
        referral.FinalReason = request.Reason;
        referral.RequiresPhoneContact = request.RequiresPhoneContact;
        referral.Status = outcome == FinalDecision.Accept
            ? ReferralStatus.FinalizedAccept
            : ReferralStatus.FinalizedReject;
        referral.UpdatedAt = DateTime.UtcNow;

        _db.Decisions.Add(new Decision
        {
            ReferralId = referralId,
            DecisionType = "ScreeningTeam",
            Outcome = outcome,
            Reason = request.Reason,
            DecidedBy = request.DecidedBy ?? "Screening Team"
        });

        await _db.SaveChangesAsync(ct);
        return Ok(_referrals.ToDetailDto(referral));
    }

    [HttpPost("{referralId:guid}/override")]
    public async Task<ActionResult<ReferralDetailDto>> Override(Guid referralId, [FromBody] OverrideRequest request, CancellationToken ct)
    {
        var referral = await _referrals.GetWithDetailsAsync(referralId, ct);
        if (referral == null) return NotFound();

        var outcome = request.Outcome.Equals("accept", StringComparison.OrdinalIgnoreCase)
            ? FinalDecision.Accept : FinalDecision.Reject;

        referral.FinalDecision = outcome;
        referral.FinalReason = request.Reason;
        referral.HumanOverride = true;
        referral.Status = outcome == FinalDecision.Accept
            ? ReferralStatus.FinalizedAccept
            : ReferralStatus.FinalizedReject;
        referral.UpdatedAt = DateTime.UtcNow;

        _db.Decisions.Add(new Decision
        {
            ReferralId = referralId,
            DecisionType = "HumanOverride",
            Outcome = outcome,
            Reason = request.Reason,
            DecidedBy = request.DecidedBy ?? "Secretariat",
            IsOverride = true
        });

        await _db.SaveChangesAsync(ct);
        return Ok(_referrals.ToDetailDto(referral));
    }

    /// <summary>Secretariaat stuurt door naar screenteam (twijfel of weet het niet).</summary>
    [HttpPost("{referralId:guid}/forward-screenteam")]
    public async Task<ActionResult<ReferralDetailDto>> ForwardScreenteam(
        Guid referralId,
        [FromBody] ForwardScreenteamRequest request,
        CancellationToken ct)
    {
        var referral = await _referrals.GetWithDetailsAsync(referralId, ct);
        if (referral == null) return NotFound();

        referral.Status    = ReferralStatus.ScreeningReview;
        referral.UpdatedAt = DateTime.UtcNow;

        _db.Decisions.Add(new Decision
        {
            ReferralId   = referralId,
            DecisionType = "DoorgestuurdScreenteam",
            Outcome      = FinalDecision.None,
            Reason       = request.Reason ?? "Doorgestuurd naar screenteam door secretariaat",
            DecidedBy    = request.DecidedBy ?? "Secretariaat",
        });

        await _db.SaveChangesAsync(ct);
        return Ok(_referrals.ToDetailDto(referral));
    }

    [HttpPost("{referralId:guid}/validate")]
    public async Task<ActionResult<ReferralDetailDto>> Validate(Guid referralId, [FromBody] ValidateRequest request, CancellationToken ct)
    {
        var referral = await _referrals.GetWithDetailsAsync(referralId, ct);
        if (referral == null) return NotFound();

        if (request.Action.Equals("accept", StringComparison.OrdinalIgnoreCase))
        {
            referral.Status = ReferralStatus.ValidatedAccept;
            referral.FinalDecision = FinalDecision.Accept;
        }
        else
        {
            referral.Status = ReferralStatus.ValidatedReject;
            referral.FinalDecision = FinalDecision.Reject;
        }

        referral.ValidatedBy = request.ValidatedBy ?? "Secretariat";
        referral.FinalReason = request.Reason;
        referral.UpdatedAt = DateTime.UtcNow;

        _db.Decisions.Add(new Decision
        {
            ReferralId = referralId,
            DecisionType = "Validation",
            Outcome = referral.FinalDecision,
            Reason = request.Reason,
            DecidedBy = referral.ValidatedBy
        });

        await _db.SaveChangesAsync(ct);
        return Ok(_referrals.ToDetailDto(referral));
    }
}
