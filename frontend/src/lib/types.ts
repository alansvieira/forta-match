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

export interface PrescanField {
  value: string;
  confidence: number;
}

export interface PrescanResult {
  referralId: string;
  name:            PrescanField | null;
  bsn:             PrescanField | null;
  contactDetails:  PrescanField | null;
  email:           PrescanField | null;
  phone:           PrescanField | null;
  referrerAgb:     PrescanField | null;
  referralDate:    PrescanField | null;
  hasSignature:    PrescanField | null;
  probableDsm:     PrescanField | null;
  complaint:       PrescanField | null;
  location:        PrescanField | null;
  insurer:         PrescanField | null;
  letterText:      string | null;
  /** mistral = LLM; local = rule-based from letter text */
  aiSource?:       "mistral" | "local";
  aiMessage?:      string | null;
}

export interface GenerateRuleResponse {
  ruleName:    string;
  ruleJson:    string;
  explanation: string;
  success:     boolean;
  error:       string | null;
}

// ── Pilot 1a types ───────────────────────────────────────────────────────────

export interface LabelMatchResult {
  labelName:      string;
  displayName:    string;
  score:          number;
  isMatch:        boolean;
  recommendation: "JA" | "TWIJFEL" | "NEE";
  ruleResults:    { ruleName: string; passed: boolean; message: string | null }[];
  reasoning:      string | null;
}

export interface LabelRankingResult {
  labels:                 LabelMatchResult[];
  topLabel:               string | null;
  overallRecommendation:  string;
}

export interface LabelSummary {
  workflowName:      string;
  displayName:       string;
  sortOrder:         number;
  knockoutRuleNames: string[];
  ruleCount:         number;
}

export interface LabelCatalog {
  rulesJson:  string;
  updatedAt:  string | null;
  labels:     LabelSummary[];
}

// ── Email / notifications ─────────────────────────────────────────────────────

export interface EmailNotification {
  id:          string;
  subject:     string;
  fromEmail:   string;
  fromName:    string;
  body:        string;
  isRead:      boolean;
  isProcessed: boolean;
  referralId:  string | null;
  receivedAt:  string;
}

export interface EmailTemplate {
  id:          string;
  name:        string;
  displayName: string;
  subject:     string;
  body:        string;
  updatedAt:   string;
}

export interface HumanFeedbackRequest {
  chosenLabel:  string;
  outcome:      string;
  reasoning:    string;
  agreedWithAi: boolean;
  decidedBy?:   string;
}
