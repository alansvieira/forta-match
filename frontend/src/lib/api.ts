import axios from "axios";
import type {
  CompletenessResult,
  DashboardStats,
  EmailNotification,
  EmailTemplate,
  GenerateRuleResponse,
  HumanFeedbackRequest,
  LabelRankingResult,
  PrescanResult,
  RecommendationResult,
  ReferralDetail,
  ReferralSummary,
  WorkflowRules,
} from "./types";

// Empty = same-origin /api/* proxied by next.config.mjs (avoids CORS in dev).
// Set NEXT_PUBLIC_API_URL=http://localhost:5072 only if you skip the proxy.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export const intakeApi = {
  upload: async (file: File, referralId?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (referralId) form.append("referralId", referralId);
    const { data } = await api.post("/api/intake/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data as { referralId: string; fileName: string; message: string };
  },
  register: async (body: Record<string, unknown>) => {
    const { data } = await api.post<ReferralDetail>("/api/intake/register", body);
    return data;
  },
  validate: async (referralId: string) => {
    const { data } = await api.post<CompletenessResult>(`/api/intake/${referralId}/validate`);
    return data;
  },
  prescan: async (referralId: string) => {
    const { data } = await api.post<PrescanResult>(`/api/intake/${referralId}/prescan`);
    return data;
  },
};

export const matchApi = {
  run: async (referralId: string) => {
    const { data } = await api.post<{ referralId: string; extraction: unknown; recommendation: RecommendationResult }>(
      `/api/match/${referralId}/run`
    );
    return data;
  },
  getRecommendation: async (referralId: string) => {
    const { data } = await api.get<RecommendationResult>(`/api/match/${referralId}/recommendation`);
    return data;
  },
  getRuleResults: async (referralId: string) => {
    const { data } = await api.get<RecommendationResult>(`/api/match/${referralId}/ruleresults`);
    return data;
  },
  getLabelRanking: async (referralId: string) => {
    const { data } = await api.get<LabelRankingResult>(`/api/match/${referralId}/labelrank`);
    return data;
  },
  submitFeedback: async (referralId: string, feedback: HumanFeedbackRequest) => {
    const { data } = await api.post(`/api/match/${referralId}/feedback`, feedback);
    return data;
  },
};

export const reviewApi = {
  queue: async () => {
    const { data } = await api.get<ReferralSummary[]>("/api/review/queue");
    return data;
  },
  decide: async (referralId: string, body: { outcome: string; reason: string; decidedBy?: string; requiresPhoneContact?: boolean }) => {
    const { data } = await api.post<ReferralDetail>(`/api/review/${referralId}/decide`, body);
    return data;
  },
  override: async (referralId: string, body: { outcome: string; reason: string; decidedBy?: string }) => {
    const { data } = await api.post<ReferralDetail>(`/api/review/${referralId}/override`, body);
    return data;
  },
  forwardScreenteam: async (referralId: string, reason?: string) => {
    const { data } = await api.post<ReferralDetail>(`/api/review/${referralId}/forward-screenteam`, {
      reason: reason ?? "Twijfelgeval — doorgestuurd naar screenteam",
      decidedBy: "Secretariaat",
    });
    return data;
  },
  validate: async (referralId: string, body: { action: string; validatedBy?: string; reason?: string }) => {
    const { data } = await api.post<ReferralDetail>(`/api/review/${referralId}/validate`, body);
    return data;
  },
};

export const referralsApi = {
  list: async (status?: string) => {
    const { data } = await api.get<ReferralSummary[]>("/api/referrals", { params: { status } });
    return data;
  },
  get: async (id: string) => {
    const { data } = await api.get<ReferralDetail>(`/api/referrals/${id}`);
    return data;
  },
  stats: async () => {
    const { data } = await api.get<DashboardStats>("/api/referrals/stats");
    return data;
  },
  feedbackStats: async () => {
    const { data } = await api.get<{
      total: number; agreed: number; deviated: number;
      agreementPct: number; recent: boolean[];
    }>("/api/referrals/feedback-stats");
    return data;
  },
  saveExtractionCorrection: async (id: string, field: string, originalValue: string | null, correctedValue: string) => {
    await api.post(`/api/referrals/${id}/extraction-correction`, { field, originalValue, correctedValue });
  },
  saveDeviationFeedback: async (id: string, aiAdvice: string, humanDecision: string, reason: string) => {
    await api.post(`/api/referrals/${id}/deviation-feedback`, { aiAdvice, humanDecision, reason });
  },
};

export const notificationsApi = {
  list:         async (unreadOnly = false) => {
    const { data } = await api.get<EmailNotification[]>("/api/notifications", { params: { unreadOnly } });
    return data;
  },
  unreadCount:  async () => {
    const { data } = await api.get<number>("/api/notifications/unread-count");
    return data;
  },
  markRead:     async (id: string) => api.post(`/api/notifications/${id}/read`),
  clearAll:     async () => api.delete("/api/notifications/clear"),
  createIntake: async (id: string) => {
    const { data } = await api.post<{ referralId: string; prescan: import("./types").PrescanResult }>(`/api/notifications/${id}/create-intake`);
    return data;
  },
  addTest:      async () => {
    const { data } = await api.post<EmailNotification>("/api/notifications/test");
    return data;
  },
};

export const emailApi = {
  send: async (to: string, subject: string, body: string, templateName?: string) => {
    const { data } = await api.post("/api/email/send", { to, subject, body, templateName });
    return data;
  },
  getTemplates: async () => {
    const { data } = await api.get<EmailTemplate[]>("/api/email/templates");
    return data;
  },
  getTemplate: async (name: string) => {
    const { data } = await api.get<EmailTemplate>(`/api/email/templates/${name}`);
    return data;
  },
  updateTemplate: async (name: string, subject: string, body: string) => {
    const { data } = await api.put<EmailTemplate>(`/api/email/templates/${name}`, { subject, body });
    return data;
  },
};

export const rulesApi = {
  list: async () => {
    const { data } = await api.get<WorkflowRules[]>("/api/rules");
    return data;
  },
  get: async (workflowName: string) => {
    const { data } = await api.get<WorkflowRules>(`/api/rules/${workflowName}`);
    return data;
  },
  update: async (workflowName: string, rulesJson: string) => {
    const { data } = await api.put<WorkflowRules>(`/api/rules/${workflowName}`, { rulesJson });
    return data;
  },
  test: async (workflowName: string, sampleInput: object) => {
    const { data } = await api.post<{ recommendation: string; ruleResults: RecommendationResult["ruleResults"] }>(
      "/api/rules/test",
      { workflowName, sampleInput }
    );
    return data;
  },
  generate: async (description: string, workflowName: string) => {
    const { data } = await api.post<GenerateRuleResponse>("/api/rules/generate", { description, workflowName });
    return data;
  },
};
