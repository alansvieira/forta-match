namespace Forta.Match.Api.Models;

public class RuleConfiguration
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string WorkflowName { get; set; } = "ReferralMatch";
    public string RulesJson { get; set; } = "[]";
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
