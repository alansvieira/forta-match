namespace Forta.Match.Api.DTOs;

public record ExtractionDto(
    string? ProbableDsm,
    string? Symptoms,
    int? Age,
    string? RiskLevel,
    string? Region,
    string? Context
);

public record RecommendationResult(
    string Recommendation,
    string Reasoning,
    List<RuleEvaluationDetail> RuleResults
);

public record RuleEvaluationDetail(
    string RuleName,
    bool Passed,
    string? Message
);

public record MatchRunResult(
    Guid ReferralId,
    ExtractionDto Extraction,
    RecommendationResult Recommendation
);
