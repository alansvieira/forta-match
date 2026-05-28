using Forta.Match.Api.Data;
using Forta.Match.Api.DTOs;
using Forta.Match.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Forta.Match.Api.Services;

public class ReferralService
{
    private readonly FortaDbContext _db;

    public ReferralService(FortaDbContext db) => _db = db;

    public async Task<Referral?> GetWithDetailsAsync(Guid id, CancellationToken ct = default) =>
        await _db.Referrals
            .Include(r => r.Patient)
            .Include(r => r.Extraction)
            .Include(r => r.Decisions.OrderByDescending(d => d.CreatedAt))
            .FirstOrDefaultAsync(r => r.Id == id, ct);

    public async Task<List<ReferralSummaryDto>> ListAsync(string? status = null, CancellationToken ct = default)
    {
        var query = _db.Referrals.Include(r => r.Patient).AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ReferralStatus>(status, true, out var s))
            query = query.Where(r => r.Status == s);

        return await query
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReferralSummaryDto(
                r.Id,
                r.Patient.Name,
                r.Status.ToString(),
                r.AiRecommendation == Recommendation.None ? null : r.AiRecommendation.ToString(),
                r.FinalDecision == FinalDecision.None ? null : r.FinalDecision.ToString(),
                r.CreatedAt,
                r.Location,
                r.ProbableDsm ?? r.Extraction!.ProbableDsm
            ))
            .ToListAsync(ct);
    }

    public ReferralDetailDto ToDetailDto(Referral r) => new(
        r.Id,
        new PatientDto(r.Patient.Id, r.Patient.Name, r.Patient.Bsn, r.Patient.ContactDetails, r.Patient.Email, r.Patient.Phone),
        r.Status.ToString(),
        r.AiRecommendation == Recommendation.None ? null : r.AiRecommendation.ToString(),
        r.AiReasoning,
        r.FinalDecision == FinalDecision.None ? null : r.FinalDecision.ToString(),
        r.FinalReason,
        r.HumanOverride,
        r.RequiresPhoneContact,
        r.UploadedFileName,
        r.ReferrerAgb,
        r.ReferralDate,
        r.HasSignature,
        r.ProbableDsm,
        r.Complaint,
        r.Location,
        r.Insurer,
        r.Extraction == null ? null : new ExtractionDto(
            r.Extraction.ProbableDsm, r.Extraction.Symptoms, r.Extraction.Age,
            r.Extraction.RiskLevel, r.Extraction.Region, r.Extraction.Context),
        r.Decisions.Select(d => new DecisionDto(d.Id, d.DecisionType, d.Outcome.ToString(), d.Reason, d.DecidedBy, d.IsOverride, d.CreatedAt)).ToList(),
        r.CreatedAt,
        r.UpdatedAt
    );

    public async Task<DashboardStats> GetStatsAsync(CancellationToken ct = default)
    {
        var all = await _db.Referrals.ToListAsync(ct);
        return new DashboardStats(
            all.Count,
            all.Count(r => r.Status is ReferralStatus.Draft or ReferralStatus.Incomplete or ReferralStatus.Complete),
            all.Count(r => r.FinalDecision == FinalDecision.Accept || r.Status == ReferralStatus.ValidatedAccept),
            all.Count(r => r.FinalDecision == FinalDecision.Reject || r.Status == ReferralStatus.ValidatedReject),
            all.Count(r => r.AiRecommendation == Recommendation.Uncertain || r.Status == ReferralStatus.RecommendedUncertain),
            all.Count(r => r.Status == ReferralStatus.ScreeningReview)
        );
    }
}
