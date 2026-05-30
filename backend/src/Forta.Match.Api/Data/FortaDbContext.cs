using Forta.Match.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Forta.Match.Api.Data;

public class FortaDbContext : DbContext
{
    public FortaDbContext(DbContextOptions<FortaDbContext> options) : base(options) { }

    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Referral> Referrals => Set<Referral>();
    public DbSet<Extraction> Extractions => Set<Extraction>();
    public DbSet<Decision> Decisions => Set<Decision>();
    public DbSet<RuleConfiguration> RuleConfigurations => Set<RuleConfiguration>();
    public DbSet<EmailNotification> EmailNotifications => Set<EmailNotification>();
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Patient>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Name).HasMaxLength(200);
            e.Property(p => p.Bsn).HasMaxLength(20);
        });

        modelBuilder.Entity<Referral>(e =>
        {
            e.HasKey(r => r.Id);
            e.HasOne(r => r.Patient).WithMany(p => p.Referrals).HasForeignKey(r => r.PatientId);
            e.HasOne(r => r.Extraction).WithOne(x => x.Referral).HasForeignKey<Extraction>(x => x.ReferralId);
            e.HasMany(r => r.Decisions).WithOne(d => d.Referral).HasForeignKey(d => d.ReferralId);
        });

        modelBuilder.Entity<RuleConfiguration>(e =>
        {
            e.HasKey(r => r.Id);
            e.HasIndex(r => r.WorkflowName).IsUnique();
        });
    }
}
