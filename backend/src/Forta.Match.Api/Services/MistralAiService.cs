using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Models;

namespace Forta.Match.Api.Services;

public class MistralAiService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MistralAiService> _logger;

    public MistralAiService(HttpClient httpClient, IConfiguration configuration, ILogger<MistralAiService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<Extraction> ExtractAsync(Referral referral, CancellationToken ct = default)
    {
        var apiKey = _configuration["Mistral:ApiKey"]
                     ?? Environment.GetEnvironmentVariable("MISTRAL_API_KEY");

        var letterText = referral.LetterText ?? "";
        if (string.IsNullOrWhiteSpace(letterText) && !string.IsNullOrWhiteSpace(referral.Complaint))
            letterText = $"Complaint: {referral.Complaint}\nLocation: {referral.Location}\nDSM: {referral.ProbableDsm}";

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("Mistral API key not configured; using mock extraction");
            return CreateMockExtraction(referral, letterText);
        }

        try
        {
            var model = _configuration["Mistral:Model"] ?? "mistral-small-latest";
            var prompt = BuildPrompt(letterText, referral);

            var requestBody = new
            {
                model,
                messages = new[]
                {
                    new { role = "system", content = "You extract structured medical referral data. Respond ONLY with valid JSON, no markdown." },
                    new { role = "user", content = prompt }
                },
                temperature = 0.1,
                response_format = new { type = "json_object" }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, "https://api.mistral.ai/v1/chat/completions")
            {
                Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var response = await _httpClient.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "{}";

            return ParseExtraction(content, referral.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Mistral extraction failed; falling back to mock");
            return CreateMockExtraction(referral, letterText);
        }
    }

    private static string BuildPrompt(string letterText, Referral referral) =>
        "Extract the following fields from this Dutch mental health referral letter as JSON:\n" +
        "{ \"probableDsm\": \"string\", \"symptoms\": \"string\", \"age\": number, " +
        "\"riskLevel\": \"low|medium|high|crisis\", \"region\": \"string\", \"context\": \"string\" }\n\n" +
        $"Known data: Location={referral.Location}, DSM hint={referral.ProbableDsm}\n\nLetter:\n{letterText}";

    private static Extraction ParseExtraction(string content, Guid referralId)
    {
        using var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;

        return new Extraction
        {
            ReferralId = referralId,
            ProbableDsm = GetString(root, "probableDsm"),
            Symptoms = GetString(root, "symptoms"),
            Age = root.TryGetProperty("age", out var age) && age.ValueKind == JsonValueKind.Number
                ? age.GetInt32() : null,
            RiskLevel = GetString(root, "riskLevel") ?? "medium",
            Region = GetString(root, "region"),
            Context = GetString(root, "context"),
            RawJson = content,
            ExtractedAt = DateTime.UtcNow
        };
    }

    // ─── Prescan for intake form auto-fill ────────────────────────────────────

    public async Task<PrescanResult> PrescanForIntakeAsync(Guid referralId, string fileText, CancellationToken ct = default)
    {
        var apiKey = _configuration["Mistral:ApiKey"]
                     ?? Environment.GetEnvironmentVariable("MISTRAL_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("Mistral API key not configured; using mock prescan");
            return CreateMockPrescan(referralId, fileText);
        }

        try
        {
            var model = _configuration["Mistral:Model"] ?? "mistral-small-latest";
            var prompt =
                "Extract the following fields from this Dutch mental health referral letter as JSON.\n" +
                "For each field provide a value and a confidence score (0.0–1.0).\n" +
                "Fields:\n" +
                "  name (patient full name), bsn (9-digit BSN), contactDetails (street address),\n" +
                "  email, phone, referrerAgb (8-digit AGB code), referralDate (yyyy-MM-dd),\n" +
                "  hasSignature (\"true\"/\"false\"), probableDsm (DSM-5 code),\n" +
                "  complaint (1–2 sentences), location (city/region), insurer (health insurer)\n\n" +
                "Response format (only JSON, no markdown):\n" +
                "{\n" +
                "  \"name\": {\"value\": \"...\", \"confidence\": 0.95},\n" +
                "  \"bsn\":  {\"value\": \"...\", \"confidence\": 0.90},\n" +
                "  ...\n" +
                "}\n\n" +
                $"Letter:\n{fileText}";

            var requestBody = new
            {
                model,
                messages = new[]
                {
                    new { role = "system", content = "You extract structured data from Dutch medical referral letters. Respond ONLY with valid JSON, no markdown." },
                    new { role = "user", content = prompt }
                },
                temperature = 0.1,
                response_format = new { type = "json_object" }
            };

            var req = new HttpRequestMessage(HttpMethod.Post, "https://api.mistral.ai/v1/chat/completions")
            {
                Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var response = await _httpClient.SendAsync(req, ct);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "{}";

            return ParsePrescan(referralId, content, fileText);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Mistral prescan failed; falling back to mock");
            return CreateMockPrescan(referralId, fileText);
        }
    }

    // ─── Rule generation from natural language ─────────────────────────────

    public async Task<GenerateRuleResponse> GenerateRuleAsync(string description, string currentRulesJson, CancellationToken ct = default)
    {
        var apiKey = _configuration["Mistral:ApiKey"]
                     ?? Environment.GetEnvironmentVariable("MISTRAL_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey))
            return CreateMockGeneratedRule(description);

        try
        {
            var model = _configuration["Mistral:Model"] ?? "mistral-small-latest";
            var prompt =
                "You are a rules engine expert for a Dutch mental healthcare referral system (Forta Match).\n\n" +
                "Input model fields available:\n" +
                "  extraction.ProbableDsm (string), extraction.Symptoms (string), extraction.Age (int),\n" +
                "  extraction.RiskLevel (\"low\"|\"medium\"|\"high\"|\"crisis\"), extraction.Region (string),\n" +
                "  extraction.Context (string), capacity.AvailableSlots (int),\n" +
                "  capacity.WaitingWeeks (int), insurer.IsCovered (bool), insurer.CapRemaining (decimal)\n\n" +
                $"Current workflow rules (for context):\n{currentRulesJson}\n\n" +
                $"User wants to add this rule: \"{description}\"\n\n" +
                "Generate ONE new rule object in Microsoft RulesEngine format.\n" +
                "Respond with JSON in EXACTLY this format:\n" +
                "{\n" +
                "  \"ruleName\": \"ClearEnglishName\",\n" +
                "  \"ruleJson\": { \"RuleName\": \"...\", \"Expression\": \"...\", \"SuccessEvent\": \"PASS\", \"ErrorMessage\": \"...\", \"RuleExpressionType\": \"LambdaExpression\" },\n" +
                "  \"explanation\": \"In het Nederlands: wat deze regel doet en wanneer hij triggert.\"\n" +
                "}";

            var requestBody = new
            {
                model,
                messages = new[]
                {
                    new { role = "system", content = "You are a Microsoft RulesEngine expert. Respond ONLY with valid JSON, no markdown." },
                    new { role = "user", content = prompt }
                },
                temperature = 0.2,
                response_format = new { type = "json_object" }
            };

            var req = new HttpRequestMessage(HttpMethod.Post, "https://api.mistral.ai/v1/chat/completions")
            {
                Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var response = await _httpClient.SendAsync(req, ct);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            var rawContent = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "{}";

            using var resultDoc = JsonDocument.Parse(rawContent);
            var root = resultDoc.RootElement;

            var ruleName    = root.TryGetProperty("ruleName",    out var rn) ? rn.GetString() ?? "NieuweRegel" : "NieuweRegel";
            var ruleJsonStr = root.TryGetProperty("ruleJson",    out var rj) ? rj.ToString()                   : "{}";
            var explanation = root.TryGetProperty("explanation", out var ex) ? ex.GetString() ?? ""            : "";

            return new GenerateRuleResponse(ruleName, ruleJsonStr, explanation, true, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Rule generation failed");
            return new GenerateRuleResponse("", "", "", false, ex.Message);
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private static PrescanResult ParsePrescan(Guid referralId, string content, string letterText)
    {
        try
        {
            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;

            PrescanField? GetField(string prop)
            {
                if (!root.TryGetProperty(prop, out var el)) return null;
                if (el.ValueKind == JsonValueKind.Object)
                {
                    var val  = el.TryGetProperty("value",      out var v) ? v.GetString()          : null;
                    var conf = el.TryGetProperty("confidence", out var c) ? (float)c.GetDouble()   : 0.5f;
                    return val is not null and not "" ? new PrescanField(val, conf) : null;
                }
                if (el.ValueKind == JsonValueKind.String)
                {
                    var s = el.GetString();
                    return s is not null and not "" ? new PrescanField(s, 0.5f) : null;
                }
                return null;
            }

            return new PrescanResult(
                referralId,
                GetField("name"),
                GetField("bsn"),
                GetField("contactDetails"),
                GetField("email"),
                GetField("phone"),
                GetField("referrerAgb"),
                GetField("referralDate"),
                GetField("hasSignature"),
                GetField("probableDsm"),
                GetField("complaint"),
                GetField("location"),
                GetField("insurer"),
                letterText.Length > 100 ? letterText : null
            );
        }
        catch
        {
            return CreateMockPrescan(referralId, letterText);
        }
    }

    private static PrescanResult CreateMockPrescan(Guid referralId, string fileText)
    {
        var lower = fileText.ToLowerInvariant();
        var isAdhd  = lower.Contains("adhd")  || lower.Contains("concentratie");
        var isPtss  = lower.Contains("ptss")  || lower.Contains("trauma");
        var isAngst = lower.Contains("angst") || lower.Contains("paniek");

        var dsm = isAdhd  ? "ADHD (F90.0)"
                : isPtss  ? "PTSS (F43.1)"
                : isAngst ? "Angststoornis (F41.1)"
                          : "Depressieve stoornis (F32.1)";

        var complaint = isAdhd
            ? "Vermoeden ADHD bij volwassene. Concentratieproblemen, impulsiviteit en onrust."
            : isPtss
                ? "Klachten passend bij PTSS na trauma. Herbelevingen, vermijding en hyperalertheid."
                : "Angst- en paniekaanvallen, spanning en somberheid. Verzoek tot behandeling.";

        return new PrescanResult(
            referralId,
            new PrescanField("J. de Vries",                  0.88f),
            new PrescanField("123456789",                     0.72f),
            new PrescanField("Hoofdstraat 12, 3555 HW Utrecht", 0.91f),
            new PrescanField("j.devries@email.nl",           0.65f),
            new PrescanField("06-12345678",                  0.78f),
            new PrescanField("73732118",                     0.82f),
            new PrescanField(DateTime.UtcNow.AddDays(-5).ToString("yyyy-MM-dd"), 0.95f),
            new PrescanField("true",                         0.88f),
            new PrescanField(dsm,                            0.76f),
            new PrescanField(complaint,                      0.83f),
            new PrescanField("Utrecht",                      0.91f),
            new PrescanField("Zilveren Kruis",               0.68f),
            fileText.Length > 100
                ? fileText
                : $"Demo verwijsbrief — {(isAdhd ? "ADHD" : isPtss ? "PTSS" : "Angst")} gerelateerde hulpvraag."
        );
    }

    private static GenerateRuleResponse CreateMockGeneratedRule(string description)
    {
        var lower = description.ToLowerInvariant();

        string ruleName, expression, errorMsg, explanation;

        if (lower.Contains("adhd") || lower.Contains("diagnose"))
        {
            ruleName    = "ADHDBestaandeDiagnoseCheck";
            expression  = "!(extraction.ProbableDsm.Contains(\"F90\") && extraction.Context.Contains(\"diagnostiek\"))";
            errorMsg    = "ADHD-diagnostiek zonder bestaande diagnose — niet geaccepteerd";
            explanation = "Weigert aanmeldingen waarbij ADHD-diagnostiek gevraagd wordt zonder dat er al een vastgestelde diagnose is.";
        }
        else if (lower.Contains("leeftijd") || lower.Contains("18") || lower.Contains("jong"))
        {
            ruleName    = "MinimumLeeftijdCheck";
            expression  = "extraction.Age >= 18";
            errorMsg    = "Patiënt is jonger dan 18 jaar";
            explanation = "Weigert aanmeldingen van patiënten jonger dan 18 jaar. Jeugd-GGZ valt buiten het behandelkader.";
        }
        else if (lower.Contains("crisis") || lower.Contains("suïcid") || lower.Contains("suicid"))
        {
            ruleName    = "CrisisRisicoCheck";
            expression  = "extraction.RiskLevel != \"crisis\"";
            errorMsg    = "Crisisniveau risico — doorverwijzing naar crisisdienst vereist";
            explanation = "Weigert aanmeldingen met een crisisniveau risicoprofiel. Deze patiënten dienen via de crisisdienst behandeld te worden.";
        }
        else if (lower.Contains("wacht") || lower.Contains("capacit"))
        {
            ruleName    = "WachttijdCheck";
            expression  = "capacity.AvailableSlots > 0 AND capacity.WaitingWeeks <= 8";
            errorMsg    = "Onvoldoende capaciteit of wachttijd te lang (>8 weken)";
            explanation = "Weigert aanmeldingen als er geen vrije plaatsen zijn of de wachttijd meer dan 8 weken bedraagt.";
        }
        else
        {
            ruleName    = "AangepasteRegel";
            expression  = "extraction.RiskLevel != \"crisis\" AND insurer.IsCovered == true";
            errorMsg    = $"Voldoet niet aan: {description}";
            explanation = $"Gegenereerde regel op basis van uw beschrijving: \"{description}\"";
        }

        var ruleObj = new
        {
            RuleName             = ruleName,
            Expression           = expression,
            SuccessEvent         = "PASS",
            ErrorMessage         = errorMsg,
            RuleExpressionType   = "LambdaExpression"
        };

        return new GenerateRuleResponse(
            ruleName,
            JsonSerializer.Serialize(ruleObj, new JsonSerializerOptions { WriteIndented = true }),
            explanation,
            true,
            null
        );
    }

    private static string? GetString(JsonElement root, string prop) =>
        root.TryGetProperty(prop, out var el) && el.ValueKind == JsonValueKind.String
            ? el.GetString() : null;

    private static Extraction CreateMockExtraction(Referral referral, string letterText)
    {
        var region = referral.Location?.Contains("Noord", StringComparison.OrdinalIgnoreCase) == true
            ? "Noord-Holland"
            : referral.Location?.Contains("Zuid", StringComparison.OrdinalIgnoreCase) == true
                ? "Zuid-Holland"
                : referral.Location ?? "Utrecht";

        return new Extraction
        {
            ReferralId = referral.Id,
            ProbableDsm = referral.ProbableDsm ?? "F32.1",
            Symptoms = "depression, anxiety, sleep disturbance",
            Age = 35,
            RiskLevel = letterText.Contains("crisis", StringComparison.OrdinalIgnoreCase) ? "crisis" : "medium",
            Region = region,
            Context = "Mock extraction - configure MISTRAL_API_KEY for real LLM extraction",
            RawJson = "{}",
            ExtractedAt = DateTime.UtcNow
        };
    }
}
