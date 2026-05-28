namespace Forta.Match.Api.Models;

public class Referral
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    public string? ReferrerAgb { get; set; }
    public DateTime? ReferralDate { get; set; }
    public bool HasSignature { get; set; }
    public string? ProbableDsm { get; set; }
    public string? Complaint { get; set; }
    public string? Location { get; set; }
    public string? Insurer { get; set; }

    public string? UploadedFileName { get; set; }
    public string? UploadedFilePath { get; set; }
    public string? LetterText { get; set; }

    public ReferralStatus Status { get; set; } = ReferralStatus.Draft;
    public Recommendation AiRecommendation { get; set; } = Recommendation.None;
    public string? AiReasoning { get; set; }
    public FinalDecision FinalDecision { get; set; } = FinalDecision.None;
    public string? FinalReason { get; set; }
    public string? ValidatedBy { get; set; }
    public bool HumanOverride { get; set; }
    public bool RequiresPhoneContact { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Extraction? Extraction { get; set; }
    public ICollection<Decision> Decisions { get; set; } = new List<Decision>();
}
