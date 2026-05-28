using System.Text.Json;
using Forta.Match.Api.Data;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Models;
using Microsoft.EntityFrameworkCore;
using RulesEngine.Models;

namespace Forta.Match.Api.Services;

public class RulesEngineService
{
    private static readonly string[] RequiredRuleNames =
        ["ExclusionCriteria", "LocationMatch", "CapacityCheck", "InsurerCoverage"];

    private static readonly string[] WarningRuleNames = ["DsmSupported"];

    private readonly FortaDbContext _db;
    private readonly ILogger<RulesEngineService> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private RulesEngine.RulesEngine? _engine;
    private string _currentWorkflowJson = "";

    public RulesEngineService(FortaDbContext db, ILogger<RulesEngineService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task ReloadAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            var config = await _db.RuleConfigurations
                .FirstOrDefaultAsync(r => r.WorkflowName == "ReferralMatch" && r.IsActive, ct);

            if (config == null)
            {
                var defaultPath = Path.Combine(AppContext.BaseDirectory, "Config", "rules.json");
                if (!File.Exists(defaultPath))
                    defaultPath = Path.Combine(Directory.GetCurrentDirectory(), "Config", "rules.json");

                var json = File.Exists(defaultPath)
                    ? await File.ReadAllTextAsync(defaultPath, ct)
                    : "[]";

                config = new RuleConfiguration
                {
                    WorkflowName = "ReferralMatch",
                    RulesJson = json
                };
                _db.RuleConfigurations.Add(config);
                await _db.SaveChangesAsync(ct);
            }

            _currentWorkflowJson = config.RulesJson;
            var workflows = JsonSerializer.Deserialize<Workflow[]>(config.RulesJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? Array.Empty<Workflow>();

            _engine = new RulesEngine.RulesEngine(workflows, null);
            _logger.LogInformation("Rules engine reloaded with {Count} workflows", workflows.Length);
        }
        finally
        {
            _lock.Release();
        }
    }

    public static InsurerInput BuildInsurerInput(string? insurerName)
    {
        // Empty insurer on intake form should not block matching — verified later by secretariat.
        if (string.IsNullOrWhiteSpace(insurerName))
        {
            return new InsurerInput { IsCovered = true, CapRemaining = 10000 };
        }

        return new InsurerInput { IsCovered = true, CapRemaining = 10000 };
    }

    public async Task<RecommendationResult> EvaluateAsync(Extraction extraction, string? insurerName, CancellationToken ct = default)
    {
        if (_engine == null)
            await ReloadAsync(ct);

        var input = new RulesEvaluationInput
        {
            extraction = new ExtractionInput
            {
                ProbableDsm = extraction.ProbableDsm,
                Symptoms = extraction.Symptoms,
                Age = extraction.Age,
                RiskLevel = NormalizeRiskLevel(extraction.RiskLevel),
                Region = extraction.Region,
                Context = extraction.Context
            },
            capacity = new CapacityInput(),
            insurer = BuildInsurerInput(insurerName)
        };

        var details = await ExecuteRulesAsync("ReferralMatch", input);
        return BuildRecommendation(details, insurerName);
    }

    public async Task<RecommendationResult> TestRulesAsync(string workflowName, RulesEvaluationInput input, CancellationToken ct = default)
    {
        if (_engine == null)
            await ReloadAsync(ct);

        if (input.extraction.RiskLevel != null)
            input.extraction.RiskLevel = NormalizeRiskLevel(input.extraction.RiskLevel);

        var details = await ExecuteRulesAsync(workflowName, input);
        return BuildRecommendation(details, null);
    }

    private async Task<List<RuleEvaluationDetail>> ExecuteRulesAsync(string workflowName, RulesEvaluationInput input)
    {
        var ruleInputs = new[]
        {
            new RuleParameter("extraction", input.extraction),
            new RuleParameter("capacity", input.capacity),
            new RuleParameter("insurer", input.insurer)
        };

        var results = await _engine!.ExecuteAllRulesAsync(workflowName, ruleInputs);
        return results.Select(r => new RuleEvaluationDetail(
            r.Rule.RuleName,
            r.IsSuccess,
            r.IsSuccess ? r.Rule.SuccessEvent : r.ExceptionMessage ?? r.Rule.ErrorMessage
        )).ToList();
    }

    private static RecommendationResult BuildRecommendation(List<RuleEvaluationDetail> details, string? insurerName)
    {
        var requiredResults = details.Where(d => RequiredRuleNames.Contains(d.RuleName)).ToList();
        var failedRequired = requiredResults.Where(d => !d.Passed).ToList();
        var failedWarnings = details.Where(d => WarningRuleNames.Contains(d.RuleName) && !d.Passed).ToList();

        string recommendation;
        string reasoning;

        if (failedRequired.Count == 0)
        {
            recommendation = "YES";
            reasoning = "All inclusion criteria met. Patient matches service profile.";
            if (string.IsNullOrWhiteSpace(insurerName))
                reasoning += " Insurer not specified on form — verify coverage during validation.";
            if (failedWarnings.Count > 0)
                reasoning += " Note: DSM classification may need confirmation.";
        }
        else if (failedRequired.Count >= 2
                 || failedRequired.Any(r => r.RuleName is "ExclusionCriteria" or "LocationMatch"))
        {
            recommendation = "NO";
            reasoning = "Referral does not meet criteria: " +
                        string.Join(", ", failedRequired.Select(d => $"{d.RuleName} ({d.Message})"));
        }
        else
        {
            recommendation = "UNCERTAIN";
            var failed = failedRequired.First();
            reasoning = $"Rule '{failed.RuleName}' did not pass: {failed.Message}. Requires human review.";
        }

        return new RecommendationResult(recommendation, reasoning, details);
    }

    private static string? NormalizeRiskLevel(string? riskLevel)
    {
        if (string.IsNullOrWhiteSpace(riskLevel)) return "medium";
        return riskLevel.Trim().ToLowerInvariant();
    }

    public string GetCurrentRulesJson() => _currentWorkflowJson;
}
