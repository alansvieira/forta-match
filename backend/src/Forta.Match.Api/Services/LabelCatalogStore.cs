using System.Text.Json;
using Forta.Match.Api.Data;
using Forta.Match.Api.Models;
using Microsoft.EntityFrameworkCore;
using RulesEngine.Models;

namespace Forta.Match.Api.Services;

/// <summary>
/// Loads and persists label catalog JSON (DB primary, file fallback).
/// </summary>
public class LabelCatalogStore
{
    public const string CatalogWorkflowName = "LabelCatalog";

    private readonly FortaDbContext _db;
    private readonly ILogger<LabelCatalogStore> _logger;

    public LabelCatalogStore(FortaDbContext db, ILogger<LabelCatalogStore> logger)
    {
        _db = db;
        _logger = logger;
    }

    public static string GetDefaultFilePath()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Config", "label-rules.json");
        if (File.Exists(path)) return path;
        return Path.Combine(Directory.GetCurrentDirectory(), "Config", "label-rules.json");
    }

    public async Task<string> GetRulesJsonAsync(CancellationToken ct = default)
    {
        await SyncFromFileIfNewerAsync(ct);

        var config = await _db.RuleConfigurations
            .FirstOrDefaultAsync(r => r.WorkflowName == CatalogWorkflowName && r.IsActive, ct);

        if (config != null && !string.IsNullOrWhiteSpace(config.RulesJson))
            return config.RulesJson;

        var filePath = GetDefaultFilePath();
        if (File.Exists(filePath))
        {
            var json = await File.ReadAllTextAsync(filePath, ct);
            await EnsureDbSeedAsync(json, ct);
            return json;
        }

        return "[]";
    }

    /// <summary>
    /// Imports label-rules.json into the DB when the file on disk is newer than the stored catalog.
    /// </summary>
    public async Task<bool> SyncFromFileIfNewerAsync(CancellationToken ct = default)
    {
        var filePath = GetDefaultFilePath();
        if (!File.Exists(filePath))
            return false;

        var fileTime = File.GetLastWriteTimeUtc(filePath);
        var fileJson = await File.ReadAllTextAsync(filePath, ct);

        var config = await _db.RuleConfigurations
            .FirstOrDefaultAsync(r => r.WorkflowName == CatalogWorkflowName, ct);

        if (config == null)
        {
            await EnsureDbSeedAsync(fileJson, ct);
            return true;
        }

        var dbTime = config.UpdatedAt;
        var contentDiffers = !string.Equals(
            NormalizeJson(fileJson),
            NormalizeJson(config.RulesJson),
            StringComparison.Ordinal);

        if (fileTime > dbTime && contentDiffers)
        {
            _logger.LogInformation(
                "Importing newer label-rules.json (file {FileTime:o} > db {DbTime:o})",
                fileTime, dbTime);
            await SaveRulesJsonAsync(fileJson, ct);
            return true;
        }

        return false;
    }

    private static string NormalizeJson(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return JsonSerializer.Serialize(doc);
        }
        catch
        {
            return json.Trim();
        }
    }

    public async Task<DateTime?> GetUpdatedAtAsync(CancellationToken ct = default)
    {
        var config = await _db.RuleConfigurations
            .FirstOrDefaultAsync(r => r.WorkflowName == CatalogWorkflowName, ct);
        return config?.UpdatedAt;
    }

    public async Task SaveRulesJsonAsync(string rulesJson, CancellationToken ct = default)
    {
        JsonDocument.Parse(rulesJson);

        var config = await _db.RuleConfigurations
            .FirstOrDefaultAsync(r => r.WorkflowName == CatalogWorkflowName, ct);

        if (config == null)
        {
            config = new RuleConfiguration
            {
                WorkflowName = CatalogWorkflowName,
                RulesJson = rulesJson,
                IsActive = true
            };
            _db.RuleConfigurations.Add(config);
        }
        else
        {
            config.RulesJson = rulesJson;
            config.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        var filePath = GetDefaultFilePath();
        try
        {
            var dir = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
            await File.WriteAllTextAsync(filePath, rulesJson, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not write label-rules.json to {Path}", filePath);
        }
    }

    private async Task EnsureDbSeedAsync(string json, CancellationToken ct)
    {
        var exists = await _db.RuleConfigurations
            .AnyAsync(r => r.WorkflowName == CatalogWorkflowName, ct);
        if (exists) return;

        _db.RuleConfigurations.Add(new RuleConfiguration
        {
            WorkflowName = CatalogWorkflowName,
            RulesJson = json,
            IsActive = true
        });
        await _db.SaveChangesAsync(ct);
    }

    public static List<LabelWorkflowConfig> ParseCatalog(string json)
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var list = JsonSerializer.Deserialize<List<LabelWorkflowConfig>>(json, options) ?? [];
        return list
            .Where(w => !string.IsNullOrWhiteSpace(w.WorkflowName))
            .OrderBy(w => w.SortOrder)
            .ThenBy(w => w.WorkflowName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>
    /// Deserialize workflows the same way as ReferralMatch rules (full Rule graph from JSON).
    /// </summary>
    public static Workflow[] ToRulesEngineWorkflows(string json)
    {
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        return JsonSerializer.Deserialize<Workflow[]>(json, options) ?? [];
    }
}
