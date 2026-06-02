using Forta.Match.Api.Data;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Models;
using Forta.Match.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Forta.Match.Api.Controllers;

[ApiController]
[Route("api/rules")]
public class RulesConfigController : ControllerBase
{
    private readonly FortaDbContext _db;
    private readonly RulesEngineService _rulesEngine;

    public RulesConfigController(FortaDbContext db, RulesEngineService rulesEngine)
    {
        _db = db;
        _rulesEngine = rulesEngine;
    }

    [HttpGet]
    public async Task<ActionResult<List<WorkflowRulesDto>>> List(CancellationToken ct)
    {
        var configs = await _db.RuleConfigurations.Where(r => r.IsActive).ToListAsync(ct);
        return Ok(configs.Select(c => new WorkflowRulesDto(c.WorkflowName, c.RulesJson, c.UpdatedAt)).ToList());
    }

    [HttpGet("{workflowName}")]
    public async Task<ActionResult<WorkflowRulesDto>> Get(string workflowName, CancellationToken ct)
    {
        var config = await _db.RuleConfigurations.FirstOrDefaultAsync(r => r.WorkflowName == workflowName, ct);
        if (config == null) return NotFound();
        return Ok(new WorkflowRulesDto(config.WorkflowName, config.RulesJson, config.UpdatedAt));
    }

    [HttpPut("{workflowName}")]
    public async Task<ActionResult<WorkflowRulesDto>> Update(string workflowName, [FromBody] UpdateWorkflowRulesRequest request, CancellationToken ct)
    {
        try
        {
            JsonDocument.Parse(request.RulesJson);
        }
        catch
        {
            return BadRequest("Invalid JSON");
        }

        var config = await _db.RuleConfigurations.FirstOrDefaultAsync(r => r.WorkflowName == workflowName, ct);
        if (config == null)
        {
            config = new RuleConfiguration { WorkflowName = workflowName, RulesJson = request.RulesJson };
            _db.RuleConfigurations.Add(config);
        }
        else
        {
            config.RulesJson = request.RulesJson;
            config.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        await _rulesEngine.ReloadAsync(ct);

        return Ok(new WorkflowRulesDto(config.WorkflowName, config.RulesJson, config.UpdatedAt));
    }

    [HttpPost("generate")]
    public async Task<ActionResult<GenerateRuleResponse>> Generate([FromBody] GenerateRuleRequest request, CancellationToken ct)
    {
        var config       = await _db.RuleConfigurations.FirstOrDefaultAsync(r => r.WorkflowName == request.WorkflowName, ct);
        var currentRules = config?.RulesJson ?? "[]";

        var mistral = HttpContext.RequestServices.GetRequiredService<MistralAiService>();
        var result  = await mistral.GenerateRuleAsync(request.Description, currentRules, ct);
        return Ok(result);
    }

    [HttpPost("test")]
    public async Task<ActionResult<TestRulesResult>> Test([FromBody] TestRulesRequest request, CancellationToken ct)
    {
        var input = JsonSerializer.Deserialize<RulesEvaluationInput>(
            JsonSerializer.Serialize(request.SampleInput),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? new RulesEvaluationInput();

        var result = await _rulesEngine.TestRulesAsync(request.WorkflowName, input, ct);
        return Ok(new TestRulesResult(result.Recommendation, result.RuleResults));
    }

    [HttpPost("preview")]
    public async Task<ActionResult<PreviewRulesResult>> Preview([FromBody] PreviewRulesRequest request, CancellationToken ct = default)
    {
        try
        {
            JsonDocument.Parse(request.RulesJson);
        }
        catch
        {
            return BadRequest("Invalid rules JSON");
        }

        var input = JsonSerializer.Deserialize<RulesEvaluationInput>(
            JsonSerializer.Serialize(request.SampleInput),
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? new RulesEvaluationInput();

        var results = await _rulesEngine.PreviewRulesAsync(
            request.RulesJson, request.WorkflowName, input, ct);

        return Ok(new PreviewRulesResult(results));
    }
}
