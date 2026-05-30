namespace Forta.Match.Api.DTOs;

public record WorkflowRulesDto(
    string WorkflowName,
    string RulesJson,
    DateTime UpdatedAt
);

public record UpdateWorkflowRulesRequest(
    string RulesJson
);

public record TestRulesRequest(
    string WorkflowName,
    object SampleInput
);

public record TestRulesResult(
    string Recommendation,
    List<RuleEvaluationDetail> RuleResults
);

public record GenerateRuleRequest(string Description, string WorkflowName);

public record GenerateRuleResponse(
    string RuleName,
    string RuleJson,
    string Explanation,
    bool Success,
    string? Error
);
