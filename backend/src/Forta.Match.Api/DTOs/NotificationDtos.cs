namespace Forta.Match.Api.DTOs;

public record EmailNotificationDto(
    Guid     Id,
    string   Subject,
    string   FromEmail,
    string   FromName,
    string   Body,
    bool     IsRead,
    bool     IsProcessed,
    Guid?    ReferralId,
    DateTime ReceivedAt
);

public record EmailTemplateDto(
    Guid     Id,
    string   Name,
    string   DisplayName,
    string   Subject,
    string   Body,
    DateTime UpdatedAt
);

public record UpdateEmailTemplateRequest(string Subject, string Body);

public record SendEmailRequest(
    string To,
    string Subject,
    string Body,
    string? TemplateName
);

public record CreateIntakeFromEmailRequest(Guid NotificationId);
