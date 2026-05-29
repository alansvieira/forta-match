import axios from "axios";
import type {
  CompletenessResult,
  DashboardStats,
  RecommendationResult,
  ReferralDetail,
  ReferralSummary,
  WorkflowRules,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5072";

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
};
