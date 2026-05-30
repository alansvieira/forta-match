namespace Forta.Match.Api.Models;

public class EmailTemplate
{
    public Guid     Id          { get; set; } = Guid.NewGuid();
    public string   Name        { get; set; } = "";          // bijv. "intake_herinnering"
    public string   DisplayName { get; set; } = "";
    public string   Subject     { get; set; } = "";
    public string   Body        { get; set; } = "";          // HTML met {{variabelen}}
    public DateTime UpdatedAt   { get; set; } = DateTime.UtcNow;
}
