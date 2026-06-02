using System.Globalization;
using System.Text.RegularExpressions;
using Forta.Match.Api.DTOs;

namespace Forta.Match.Api.Services;

/// <summary>
/// Rule-based extraction from Dutch referral letter plain text (fallback when Mistral is unavailable).
/// </summary>
public static class ReferralLetterParser
{
    public static PrescanResult Parse(Guid referralId, string letterText)
    {
        var text = letterText?.Trim() ?? "";
        if (text.Length < 20)
        {
            return new PrescanResult(
                referralId, null, null, null, null, null, null, null, null, null, null, null, null,
                text.Length > 0 ? text : null,
                "local",
                "Geen brieftekst om uit te lezen.");
        }

        var name = MatchOne(text, @"(?:mw\.|mr\.|mevr\.|dhr\.)\s+([^,\n\r]+)", RegexOptions.IgnoreCase)
                   ?? MatchOne(text, @"verwijs\s+(?:hiermee\s+)?(?:mw\.|mr\.|mevr\.|dhr\.)\s+([^,\n\r]+)", RegexOptions.IgnoreCase)
                   ?? MatchOne(text, @"pati[eë]nt[:\s]+([A-Z][^\n\r,]{2,60})", RegexOptions.IgnoreCase);

        var bsn = MatchOne(text, @"BSN[:\s]*(\d{9})");
        var email = MatchOne(text, @"([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})");
        var phone = MatchOne(text, @"(\+31\d{9}|06[\s\-]?\d{8})");
        var address = MatchOne(text, @"Adres[:\s]*([^\n\r]+)", RegexOptions.IgnoreCase)
                      ?? MatchOne(text, @"(\d{4}\s*[A-Z]{2}\s+[A-Za-zÀ-ÿ\-\s]+)", RegexOptions.IgnoreCase);

        var agb = MatchOne(text, @"AGB[-\s]*(?:code)?[:\s]*(\d{8})", RegexOptions.IgnoreCase);
        var dsm = MatchOne(text, @"(F\d{2}(?:\.\d{1,2})?)", RegexOptions.IgnoreCase)
                  ?? MatchOne(text, @"DSM[-\s]*richting[:\s]*([^\n\r.]+)", RegexOptions.IgnoreCase);

        var complaint = MatchOne(text, @"Klacht[:\s]*([^\n\r]+)", RegexOptions.IgnoreCase)
                        ?? MatchOne(text, @"hulpvraag[:\s]*([^\n\r]+)", RegexOptions.IgnoreCase);

        var location = MatchOne(text, @"regio\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\s]*?)(?=\s+met\b|\s+bij\b|[.,\n\r]|$)", RegexOptions.IgnoreCase)
                       ?? MatchOne(text, @"\d{4}\s*[A-Z]{2}\s+([A-Za-zÀ-ÿ\-]+)", RegexOptions.IgnoreCase);

        if (location == null && address != null)
        {
            var city = MatchOne(address, @"\d{4}\s*[A-Z]{2}\s+(.+)$");
            if (city != null) location = city;
        }

        var insurer = MatchOne(text, @"(?:Zorgverzekeraar|verzekeraar)[:\s]*([^\n\r]+)", RegexOptions.IgnoreCase)
                      ?? MatchOne(text, @"(Zilveren Kruis|CZ|VGZ|Menzis|ASR|DSW|ONVZ|FBTO|Interpolis)", RegexOptions.IgnoreCase);

        var referralDate = ParseDutchDate(
            MatchOne(text, @"Datum[:\s]*(\d{1,2}\s+\w+\s+\d{4})", RegexOptions.IgnoreCase)
            ?? MatchOne(text, @"(\d{4}-\d{2}-\d{2})"));

        var hasSignature = Regex.IsMatch(text, @"handtekening|onderteken", RegexOptions.IgnoreCase)
                           || Regex.IsMatch(text, @"(?:Dr\.|arts)\s+[A-Z]", RegexOptions.IgnoreCase);

        PrescanField? Field(string? value, float confidence) =>
            string.IsNullOrWhiteSpace(value) ? null : new PrescanField(value.Trim(), confidence);

        return new PrescanResult(
            referralId,
            Field(name, 0.85f),
            Field(bsn, 0.9f),
            Field(address, 0.8f),
            Field(email, 0.85f),
            Field(NormalizePhone(phone), 0.8f),
            Field(agb, 0.85f),
            Field(referralDate, 0.75f),
            new PrescanField(hasSignature ? "true" : "false", 0.7f),
            Field(dsm != null ? FormatDsm(dsm, text) : null, 0.75f),
            Field(complaint, 0.7f),
            Field(location, 0.7f),
            Field(insurer, 0.6f),
            DocumentTextExtractor.LooksReadable(text) ? text : null,
            "local",
            null);
    }

    private static string? FormatDsm(string code, string text)
    {
        var lower = text.ToLowerInvariant();
        if (lower.Contains("depress"))
            return $"Depressieve stoornis ({code})";
        if (lower.Contains("adhd"))
            return $"ADHD ({code})";
        return code;
    }

    private static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var digits = Regex.Replace(phone, @"\D", "");
        if (digits.StartsWith("31") && digits.Length == 11)
            return $"+{digits}";
        if (digits.Length == 10 && digits.StartsWith("6"))
            return $"0{digits}";
        return phone;
    }

    private static string? ParseDutchDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        if (DateTime.TryParseExact(raw.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var iso))
            return iso.ToString("yyyy-MM-dd");

        var nl = new CultureInfo("nl-NL");
        if (DateTime.TryParse(raw.Trim(), nl, DateTimeStyles.None, out var dt))
            return dt.ToString("yyyy-MM-dd");

        return null;
    }

    private static string? MatchOne(string text, string pattern, RegexOptions options = RegexOptions.None)
    {
        var m = Regex.Match(text, pattern, options);
        if (!m.Success) return null;
        var g = m.Groups.Count > 1 ? m.Groups[1].Value : m.Value;
        return string.IsNullOrWhiteSpace(g) ? null : g.Trim();
    }
}
