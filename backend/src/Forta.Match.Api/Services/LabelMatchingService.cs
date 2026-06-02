using Forta.Match.Api.DTOs;
using RulesEngine.Models;

namespace Forta.Match.Api.Services;

public class LabelMatchingService
{
    private readonly LabelCatalogStore _catalog;
    private readonly ILogger<LabelMatchingService> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);

    private RulesEngine.RulesEngine? _engine;
    private List<LabelWorkflowConfig> _workflows = [];

    public LabelMatchingService(LabelCatalogStore catalog, ILogger<LabelMatchingService> logger)
    {
        _catalog = catalog;
        _logger = logger;
    }

    public async Task ReloadAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            var json = await _catalog.GetRulesJsonAsync(ct);
            _workflows = LabelCatalogStore.ParseCatalog(json);
            var engineWorkflows = LabelCatalogStore.ToRulesEngineWorkflows(json);
            _engine = engineWorkflows.Length > 0
                ? new RulesEngine.RulesEngine(engineWorkflows, null)
                : null;

            _logger.LogInformation(
                "Label catalog reloaded: {Count} labels ({Names})",
                _workflows.Count,
                string.Join(", ", _workflows.Select(w => w.WorkflowName)));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reload label catalog");
            _engine = null;
            _workflows = [];
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<IReadOnlyList<LabelSummaryDto>> GetCatalogSummaryAsync(CancellationToken ct = default)
    {
        if (_workflows.Count == 0)
            await ReloadAsync(ct);

        return _workflows.Select(w => new LabelSummaryDto(
            w.WorkflowName,
            w.GetDisplayName(),
            w.SortOrder,
            w.GetKnockoutRuleNames().ToList(),
            w.Rules?.Count ?? 0
        )).ToList();
    }

    public async Task<LabelRankingResult> EvaluateAllLabelsAsync(
        RulesEvaluationInput input,
        CancellationToken ct = default)
    {
        // Always reload so label-rules.json / DB edits apply without API restart.
        await ReloadAsync(ct);

        if (_engine == null || _workflows.Count == 0)
            return FallbackResult();

        return await EvaluateCoreAsync(_engine, _workflows, input, ct);
    }

    /// <summary>Evaluate arbitrary catalog JSON (e.g. unsaved editor draft).</summary>
    public Task<LabelRankingResult> EvaluateCatalogJsonAsync(
        string catalogJson,
        RulesEvaluationInput input,
        CancellationToken ct = default)
    {
        var workflows = LabelCatalogStore.ParseCatalog(catalogJson);
        var engineWorkflows = LabelCatalogStore.ToRulesEngineWorkflows(catalogJson);
        if (engineWorkflows.Length == 0 || workflows.Count == 0)
            return Task.FromResult(FallbackResult());

        var engine = new RulesEngine.RulesEngine(engineWorkflows, null);
        return EvaluateCoreAsync(engine, workflows, input, ct);
    }

    private async Task<LabelRankingResult> EvaluateCoreAsync(
        RulesEngine.RulesEngine engine,
        List<LabelWorkflowConfig> workflows,
        RulesEvaluationInput input,
        CancellationToken ct)
    {
        var ruleParams = new[]
        {
            new RuleParameter("extraction", input.extraction),
            new RuleParameter("capacity", input.capacity),
            new RuleParameter("insurer", input.insurer),
        };

        var results = new List<LabelMatchResult>();

        foreach (var labelConfig in workflows)
        {
            var labelName = labelConfig.WorkflowName;
            var displayName = labelConfig.GetDisplayName();
            var knockoutNames = new HashSet<string>(
                labelConfig.GetKnockoutRuleNames(),
                StringComparer.OrdinalIgnoreCase);

            try
            {
                var ruleResults = await engine.ExecuteAllRulesAsync(labelName, ruleParams);

                var details = ruleResults.Select(r => new RuleEvaluationDetail(
                    r.Rule.RuleName,
                    r.IsSuccess,
                    r.IsSuccess ? null : (r.ExceptionMessage ?? r.Rule.ErrorMessage)
                )).ToList();

                var knockoutFails = details
                    .Where(d => !d.Passed && knockoutNames.Contains(d.RuleName))
                    .ToList();

                var passed = details.Count(d => d.Passed);
                var total = details.Count;
                var score = total > 0 ? (int)Math.Round((double)passed / total * 100) : 0;

                var recommendation = knockoutFails.Count == 0 ? "JA"
                    : knockoutFails.Count == 1 ? "TWIJFEL"
                    : "NEE";

                var reasoning = knockoutFails.Count == 0
                    ? $"Patiënt voldoet aan alle criteria voor {displayName}."
                    : $"Niet volledig passend: {string.Join("; ", knockoutFails.Select(d => d.Message ?? d.RuleName))}.";

                results.Add(new LabelMatchResult(
                    labelName,
                    displayName,
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
                    labelName, displayName, 0, false, "NEE",
                    new List<RuleEvaluationDetail>(), "Evaluatie mislukt."));
            }
        }

        var sorted = results.OrderByDescending(r => r.Score).ToList();
        var topLabel = sorted.FirstOrDefault(r => r.IsMatch)?.LabelName
                    ?? sorted.FirstOrDefault()?.LabelName;

        var overall = sorted.Any(r => r.IsMatch) ? "JA"
                    : sorted.Any(r => r.Recommendation == "TWIJFEL") ? "TWIJFEL"
                    : "NEE";

        return new LabelRankingResult(sorted, topLabel, overall);
    }

    private static LabelRankingResult FallbackResult() =>
        new(new List<LabelMatchResult>(), null, "TWIJFEL");
}
