using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
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
