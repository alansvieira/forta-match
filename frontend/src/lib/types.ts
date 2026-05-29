export interface ReferralSummary {
  id: string;
  patientName: string;
  status: string;
  aiRecommendation: string | null;
  finalDecision: string | null;
  createdAt: string;
  location: string | null;
  probableDsm: string | null;
}

export interface Extraction {
  probableDsm: string | null;
  symptoms: string | null;
  age: number | null;
  riskLevel: string | null;
  region: string | null;
  context: string | null;
}

export interface Decision {
  id: string;
  decisionType: string;
  outcome: string;
  reason: string | null;
  decidedBy: string | null;
  isOverride: boolean;
  createdAt: string;
}

export interface ReferralDetail {
  id: string;
  patient: {
    id: string;
    name: string;
    bsn: string;
    contactDetails: string;
    email: string | null;
    phone: string | null;
  };
  status: string;
  aiRecommendation: string | null;
  aiReasoning: string | null;
  finalDecision: string | null;
  finalReason: string | null;
  humanOverride: boolean;
  requiresPhoneContact: boolean;
  uploadedFileName: string | null;
  referrerAgb: string | null;
  referralDate: string | null;
  hasSignature: boolean;
  probableDsm: string | null;
  complaint: string | null;
  location: string | null;
  insurer: string | null;
  extraction: Extraction | null;
  decisions: Decision[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  uncertain: number;
  inReview: number;
}

export interface CompletenessResult {
  isComplete: boolean;
  missingFields: string[];
  referralId: string;
}

export interface RecommendationResult {
  recommendation: string;
  reasoning: string;
  ruleResults: { ruleName: string; passed: boolean; message: string | null }[];
}

export interface WorkflowRules {
  workflowName: string;
  rulesJson: string;
  updatedAt: string;
}
