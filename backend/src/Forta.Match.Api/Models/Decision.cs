namespace Forta.Match.Api.Models;

public class Decision
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReferralId { get; set; }
    public Referral Referral { get; set; } = null!;

    public string DecisionType { get; set; } = string.Empty;
    public FinalDecision Outcome { get; set; }
    public string? Reason { get; set; }
    public string? DecidedBy { get; set; }
    public bool IsOverride { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
