namespace Forta.Match.Api.DTOs;

public record RegisterReferralRequest(
    string Name,
    string Bsn,
    string ContactDetails,
    string? Email,
    string? Phone,
    string? ReferrerAgb,
    DateTime? ReferralDate,
    bool HasSignature,
    string? ProbableDsm,
    string? Complaint,
    string? Location,
    string? Insurer,
    string? LetterText,
    Guid? ReferralId
);

public record CompletenessResult(
    bool IsComplete,
    List<string> MissingFields,
    Guid ReferralId
);

public record UploadResult(
    Guid ReferralId,
    string FileName,
    string Message
);
