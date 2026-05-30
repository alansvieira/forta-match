using System.Text.Json;
using Forta.Match.Api.DTOs;
using RulesEngine.Models;

namespace Forta.Match.Api.Services;

public class LabelMatchingService
{
    private readonly ILogger<LabelMatchingService> _logger;
    private RulesEngine.RulesEngine? _engine;

    private static readonly string[] LabelOrder = ["FortaVolwassenen", "DrBosman", "HumanConcern", "Psytrack"];

    private static readonly Dictionary<string, string> DisplayNames = new()
    {
        ["FortaVolwassenen"] = "Forta Volwassenen",
        ["DrBosman"]         = "DR BOSMAN",
        ["HumanConcern"]     = "Human Concern",
        ["Psytrack"]         = "Psytrack",
    };

    /// <summary>Rules that cause "NEE" if they fail (knockout).</summary>
    private static readonly HashSet<string> KnockoutRules = new(StringComparer.OrdinalIgnoreCase)
    {
        "LeeftijdCheck", "CrisisUitsluiting", "LocatieCheck",
    };

    public LabelMatchingService(ILogger<LabelMatchingService> logger)
    {
        _logger = logger;
        InitEngine();
    }

    private void InitEngine()
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "Config", "label-rules.json");
            if (!File.Exists(path))
                path = Path.Combine(Directory.GetCurrentDirectory(), "Config", "label-rules.json");
            if (!File.Exists(path))
            {
                _logger.LogWarning("label-rules.json not found");
                return;
            }

            var json      = File.ReadAllText(path);
            var workflows = JsonSerializer.Deserialize<Workflow[]>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (workflows?.Length > 0)
                _engine = new RulesEngine.RulesEngine(workflows, null);

            _logger.LogInformation("Label matching engine loaded with {Count} label workflows", workflows?.Length ?? 0);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialise label matching engine");
        }
    }

    public async Task<LabelRankingResult> EvaluateAllLabelsAsync(
        RulesEvaluationInput input,
        CancellationToken ct = default)
    {
        if (_engine == null)
            return FallbackResult();

        var ruleParams = new[]
        {
            new RuleParameter("extraction", input.extraction),
            new RuleParameter("capacity",   input.capacity),
            new RuleParameter("insurer",    input.insurer),
        };

        var results = new List<LabelMatchResult>();

        foreach (var labelName in LabelOrder)
        {
            try
            {
                var ruleResults = await _engine.ExecuteAllRulesAsync(labelName, ruleParams);

                var details = ruleResults.Select(r => new RuleEvaluationDetail(
                    r.Rule.RuleName,
                    r.IsSuccess,
                    r.IsSuccess ? null : (r.ExceptionMessage ?? r.Rule.ErrorMessage)
                )).ToList();

                var knockoutFails = details
                    .Where(d => !d.Passed && KnockoutRules.Contains(d.RuleName))
                    .ToList();

                var passed = details.Count(d => d.Passed);
                var total  = details.Count;
                var score  = total > 0 ? (int)Math.Round((double)passed / total * 100) : 0;

                var recommendation = knockoutFails.Count == 0 ? "JA"
                    : knockoutFails.Count == 1              ? "TWIJFEL"
                    : "NEE";

                var reasoning = knockoutFails.Count == 0
                    ? $"Patiënt voldoet aan alle criteria voor {DisplayNames[labelName]}."
                    : $"Niet volledig passend: {string.Join("; ", knockoutFails.Select(d => d.Message ?? d.RuleName))}.";

                results.Add(new LabelMatchResult(
                    labelName,
                    DisplayNames[labelName],
                    score,
                    knockoutFails.Count == 0,
                    recommendation,
                    details,
                    reasoning
                ));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Label {Label} evaluation error", labelName);
                results.Add(new LabelMatchResult(
                    labelName, DisplayNames[labelName], 0, false, "NEE",
                    new List<RuleEvaluationDetail>(), "Evaluatie mislukt."));
            }
        }

        var sorted   = results.OrderByDescending(r => r.Score).ToList();
        var topLabel = sorted.FirstOrDefault(r => r.IsMatch)?.LabelName
                    ?? sorted.FirstOrDefault()?.LabelName;

        var overall = sorted.Any(r => r.IsMatch)                       ? "JA"
                    : sorted.Any(r => r.Recommendation == "TWIJFEL")   ? "TWIJFEL"
                    : "NEE";

        return new LabelRankingResult(sorted, topLabel, overall);
    }

    private static LabelRankingResult FallbackResult() =>
        new(new List<LabelMatchResult>(), null, "TWIJFEL");
}
