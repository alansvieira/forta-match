using Forta.Match.Api.Data;
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
        var parts = line.Split('=', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 2)
            Environment.SetEnvironmentVariable(parts[0].Trim(), parts[1].Trim());
    }
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<FortaDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Data Source=forta.db"));

builder.Services.AddHttpClient<MistralAiService>();
builder.Services.AddScoped<CompletenessService>();
builder.Services.AddScoped<RulesEngineService>();
builder.Services.AddScoped<ReferralService>();
builder.Services.AddScoped<MistralAiService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins("http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<FortaDbContext>();
    await db.Database.EnsureCreatedAsync();
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
