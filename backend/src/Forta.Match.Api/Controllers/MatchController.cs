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
    private readonly LabelMatchingService _labelMatching;

    public MatchController(
        FortaDbContext db,
        MistralAiService mistral,
        RulesEngineService rules,
        ReferralService referrals,
        LabelMatchingService labelMatching)
    {
        _db            = db;
        _mistral       = mistral;
        _rules         = rules;
        _referrals     = referrals;
        _labelMatching = labelMatching;
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

    /// <summary>Pilot 1a — evaluate all 4 labels and return a ranked match list.</summary>
    [HttpGet("{referralId:guid}/labelrank")]
    public async Task<ActionResult<LabelRankingResult>> GetLabelRanking(Guid referralId, CancellationToken ct)
    {
        var referral = await _db.Referrals.Include(r => r.Extraction)
            .FirstOrDefaultAsync(r => r.Id == referralId, ct);
        if (referral == null) return NotFound();
        if (referral.Extraction == null)
            return BadRequest("Geen extractie gevonden. Voer eerst AI Match uit.");

        var input = new RulesEvaluationInput
        {
            extraction = new ExtractionInput
            {
                ProbableDsm = referral.Extraction.ProbableDsm,
                Symptoms    = referral.Extraction.Symptoms,
                Age         = referral.Extraction.Age,
                RiskLevel   = referral.Extraction.RiskLevel,
                Region      = referral.Extraction.Region,
                Context     = referral.Extraction.Context,
            },
            capacity = new CapacityInput(),
            insurer  = RulesEngineService.BuildInsurerInput(referral.Insurer),
        };

        var result = await _labelMatching.EvaluateAllLabelsAsync(input, ct);
        return Ok(result);
    }

    /// <summary>Pilot 1a — store human feedback for parallelrun validation.</summary>
    [HttpPost("{referralId:guid}/feedback")]
    public async Task<ActionResult> SubmitFeedback(
        Guid referralId,
        [FromBody] HumanFeedbackRequest request,
        CancellationToken ct)
    {
        var referral = await _db.Referrals.FindAsync(new object[] { referralId }, ct);
        if (referral == null) return NotFound();

        var decision = new Forta.Match.Api.Models.Decision
        {
            ReferralId   = referralId,
            DecisionType = "HumanParallelrunFeedback",
            Outcome      = Forta.Match.Api.Models.FinalDecision.Accept,
            Reason       = $"Label: {request.ChosenLabel} | Uitkomst: {request.Outcome} | Akkoord AI: {request.AgreedWithAi} | {request.Reasoning}",
            DecidedBy    = request.DecidedBy ?? "Secretariaat",
            IsOverride   = false,
        };

        _db.Decisions.Add(decision);
        referral.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Feedback opgeslagen.", agreedWithAi = request.AgreedWithAi });
    }

    /// <summary>Re-evaluates the stored extraction against the current rules, returning per-rule results.</summary>
    [HttpGet("{referralId:guid}/ruleresults")]
    public async Task<ActionResult<RecommendationResult>> GetRuleResults(Guid referralId, CancellationToken ct)
    {
        var referral = await _db.Referrals.Include(r => r.Extraction)
            .FirstOrDefaultAsync(r => r.Id == referralId, ct);
        if (referral == null) return NotFound();
        if (referral.Extraction == null)
            return BadRequest("No extraction found. Run AI match first.");

        var result = await _rules.EvaluateAsync(referral.Extraction, referral.Insurer, ct);
        return Ok(result);
    }
}
