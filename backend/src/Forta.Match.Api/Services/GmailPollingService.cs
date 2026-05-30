using Forta.Match.Api.Data;
using Forta.Match.Api.Models;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Search;
using MailKit.Security;
using MimeKit;

namespace Forta.Match.Api.Services;

public class GmailPollingService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration       _config;
    private readonly IWebHostEnvironment  _env;
    private readonly ILogger<GmailPollingService> _logger;

    private string Email       => _config["Gmail:Email"]       ?? "";
    private string AppPassword => _config["Gmail:AppPassword"] ?? "";
    private int    IntervalSec => int.TryParse(_config["Gmail:PollIntervalSeconds"], out var v) ? v : 30;

    private static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".pdf", ".doc", ".docx", ".txt" };

    public GmailPollingService(
        IServiceScopeFactory scopeFactory,
        IConfiguration config,
        IWebHostEnvironment env,
        ILogger<GmailPollingService> logger)
    {
        _scopeFactory = scopeFactory;
        _config       = config;
        _env          = env;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(AppPassword))
        {
            _logger.LogWarning("Gmail credentials niet geconfigureerd — polling uitgeschakeld");
            return;
        }

        _logger.LogInformation("Gmail polling gestart voor {Email}", Email);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PollAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gmail polling fout");
            }

            await Task.Delay(TimeSpan.FromSeconds(IntervalSec), stoppingToken);
        }
    }

    private async Task PollAsync(CancellationToken ct)
    {
        var uploadsDir = Path.Combine(_env.ContentRootPath, "uploads");
        Directory.CreateDirectory(uploadsDir);

        using var client = new ImapClient();
        await client.ConnectAsync("imap.gmail.com", 993, SecureSocketOptions.SslOnConnect, ct);
        await client.AuthenticateAsync(Email, AppPassword, ct);

        var inbox = client.Inbox;
        await inbox.OpenAsync(FolderAccess.ReadWrite, ct);

        var uids = await inbox.SearchAsync(SearchQuery.NotSeen, ct);
        if (uids.Count > 0)
            _logger.LogInformation("{Count} nieuwe e-mail(s) gevonden in Gmail", uids.Count);

        foreach (var uid in uids)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var msg = await inbox.GetMessageAsync(uid, ct);

                var fromAddress = msg.From.Mailboxes.FirstOrDefault()?.Address ?? "onbekend";
                var fromName    = msg.From.Mailboxes.FirstOrDefault()?.Name    ?? fromAddress;
                var subject     = msg.Subject ?? "(geen onderwerp)";
                var body        = msg.TextBody ?? StripHtml(msg.HtmlBody) ?? "";

                // ── Zoek geldige bijlage (PDF, Word, txt) ────────────────
                string? attachmentFileName = null;
                string? attachmentPath     = null;

                foreach (var attachment in msg.Attachments)
                {
                    if (attachment is not MimePart part) continue;
                    var origName = part.FileName ?? "bijlage";
                    var ext      = Path.GetExtension(origName);
                    if (!AllowedExtensions.Contains(ext)) continue;

                    var safeName = $"{Guid.NewGuid()}_{Path.GetFileName(origName)}";
                    var fullPath = Path.Combine(uploadsDir, safeName);

                    await using (var fs = File.OpenWrite(fullPath))
                        await part.Content.DecodeToAsync(fs, ct);

                    attachmentFileName = origName;
                    attachmentPath     = safeName;
                    _logger.LogInformation("Bijlage opgeslagen: {Name}", safeName);
                    break;
                }

                // ── Filter: alleen e-mails met onderwerp "Forta Verwijsbrief" ──
                var isRelevant = subject.Contains("Forta Verwijsbrief", StringComparison.OrdinalIgnoreCase);

                if (!isRelevant)
                {
                    await inbox.AddFlagsAsync(uid, MessageFlags.Seen, silent: true, ct);
                    _logger.LogDebug("E-mail overgeslagen (onderwerp niet 'Forta Verwijsbrief'): {Subject}", subject);
                    continue;
                }

                // ── Sla notificatie op ────────────────────────────────────
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<FortaDbContext>();

                var notification = new EmailNotification
                {
                    Subject            = subject,
                    FromEmail          = fromAddress,
                    FromName           = fromName,
                    Body               = body.Length > 5000 ? body[..5000] : body,
                    HtmlBody           = msg.HtmlBody?.Length > 10000 ? msg.HtmlBody[..10000] : msg.HtmlBody,
                    AttachmentFileName = attachmentFileName,
                    AttachmentPath     = attachmentPath,
                    IsRead             = false,
                };

                db.EmailNotifications.Add(notification);
                await db.SaveChangesAsync(ct);

                await inbox.AddFlagsAsync(uid, MessageFlags.Seen, silent: true, ct);

                _logger.LogInformation(
                    "Verwijsbrief notificatie aangemaakt: '{Subject}' van {From} (bijlage: {HasFile})",
                    subject, fromAddress, attachmentPath != null ? "ja" : "nee");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Fout bij verwerken e-mail {Uid}", uid);
            }
        }

        await client.DisconnectAsync(true, ct);
    }

    private static string? StripHtml(string? html)
    {
        if (html is null) return null;
        return System.Text.RegularExpressions.Regex.Replace(html, "<[^>]+>", " ").Trim();
    }

    private static readonly string[] ReferralKeywords =
    [
        "verwijsbrief", "verwijzing", "doorverwijzing", "patiënt", "patient",
        "huisarts", "agb", "bsn", "diagnose", "dsm", "ggz", "psychiatr",
        "psycholog", "behandeling", "klacht", "anamnese", "forta",
    ];

    private static bool LooksLikeReferral(string subject, string body)
    {
        var text = (subject + " " + body).ToLowerInvariant();
        return ReferralKeywords.Any(kw => text.Contains(kw));
    }
}
