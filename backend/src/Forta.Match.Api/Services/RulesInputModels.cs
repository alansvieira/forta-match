namespace Forta.Match.Api.Services;

public class ExtractionInput
{
    public string? ProbableDsm { get; set; }
    public string? Symptoms { get; set; }
    public int? Age { get; set; }
    public string? RiskLevel { get; set; }
    public string? Region { get; set; }
    public string? Context { get; set; }
}

public class CapacityInput
{
    public int AvailableSlots { get; set; } = 5;
    public int WaitingWeeks { get; set; } = 8;
}

public class InsurerInput
{
    public bool IsCovered { get; set; } = true;
    public decimal CapRemaining { get; set; } = 10000;
}

public class RulesEvaluationInput
{
    public ExtractionInput extraction { get; set; } = new();
    public CapacityInput capacity { get; set; } = new();
    public InsurerInput insurer { get; set; } = new();
}
