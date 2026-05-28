using Forta.Match.Api.DTOs;
using Forta.Match.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Forta.Match.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReferralsController : ControllerBase
{
    private readonly ReferralService _referrals;

    public ReferralsController(ReferralService referrals) => _referrals = referrals;

    [HttpGet]
    public async Task<ActionResult<List<ReferralSummaryDto>>> List([FromQuery] string? status, CancellationToken ct) =>
        Ok(await _referrals.ListAsync(status, ct));

    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStats>> Stats(CancellationToken ct) =>
        Ok(await _referrals.GetStatsAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ReferralDetailDto>> Get(Guid id, CancellationToken ct)
    {
        var referral = await _referrals.GetWithDetailsAsync(id, ct);
        if (referral == null) return NotFound();
        return Ok(_referrals.ToDetailDto(referral));
    }
}
