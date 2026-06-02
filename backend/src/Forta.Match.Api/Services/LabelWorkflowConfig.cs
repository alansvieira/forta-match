using RulesEngine.Models;

namespace Forta.Match.Api.Services;

/// <summary>
/// Extended workflow config for label matching (maps to RulesEngine + UI metadata).
/// </summary>
public class LabelWorkflowConfig
{
    public string WorkflowName { get; set; } = "";
    public string? DisplayName { get; set; }
    public int SortOrder { get; set; }
    public List<string>? KnockoutRuleNames { get; set; }
    public List<Rule>? Rules { get; set; }

    public string GetDisplayName() =>
        string.IsNullOrWhiteSpace(DisplayName)
            ? FormatWorkflowName(WorkflowName)
            : DisplayName.Trim();

    public IReadOnlyList<string> GetKnockoutRuleNames() =>
        KnockoutRuleNames is { Count: > 0 }
            ? KnockoutRuleNames
            : DefaultKnockoutNames;

    private static readonly string[] DefaultKnockoutNames =
        ["LeeftijdCheck", "CrisisUitsluiting", "LocatieCheck"];

    private static string FormatWorkflowName(string name) =>
        string.Concat(name.Select((c, i) =>
            i > 0 && char.IsUpper(c) && !char.IsUpper(name[i - 1]) ? " " + c : c.ToString()));
}
