using Forta.Match.Api.Data;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Models;
using Forta.Match.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forta.Match.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MatchController : ControllerBase
{
    private readonly FortaDbContext _db;
    private readonly MistralAiService _mistral;
    private readonly RulesEngineService _rules;
    private readonly ReferralService _referrals;

    public MatchController(FortaDbContext db, MistralAiService mistral, RulesEngineService rules, ReferralService referrals)
    {
        _db = db;
        _mistral = mistral;
        _rules = rules;
        _referrals = referrals;
    }

    [HttpPost("{referralId:guid}/extract")]
    public async Task<ActionResult<ExtractionDto>> Extract(Guid referralId, CancellationToken ct)
    {
        var referral = await _db.Referrals.Include(r => r.Extraction).FirstOrDefaultAsync(r => r.Id == referralId, ct);
        if (referral == null) return NotFound();

        referral.Status = ReferralStatus.Extracting;
        await _db.SaveChangesAsync(ct);

        var extraction = await _mistral.ExtractAsync(referral, ct);

        if (referral.Extraction != null)
            _db.Extractions.Remove(referral.Extraction);

        _db.Extractions.Add(extraction);
        referral.Status = ReferralStatus.Extracted;
        referral.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new ExtractionDto(extraction.ProbableDsm, extraction.Symptoms, extraction.Age,
            extraction.RiskLevel, extraction.Region, extraction.Context));
    }

    [HttpPost("{referralId:guid}/evaluate")]
    public async Task<ActionResult<RecommendationResult>> Evaluate(Guid referralId, CancellationToken ct)
    {
        var referral = await _db.Referrals.Include(r => r.Extraction).FirstOrDefaultAsync(r => r.Id == referralId, ct);
        if (referral == null) return NotFound();
        if (referral.Extraction == null)
            return BadRequest("Extraction required before evaluation. Call /extract first.");

        referral.Status = ReferralStatus.Evaluating;
        await _db.SaveChangesAsync(ct);

        var result = await _rules.EvaluateAsync(referral.Extraction, referral.Insurer, ct);

        referral.AiRecommendation = result.Recommendation switch
        {
            "YES" => Recommendation.Yes,
            "NO" => Recommendation.No,
            _ => Recommendation.Uncertain
        };
        referral.AiReasoning = result.Reasoning;
        referral.Status = referral.AiRecommendation switch
        {
            Recommendation.Yes => ReferralStatus.RecommendedYes,
            Recommendation.No => ReferralStatus.RecommendedNo,
            _ => ReferralStatus.RecommendedUncertain
        };
        referral.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(result);
    }

    [HttpPost("{referralId:guid}/run")]
    public async Task<ActionResult<MatchRunResult>> RunFullMatch(Guid referralId, CancellationToken ct)
    {
        var referral = await _db.Referrals.Include(r => r.Extraction).FirstOrDefaultAsync(r => r.Id == referralId, ct);
        if (referral == null) return NotFound();

        referral.Status = ReferralStatus.Extracting;
        await _db.SaveChangesAsync(ct);

        var extraction = await _mistral.ExtractAsync(referral, ct);
        if (referral.Extraction != null)
            _db.Extractions.Remove(referral.Extraction);
        _db.Extractions.Add(extraction);
        referral.Status = ReferralStatus.Extracted;

        var result = await _rules.EvaluateAsync(extraction, referral.Insurer, ct);
        referral.AiRecommendation = result.Recommendation switch
        {
            "YES" => Recommendation.Yes,
            "NO" => Recommendation.No,
            _ => Recommendation.Uncertain
        };
        referral.AiReasoning = result.Reasoning;
        referral.Status = referral.AiRecommendation switch
        {
            Recommendation.Yes => ReferralStatus.RecommendedYes,
            Recommendation.No => ReferralStatus.RecommendedNo,
            _ => ReferralStatus.RecommendedUncertain
        };
        referral.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new MatchRunResult(referralId,
            new ExtractionDto(extraction.ProbableDsm, extraction.Symptoms, extraction.Age,
                extraction.RiskLevel, extraction.Region, extraction.Context),
            result));
    }

    [HttpGet("{referralId:guid}/recommendation")]
    public async Task<ActionResult<RecommendationResult>> GetRecommendation(Guid referralId, CancellationToken ct)
    {
        var referral = await _db.Referrals.FirstOrDefaultAsync(r => r.Id == referralId, ct);
        if (referral == null) return NotFound();
        if (referral.AiRecommendation == Recommendation.None)
            return BadRequest("No recommendation yet");

        return Ok(new RecommendationResult(
            referral.AiRecommendation.ToString().ToUpper(),
            referral.AiReasoning ?? "",
            new List<RuleEvaluationDetail>()));
    }
}
