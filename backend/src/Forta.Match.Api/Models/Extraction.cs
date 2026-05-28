namespace Forta.Match.Api.Models;

public class Extraction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReferralId { get; set; }
    public Referral Referral { get; set; } = null!;

    public string? ProbableDsm { get; set; }
    public string? Symptoms { get; set; }
    public int? Age { get; set; }
    public string? RiskLevel { get; set; }
    public string? Region { get; set; }
    public string? Context { get; set; }
    public string? RawJson { get; set; }
    public DateTime ExtractedAt { get; set; } = DateTime.UtcNow;
}
