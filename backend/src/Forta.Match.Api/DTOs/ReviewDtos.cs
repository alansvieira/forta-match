namespace Forta.Match.Api.DTOs;

public record DecideRequest(
    string Outcome,
    string Reason,
    string? DecidedBy,
    bool RequiresPhoneContact = false
);

public record OverrideRequest(
    string Outcome,
    string Reason,
    string? DecidedBy
);

public record ValidateRequest(
    string Action,
    string? ValidatedBy,
    string? Reason
);

public record ForwardScreenteamRequest(
    string? Reason,
    string? DecidedBy
);

public record ReferralSummaryDto(
    Guid Id,
    string PatientName,
    string Status,
    string? AiRecommendation,
    string? FinalDecision,
    DateTime CreatedAt,
    string? Location,
    string? ProbableDsm
);

public record ReferralDetailDto(
    Guid Id,
    PatientDto Patient,
    string Status,
    string? AiRecommendation,
    string? AiReasoning,
    string? FinalDecision,
    string? FinalReason,
    bool HumanOverride,
    bool RequiresPhoneContact,
    string? UploadedFileName,
    string? ReferrerAgb,
    DateTime? ReferralDate,
    bool HasSignature,
    string? ProbableDsm,
    string? Complaint,
    string? Location,
    string? Insurer,
    ExtractionDto? Extraction,
    List<DecisionDto> Decisions,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record PatientDto(
    Guid Id,
    string Name,
    string Bsn,
    string ContactDetails,
    string? Email,
    string? Phone
);

public record DecisionDto(
    Guid Id,
    string DecisionType,
    string Outcome,
    string? Reason,
    string? DecidedBy,
    bool IsOverride,
    DateTime CreatedAt
);

public record DashboardStats(
    int Total,
    int Pending,
    int Approved,
    int Rejected,
    int Uncertain,
    int InReview
);
