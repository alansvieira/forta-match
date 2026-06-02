using Forta.Match.Api.Data;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Models;
using Forta.Match.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Forta.Match.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly FortaDbContext _db;
    private readonly DocumentTextExtractor _documentText;
    private readonly IWebHostEnvironment _env;

    public NotificationsController(
        FortaDbContext db,
        DocumentTextExtractor documentText,
        IWebHostEnvironment env)
    {
        _db = db;
        _documentText = documentText;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult<List<EmailNotificationDto>>> List(
        [FromQuery] bool unreadOnly = false,
        CancellationToken ct = default)
    {
        var query = _db.EmailNotifications.AsQueryable();
        if (unreadOnly) query = query.Where(n => !n.IsRead);

        var items = await query
            .OrderByDescending(n => n.ReceivedAt)
            .Take(50)
            .ToListAsync(ct);

        return Ok(items.Select(ToDto).ToList());
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<int>> UnreadCount(CancellationToken ct)
    {
        var count = await _db.EmailNotifications.CountAsync(n => !n.IsRead, ct);
        return Ok(count);
    }

    [HttpPost("{id:guid}/read")]
    public async Task<ActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        var n = await _db.EmailNotifications.FindAsync(new object[] { id }, ct);
        if (n == null) return NotFound();
        n.IsRead = true;
        await _db.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpPost("mark-all-read")]
    public async Task<ActionResult> MarkAllRead(CancellationToken ct)
    {
        await _db.EmailNotifications
            .Where(n => !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), ct);
        return Ok();
    }

    [HttpDelete("clear")]
    public async Task<ActionResult> ClearAll(CancellationToken ct)
    {
        await _db.EmailNotifications.ExecuteDeleteAsync(ct);
        return Ok(new { message = "Alle notificaties verwijderd." });
    }

    /// <summary>
    /// Maakt een intake aan vanuit een e-mailnotificatie.
    /// Koppelt automatisch de bijlage en draait de AI prescan.
    /// </summary>
    [HttpPost("{id:guid}/create-intake")]
    public async Task<ActionResult<object>> CreateIntake(Guid id, CancellationToken ct)
    {
        var n = await _db.EmailNotifications.FindAsync(new object[] { id }, ct);
        if (n == null) return NotFound();

        // Als er al een referral is, prescan opnieuw draaien en terugsturen
        if (n.ReferralId.HasValue)
        {
            var existing = await _db.Referrals.FindAsync(new object[] { n.ReferralId.Value }, ct);
            if (existing != null)
            {
                var mistralExisting = HttpContext.RequestServices.GetRequiredService<MistralAiService>();
                var prescanExisting = await mistralExisting.PrescanForIntakeAsync(
                    existing.Id, existing.LetterText ?? n.Body, ct);
                return Ok(new { referralId = existing.Id, prescan = prescanExisting });
            }
        }

        // Bepaal de brieftekst voor de prescan
        // Probeer de opgeslagen bijlage te lezen als het een tekstbestand is
        var letterText = n.Body;
        if (n.HasAttachment)
        {
            var filePath = Path.Combine(_env.ContentRootPath, "uploads", n.AttachmentPath!);
            if (System.IO.File.Exists(filePath))
            {
                var extracted = await _documentText.ExtractFromFileAsync(filePath, ct);
                if (DocumentTextExtractor.LooksReadable(extracted))
                    letterText = extracted;
            }
        }

        // Maak referral aan — bijlage is al opgeslagen door Gmail poller
        var patient = new Patient
        {
            Name           = "Uit e-mail",
            Bsn            = "",
            ContactDetails = n.FromEmail,
            Email          = n.FromEmail,
        };

        var referral = new Referral
        {
            Patient          = patient,
            LetterText       = letterText,
            UploadedFileName = n.AttachmentFileName ?? $"E-mail: {n.Subject}",
            UploadedFilePath = n.AttachmentPath,
            Status           = ReferralStatus.Draft,
        };

        _db.Referrals.Add(referral);
        n.IsProcessed = true;
        n.IsRead      = true;
        n.ReferralId  = referral.Id;
        await _db.SaveChangesAsync(ct);

        // Draai prescan automatisch met Mistral
        var mistral = HttpContext.RequestServices.GetRequiredService<MistralAiService>();
        var prescan = await mistral.PrescanForIntakeAsync(referral.Id, letterText, ct);

        return Ok(new { referralId = referral.Id, prescan });
    }

    private static readonly (string Subject, string FromName, string FromEmail, string Body)[] DemoEmails =
    [
        (
            "Forta Verwijsbrief — J. de Vries",
            "Huisartsenpraktijk De Jong",
            "b.dejong@huisartsenpraktijk.nl",
            """
            Geachte collega,

            Hierbij verwijs ik u patiënt J. de Vries (BSN: 123456789, geboortedatum 14-03-1989, adres: Hoofdstraat 12, 3555 HW Utrecht) voor specialistische GGZ-behandeling.

            Verwijsdatum: 27-05-2026
            AGB-code verwijzer: 73732118
            Handtekening: aanwezig
            Zorgverzekeraar: Zilveren Kruis

            Vermoedelijke DSM-5 diagnose: ADHD (F90.0)

            Hulpvraag: Patiënt ervaart al langere tijd concentratieproblemen, impulsiviteit en innerlijke onrust. Er is eerder gesproken over mogelijke ADHD. Patiënt heeft behoefte aan diagnostiek en behandeling.

            Relevante voorgeschiedenis: Angst- en paniekaanvallen (POH-GGZ 2023). Geen suïcidaliteit.

            Met vriendelijke groet,
            Huisarts B. de Jong
            Huisartsenpraktijk De Jong, Utrecht
            """
        ),
        (
            "Forta Verwijsbrief — M. Bakker",
            "Psychologenpraktijk Van der Berg",
            "s.vdberg@psychologenpraktijk.nl",
            """
            Geachte collega,

            Graag verwijs ik u patiënt M. Bakker (BSN: 987654321, geboortedatum 22-07-1995, adres: Keizersgracht 88, 1015 CT Amsterdam) voor verdere GGZ-behandeling.

            Verwijsdatum: 28-05-2026
            AGB-code verwijzer: 94038271
            Handtekening: aanwezig
            Zorgverzekeraar: CZ

            Vermoedelijke DSM-5 diagnose: PTSS (F43.1)

            Hulpvraag: Patiënt heeft ernstige traumaklachten na een ingrijpende gebeurtenis (2024). Herbelevingen, vermijdingsgedrag en hyperalertheid. Reguliere gesprekken bij POH-GGZ onvoldoende. Verzoek om EMDR of traumafocusbehandeling.

            Suïcidaliteit: Nee, geen actuele gedachten.

            Met vriendelijke groet,
            GZ-psycholoog S. van der Berg
            AGB: 94038271
            """
        ),
        (
            "Forta Verwijsbrief — K. Özdemir",
            "Huisartsenpraktijk Centrum",
            "huisarts@hap-centrum.nl",
            """
            Geachte collega,

            Betreft verwijzing van patiënt K. Özdemir (BSN: 456789123, geboortedatum 05-11-1985, adres: Boslaan 3, 2718 GK Zoetermeer) voor specialistische GGZ.

            Verwijsdatum: 29-05-2026
            AGB-code verwijzer: 12345678
            Handtekening: aanwezig
            Zorgverzekeraar: Menzis

            Vermoedelijke DSM-5 diagnose: Depressieve stoornis, recidief matig (F33.1)

            Hulpvraag: Terugkerende depressieve episodes. Patiënt functioneert momenteel slecht op het werk en thuis. Eerdere behandeling bij Indigo (2021) positief afgerond. Verzoek om cognitieve gedragstherapie.

            Suïcidaliteit: Passieve doodswens, geen actieve plannen.

            Met vriendelijke groet,
            Huisarts P. Jansen
            AGB: 12345678
            """
        ),
    ];

    private static int _demoIndex = 0;

    /// <summary>Voeg een realistische demo verwijsbrief toe als notificatie.</summary>
    [HttpPost("test")]
    public async Task<ActionResult<EmailNotificationDto>> AddTestNotification(CancellationToken ct)
    {
        var demo = DemoEmails[_demoIndex % DemoEmails.Length];
        _demoIndex++;

        var n = new EmailNotification
        {
            Subject   = demo.Subject,
            FromEmail = demo.FromEmail,
            FromName  = demo.FromName,
            Body      = demo.Body,
            IsRead    = false,
        };

        _db.EmailNotifications.Add(n);
        await _db.SaveChangesAsync(ct);
        return Ok(ToDto(n));
    }

    private static EmailNotificationDto ToDto(EmailNotification n) => new(
        n.Id, n.Subject, n.FromEmail, n.FromName, n.Body,
        n.IsRead, n.IsProcessed, n.ReferralId, n.ReceivedAt);
}
