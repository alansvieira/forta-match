using Forta.Match.Api.Data;
using Forta.Match.Api.Models;
using Forta.Match.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration
    .AddJsonFile("appsettings.json", optional: false)
    .AddJsonFile("appsettings.Development.json", optional: true)
    .AddEnvironmentVariables();

var configEnvPath = Path.Combine(builder.Environment.ContentRootPath, "..", "..", "..", "config", ".env");
if (!File.Exists(configEnvPath))
    configEnvPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "config", ".env");
if (!File.Exists(configEnvPath))
    configEnvPath = Path.Combine(builder.Environment.ContentRootPath, "..", "..", "config", ".env");

if (File.Exists(configEnvPath))
{
    foreach (var line in File.ReadAllLines(configEnvPath))
    {
        if (line.TrimStart().StartsWith('#')) continue;
        var parts = line.Split('=', 2);
        if (parts.Length != 2) continue;
        var key = parts[0].Trim();
        var value = parts[1].Trim().Trim('"');
        if (string.IsNullOrEmpty(key)) continue;
        Environment.SetEnvironmentVariable(key, value);
        if (key == "MISTRAL_API_KEY" && !string.IsNullOrWhiteSpace(value))
            builder.Configuration["Mistral:ApiKey"] = value;
    }
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<FortaDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Data Source=forta.db"));

builder.Services.AddHttpClient<MistralAiService>();
builder.Services.AddScoped<DocumentTextExtractor>();
builder.Services.AddScoped<CompletenessService>();
builder.Services.AddScoped<RulesEngineService>();
builder.Services.AddScoped<ReferralService>();
builder.Services.AddScoped<MistralAiService>();
builder.Services.AddSingleton<LabelMatchingService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddHostedService<GmailPollingService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(
                "http://localhost:3000",
                "http://127.0.0.1:3000")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

var mistralKey = app.Configuration["Mistral:ApiKey"]
                 ?? Environment.GetEnvironmentVariable("MISTRAL_API_KEY");
if (string.IsNullOrWhiteSpace(mistralKey))
    app.Logger.LogWarning(
        "MISTRAL_API_KEY is not set (config/.env). Intake prescan uses local letter parsing, not Mistral AI.");
else
    app.Logger.LogInformation("Mistral AI configured for extraction and prescan.");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<FortaDbContext>();
    await db.Database.EnsureCreatedAsync();

    // Nieuwe tabellen aanmaken als ze nog niet bestaan (voor bestaande DB)
    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""EmailNotifications"" (
            ""Id""                  TEXT NOT NULL CONSTRAINT ""PK_EmailNotifications"" PRIMARY KEY,
            ""Subject""             TEXT NOT NULL,
            ""FromEmail""           TEXT NOT NULL,
            ""FromName""            TEXT NOT NULL,
            ""Body""                TEXT NOT NULL,
            ""HtmlBody""            TEXT NULL,
            ""AttachmentFileName""  TEXT NULL,
            ""AttachmentPath""      TEXT NULL,
            ""IsRead""              INTEGER NOT NULL DEFAULT 0,
            ""IsProcessed""         INTEGER NOT NULL DEFAULT 0,
            ""ReferralId""          TEXT NULL,
            ""ReceivedAt""          TEXT NOT NULL
        );");

    // Voeg nieuwe kolommen toe als de tabel al bestond zonder ze
    try { await db.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""EmailNotifications"" ADD COLUMN ""AttachmentFileName"" TEXT NULL"); } catch { }
    try { await db.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""EmailNotifications"" ADD COLUMN ""AttachmentPath"" TEXT NULL"); } catch { }

    await db.Database.ExecuteSqlRawAsync(@"
        CREATE TABLE IF NOT EXISTS ""EmailTemplates"" (
            ""Id""          TEXT NOT NULL CONSTRAINT ""PK_EmailTemplates"" PRIMARY KEY,
            ""Name""        TEXT NOT NULL,
            ""DisplayName"" TEXT NOT NULL,
            ""Subject""     TEXT NOT NULL,
            ""Body""        TEXT NOT NULL,
            ""UpdatedAt""   TEXT NOT NULL
        );");

    // Seed standaard e-mailtemplates
    if (!await db.EmailTemplates.AnyAsync())
    {
        db.EmailTemplates.AddRange(
            new EmailTemplate
            {
                Name        = "intake_herinnering",
                DisplayName = "Herinnering onvolledige intake",
                Subject     = "Verwijsbrief incompleet — aanvullende informatie vereist",
                Body        = """
                    <p>Geachte {{naam_verwijzer}},</p>

                    <p>Wij hebben uw verwijsbrief voor <strong>{{naam_patiënt}}</strong> ontvangen.
                    Helaas kunnen wij de aanmelding nog niet verwerken omdat de volgende gegevens ontbreken:</p>

                    <ul>
                    {{ontbrekende_velden}}
                    </ul>

                    <p>Wilt u deze informatie zo spoedig mogelijk aanvullen zodat wij de aanmelding
                    kunnen beoordelen? U kunt uw verwijsbrief aanvullen via uw zorgportaal of
                    contact opnemen via dit e-mailadres.</p>

                    <p>Met vriendelijke groet,<br/>
                    <strong>Forta Match — Secretariaat</strong></p>
                    """,
                UpdatedAt = DateTime.UtcNow,
            },
            new EmailTemplate
            {
                Name        = "aanmelding_geaccepteerd",
                DisplayName = "Aanmelding geaccepteerd",
                Subject     = "Uw verwijzing voor {{naam_patiënt}} is geaccepteerd",
                Body        = """
                    <p>Geachte {{naam_verwijzer}},</p>

                    <p>Wij informeren u dat de verwijzing voor <strong>{{naam_patiënt}}</strong>
                    is beoordeeld en geaccepteerd door Forta Match.</p>

                    <p>De patiënt wordt zo spoedig mogelijk gecontacteerd voor een intakegesprek.</p>

                    <p>Met vriendelijke groet,<br/>
                    <strong>Forta Match — Secretariaat</strong></p>
                    """,
                UpdatedAt = DateTime.UtcNow,
            },
            new EmailTemplate
            {
                Name        = "aanmelding_afgewezen",
                DisplayName = "Aanmelding afgewezen",
                Subject     = "Verwijzing {{naam_patiënt}} — buiten behandelkader",
                Body        = """
                    <p>Geachte {{naam_verwijzer}},</p>

                    <p>Helaas kunnen wij de verwijzing voor <strong>{{naam_patiënt}}</strong>
                    niet accepteren. De hulpvraag valt buiten ons behandelkader om de volgende reden:</p>

                    <p><em>{{reden}}</em></p>

                    <p>Wij adviseren u de patiënt door te verwijzen naar een passende zorgaanbieder.</p>

                    <p>Met vriendelijke groet,<br/>
                    <strong>Forta Match — Secretariaat</strong></p>
                    """,
                UpdatedAt = DateTime.UtcNow,
            }
        );
        await db.SaveChangesAsync();
    }

    var rulesEngine = scope.ServiceProvider.GetRequiredService<RulesEngineService>();
    await rulesEngine.ReloadAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseStaticFiles();
app.MapControllers();

app.Run();
