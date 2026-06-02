using System.Text;
using DocumentFormat.OpenXml.Packaging;
using UglyToad.PdfPig;

namespace Forta.Match.Api.Services;

/// <summary>
/// Extracts plain text from uploaded referral documents (PDF, DOCX, TXT).
/// </summary>
public class DocumentTextExtractor
{
    private readonly ILogger<DocumentTextExtractor> _logger;

    public DocumentTextExtractor(ILogger<DocumentTextExtractor> logger) => _logger = logger;

    public async Task<string> ExtractFromFileAsync(string filePath, CancellationToken ct = default)
    {
        if (!File.Exists(filePath))
            return string.Empty;

        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        try
        {
            return ext switch
            {
                ".pdf" => ExtractPdf(filePath),
                ".docx" => ExtractDocx(filePath),
                ".txt" => await File.ReadAllTextAsync(filePath, Encoding.UTF8, ct),
                ".doc" => ExtractLegacyDocAsText(filePath),
                _ => string.Empty
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Text extraction failed for {Path}", filePath);
            return string.Empty;
        }
    }

    /// <summary>
    /// True when text looks like letter content, not raw PDF/binary structure.
    /// </summary>
    public static bool LooksReadable(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;

        var t = text.Trim();
        if (t.Length < 40) return false;

        var lower = t.ToLowerInvariant();
        if (lower.Contains("startxref") || lower.Contains("endobj") || lower.Contains("/encoding"))
            return false;
        if (lower.Contains("xref") && lower.Contains("trailer") && lower.Contains("/size"))
            return false;

        var letters = t.Count(char.IsLetter);
        var digits = t.Count(char.IsDigit);
        var slashes = t.Count(c => c == '/');
        if (slashes > Math.Max(20, letters / 3)) return false;

        // Real letters should dominate over PDF operator noise
        return letters + digits >= 50 && letters >= slashes * 2;
    }

    private static string ExtractPdf(string filePath)
    {
        var sb = new StringBuilder();
        using var document = PdfDocument.Open(filePath);
        foreach (var page in document.GetPages())
        {
            var words = page.GetWords();
            if (words == null) continue;
            foreach (var word in words)
                sb.Append(word.Text).Append(' ');
            sb.AppendLine();
        }
        return NormalizeWhitespace(sb.ToString());
    }

    private static string ExtractDocx(string filePath)
    {
        using var doc = WordprocessingDocument.Open(filePath, false);
        var body = doc.MainDocumentPart?.Document?.Body;
        return body == null ? string.Empty : NormalizeWhitespace(body.InnerText);
    }

    private static string ExtractLegacyDocAsText(string filePath)
    {
        // .doc (binary) — best-effort UTF-8/ASCII scan; prefer PDF/DOCX for production
        var bytes = File.ReadAllBytes(filePath);
        var utf8 = Encoding.UTF8.GetString(bytes);
        if (LooksReadable(utf8)) return NormalizeWhitespace(utf8);

        var sb = new StringBuilder();
        foreach (var b in bytes)
        {
            if (b is >= 32 and < 127)
                sb.Append((char)b);
            else if (b is 9 or 10 or 13)
                sb.Append(' ');
        }
        var raw = NormalizeWhitespace(sb.ToString());
        return LooksReadable(raw) ? raw : string.Empty;
    }

    private static string NormalizeWhitespace(string text) =>
        string.Join("\n", text
            .Replace("\r\n", "\n")
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(line => line.Length > 0))
            .Trim();
}
