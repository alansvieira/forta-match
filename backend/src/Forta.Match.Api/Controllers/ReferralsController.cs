using Forta.Match.Api.Data;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Models;
using Forta.Match.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forta.Match.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReferralsController : ControllerBase
{
    private readonly ReferralService _referrals;
    private readonly FortaDbContext  _db;

    public ReferralsController(ReferralService referrals, FortaDbContext db)
    {
        _referrals = referrals;
        _db        = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<ReferralSummaryDto>>> List([FromQuery] string? status, CancellationToken ct) =>
        Ok(await _referrals.ListAsync(status, ct));

    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStats>> Stats(CancellationToken ct) =>
        Ok(await _referrals.GetStatsAsync(ct));

    [HttpGet("feedback-stats")]
    public async Task<ActionResult<object>> FeedbackStats(CancellationToken ct)
    {
        var referrals = await _db.Referrals
            .Where(r => r.AiRecommendation != Recommendation.None
                     && r.FinalDecision    != FinalDecision.None)
            .ToListAsync(ct);

        var total   = referrals.Count;
        var agreed  = referrals.Count(r =>
            (r.AiRecommendation == Recommendation.Yes && r.FinalDecision == FinalDecision.Accept) ||
            (r.AiRecommendation == Recommendation.No  && r.FinalDecision == FinalDecision.Reject));
        var deviated = total - agreed;
        var pct      = total > 0 ? (int)Math.Round((double)agreed / total * 100) : 0;

        // Recent 5 voor trend
        var recent = await _db.Referrals
            .Where(r => r.AiRecommendation != Recommendation.None && r.FinalDecision != FinalDecision.None)
            .OrderByDescending(r => r.UpdatedAt)
            .Take(5)
            .Select(r => new
            {
                agreed = (r.AiRecommendation == Recommendation.Yes && r.FinalDecision == FinalDecision.Accept)
                      || (r.AiRecommendation == Recommendation.No  && r.FinalDecision == FinalDecision.Reject)
            })
            .ToListAsync(ct);

        return Ok(new { total, agreed, deviated, agreementPct = pct, recent = recent.Select(r => r.agreed) });
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ReferralDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var referral = await _referrals.GetWithDetailsAsync(id, ct);
        if (referral == null) return NotFound();
        return Ok(_referrals.ToDetailDto(referral));
    }

    /// <summary>Sla een extractie-correctie op als feedback voor het model.</summary>
    [HttpPost("{id:guid}/extraction-correction")]
    public async Task<ActionResult> SaveExtractionCorrection(
        Guid id,
        [FromBody] ExtractionCorrectionRequest req,
        CancellationToken ct)
    {
        var referral = await _db.Referrals.FindAsync(new object[] { id }, ct);
        if (referral == null) return NotFound();

        _db.Decisions.Add(new Decision
        {
            ReferralId   = id,
            DecisionType = "ExtractionCorrectie",
            Outcome      = FinalDecision.None,
            Reason       = $"Veld: {req.Field} | AI-waarde: {req.OriginalValue} | Gecorrigeerd: {req.CorrectedValue}",
            DecidedBy    = req.CorrectedBy ?? "Secretariaat",
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Correctie opgeslagen als feedback." });
    }

    /// <summary>Sla afwijkingsfeedback op (secretariaat wijkt af van AI-advies).</summary>
    [HttpPost("{id:guid}/deviation-feedback")]
    public async Task<ActionResult> SaveDeviationFeedback(
        Guid id,
        [FromBody] DeviationFeedbackRequest req,
        CancellationToken ct)
    {
        var referral = await _db.Referrals.FindAsync(new object[] { id }, ct);
        if (referral == null) return NotFound();

        _db.Decisions.Add(new Decision
        {
            ReferralId   = id,
            DecisionType = "AfwijkingsFeedback",
            Outcome      = FinalDecision.None,
            Reason       = $"AI: {req.AiAdvice} | Mens: {req.HumanDecision} | Reden: {req.Reason}",
            DecidedBy    = "Secretariaat",
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Afwijkingsfeedback opgeslagen." });
    }
}

public record ExtractionCorrectionRequest(string Field, string? OriginalValue, string CorrectedValue, string? CorrectedBy);
public record DeviationFeedbackRequest(string AiAdvice, string HumanDecision, string Reason);
