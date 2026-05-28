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
