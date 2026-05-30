using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Forta.Match.Api.Services;

public class EmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    private string Email       => _config["Gmail:Email"]       ?? "";
    private string AppPassword => _config["Gmail:AppPassword"] ?? "";

    public async Task<bool> SendAsync(
        string toAddress,
        string subject,
        string htmlBody,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(AppPassword))
        {
            _logger.LogWarning("Gmail credentials not configured — e-mail not sent");
            return false;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("Forta Match", Email));
            message.To.Add(MailboxAddress.Parse(toAddress));
            message.Subject = subject;
            message.Body    = new TextPart("html") { Text = htmlBody };

            using var client = new SmtpClient();
            await client.ConnectAsync("smtp.gmail.com", 587, SecureSocketOptions.StartTls, ct);
            await client.AuthenticateAsync(Email, AppPassword, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            _logger.LogInformation("E-mail verzonden naar {To}", toAddress);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "E-mail versturen mislukt naar {To}", toAddress);
            return false;
        }
    }

    /// <summary>Vervangt {{naam}}, {{velden}}, etc. in een template body.</summary>
    public static string FillTemplate(string body, Dictionary<string, string> vars)
    {
        foreach (var (key, val) in vars)
            body = body.Replace($"{{{{{key}}}}}", val, StringComparison.OrdinalIgnoreCase);
        return body;
    }
}
