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

// ── Pilot 1a: Label ranking ───────────────────────────────────────────────

public record LabelMatchResult(
    string  LabelName,
    string  DisplayName,
    int     Score,              // 0–100
    bool    IsMatch,
    string  Recommendation,     // "JA" | "TWIJFEL" | "NEE"
    List<RuleEvaluationDetail> RuleResults,
    string? Reasoning
);

public record LabelRankingResult(
    List<LabelMatchResult> Labels,
    string? TopLabel,
    string  OverallRecommendation
);

// ── Pilot 1a: Human feedback (parallelrun) ────────────────────────────────

public record HumanFeedbackRequest(
    string  ChosenLabel,
    string  Outcome,            // "JA" | "NEE" | "TWIJFEL"
    string  Reasoning,
    bool    AgreedWithAi,
    string? DecidedBy
);
