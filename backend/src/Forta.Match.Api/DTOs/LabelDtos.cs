namespace Forta.Match.Api.DTOs;

public record LabelCatalogDto(
    string RulesJson,
    DateTime? UpdatedAt,
    IReadOnlyList<LabelSummaryDto> Labels
);

public record LabelSummaryDto(
    string WorkflowName,
    string DisplayName,
    int SortOrder,
    IReadOnlyList<string> KnockoutRuleNames,
    int RuleCount
);

public record UpdateLabelCatalogRequest(string RulesJson);

public record TestLabelCatalogRequest(
    object SampleInput,
    string? RulesJson = null
);
