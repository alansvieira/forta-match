namespace Forta.Match.Api.Models;

public enum ReferralStatus
{
    Draft,
    Incomplete,
    Complete,
    Extracting,
    Extracted,
    Evaluating,
    RecommendedYes,
    RecommendedNo,
    RecommendedUncertain,
    ValidatedAccept,
    ValidatedReject,
    ScreeningReview,
    FinalizedAccept,
    FinalizedReject
}

public enum Recommendation
{
    None,
    Yes,
    No,
    Uncertain
}

public enum FinalDecision
{
    None,
    Accept,
    Reject
}
