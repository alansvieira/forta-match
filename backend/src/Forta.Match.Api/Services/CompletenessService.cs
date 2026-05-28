using Forta.Match.Api.Models;

namespace Forta.Match.Api.Services;

public class CompletenessService
{
    public (bool IsComplete, List<string> MissingFields) Validate(Referral referral, Patient patient)
    {
        var missing = new List<string>();

        if (string.IsNullOrWhiteSpace(patient.Name)) missing.Add("Name");
        if (string.IsNullOrWhiteSpace(patient.Bsn)) missing.Add("BSN");
        if (string.IsNullOrWhiteSpace(patient.ContactDetails) &&
            string.IsNullOrWhiteSpace(patient.Email) &&
            string.IsNullOrWhiteSpace(patient.Phone))
            missing.Add("Contact details");
        if (string.IsNullOrWhiteSpace(referral.ReferrerAgb)) missing.Add("AGB");
        if (!referral.ReferralDate.HasValue) missing.Add("Date");
        if (!referral.HasSignature) missing.Add("Signature");
        if (string.IsNullOrWhiteSpace(referral.ProbableDsm)) missing.Add("Probable DSM");
        if (string.IsNullOrWhiteSpace(referral.Complaint)) missing.Add("Complaint");
        if (string.IsNullOrWhiteSpace(referral.Location)) missing.Add("Location");

        return (missing.Count == 0, missing);
    }
}
