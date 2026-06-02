using System.Text.Json;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Forta.Match.Api.Controllers;

[ApiController]
[Route("api/labels")]
public class LabelsConfigController : ControllerBase
{
    private readonly LabelCatalogStore _catalog;
    private readonly LabelMatchingService _labelMatching;

    public LabelsConfigController(LabelCatalogStore catalog, LabelMatchingService labelMatching)
    {
        _catalog = catalog;
        _labelMatching = labelMatching;
    }

    [HttpGet]
    public async Task<ActionResult<LabelCatalogDto>> Get(CancellationToken ct)
    {
        var json = await _catalog.GetRulesJsonAsync(ct);
        var updatedAt = await _catalog.GetUpdatedAtAsync(ct);
        var labels = await _labelMatching.GetCatalogSummaryAsync(ct);
        return Ok(new LabelCatalogDto(json, updatedAt, labels));
    }

    [HttpPut]
    public async Task<ActionResult<LabelCatalogDto>> Update(
        [FromBody] UpdateLabelCatalogRequest request,
        CancellationToken ct)
    {
        try
        {
            JsonDocument.Parse(request.RulesJson);
        }
        catch
        {
            return BadRequest("Invalid JSON");
        }

        await _catalog.SaveRulesJsonAsync(request.RulesJson, ct);
        await _labelMatching.ReloadAsync(ct);

        var updatedAt = await _catalog.GetUpdatedAtAsync(ct);
        var labels = await _labelMatching.GetCatalogSummaryAsync(ct);
        return Ok(new LabelCatalogDto(request.RulesJson, updatedAt, labels));
    }

    [HttpPost("reload")]
    public async Task<ActionResult<LabelCatalogDto>> Reload(CancellationToken ct)
    {
        await _catalog.SyncFromFileIfNewerAsync(ct);
        await _labelMatching.ReloadAsync(ct);
        var json = await _catalog.GetRulesJsonAsync(ct);
        var updatedAt = await _catalog.GetUpdatedAtAsync(ct);
        var labels = await _labelMatching.GetCatalogSummaryAsync(ct);
        return Ok(new LabelCatalogDto(json, updatedAt, labels));
    }

    /// <summary>Test label catalog against sample extraction (optional unsaved rulesJson).</summary>
    [HttpPost("test")]
    public async Task<ActionResult<LabelRankingResult>> Test(
        [FromBody] TestLabelCatalogRequest request,
        CancellationToken ct)
    {
        var input = JsonSerializer.Deserialize<RulesEvaluationInput>(
            JsonSerializer.Serialize(request.SampleInput),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? new RulesEvaluationInput();

        if (!string.IsNullOrWhiteSpace(request.RulesJson))
        {
            try
            {
                JsonDocument.Parse(request.RulesJson);
            }
            catch
            {
                return BadRequest("Invalid rules JSON");
            }

            var result = await _labelMatching.EvaluateCatalogJsonAsync(request.RulesJson, input, ct);
            return Ok(result);
        }

        var live = await _labelMatching.EvaluateAllLabelsAsync(input, ct);
        return Ok(live);
    }
}
