namespace Forta.Match.Api.Models;

public class Patient
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Bsn { get; set; } = string.Empty;
    public string ContactDetails { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Referral> Referrals { get; set; } = new List<Referral>();
}
