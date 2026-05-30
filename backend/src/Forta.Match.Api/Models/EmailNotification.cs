namespace Forta.Match.Api.Models;

public class EmailNotification
{
    public Guid     Id                  { get; set; } = Guid.NewGuid();
    public string   Subject             { get; set; } = "";
    public string   FromEmail           { get; set; } = "";
    public string   FromName            { get; set; } = "";
    public string   Body                { get; set; } = "";
    public string?  HtmlBody            { get; set; }
    public string?  AttachmentFileName  { get; set; }   // originele bestandsnaam
    public string?  AttachmentPath      { get; set; }   // opgeslagen pad in /uploads
    public bool     IsRead              { get; set; } = false;
    public bool     IsProcessed         { get; set; } = false;
    public Guid?    ReferralId          { get; set; }
    public DateTime ReceivedAt          { get; set; } = DateTime.UtcNow;

    public bool HasAttachment => !string.IsNullOrEmpty(AttachmentPath);
}
