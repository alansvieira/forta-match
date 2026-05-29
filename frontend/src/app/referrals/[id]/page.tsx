"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { referralsApi, reviewApi, matchApi } from "@/lib/api";
import type { ReferralDetail } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { DecisionForm } from "@/components/DecisionForm";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/Skeleton";
import { Brain, Scale, User, ArrowLeft, Shield } from "lucide-react";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-slate-500">{label}</span>
      <span className="font-medium text-forta-primary-dark">{value ?? "—"}</span>
    </div>
  );
}

export default function ReferralDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [referral, setReferral] = useState<ReferralDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rerunLoading, setRerunLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    referralsApi.get(id).then(setReferral).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleValidate = async (action: "accept" | "reject") => {
    setActionLoading(true);
    try {
      await reviewApi.validate(id, { action, validatedBy: "Secretariat", reason: `Validated ${action}` });
      load();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !referral) return <PageSkeleton />;

  const canValidate = ["RecommendedYes", "RecommendedNo"].includes(referral.status);
  const showOverride = Boolean(referral.aiRecommendation && !referral.finalDecision);
  const needsScreening =
    referral.status === "RecommendedUncertain" || referral.aiRecommendation === "Uncertain";

  return (
    <div className="page-container max-w-5xl">
      <Link
        href="/referrals"
        className="mb-6 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-forta-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to referrals
      </Link>

      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-forta-primary-dark">{referral.patient.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge value={referral.status} />
          {referral.aiRecommendation && <StatusBadge value={referral.aiRecommendation} />}
          {referral.finalDecision && <StatusBadge value={referral.finalDecision} />}
          {referral.humanOverride && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 ring-1 ring-violet-600/20">
              <Shield className="h-3 w-3" />
              Human override
            </span>
          )}
        </div>
      </header>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-0 pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-forta-primary" />
              Patient
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="BSN" value={referral.patient.bsn} />
            <InfoRow label="Contact" value={referral.patient.contactDetails} />
            <InfoRow label="Location" value={referral.location} />
            <InfoRow label="Insurer" value={referral.insurer} />
            <InfoRow label="AGB" value={referral.referrerAgb} />
          </CardContent>
        </Card>

        {referral.extraction && (
          <Card>
            <CardHeader className="border-0 pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4 text-forta-primary" />
                AI extraction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="DSM" value={referral.extraction.probableDsm} />
              <InfoRow label="Symptoms" value={referral.extraction.symptoms} />
              <InfoRow label="Age" value={referral.extraction.age} />
              <InfoRow label="Risk" value={referral.extraction.riskLevel} />
              <InfoRow label="Region" value={referral.extraction.region} />
              <InfoRow label="Context" value={referral.extraction.context} />
            </CardContent>
          </Card>
        )}
      </div>

      {referral.extraction && (
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={rerunLoading}
            onClick={async () => {
              setRerunLoading(true);
              try {
                await matchApi.run(id);
                load();
              } finally {
                setRerunLoading(false);
              }
            }}
          >
            {rerunLoading ? "Re-evaluating..." : "Re-run AI Match"}
          </Button>
        </div>
      )}

      {referral.aiReasoning && (
        <Card className="mb-6 border-l-4 border-l-forta-primary">
          <CardHeader className="border-0 pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4 text-forta-primary" />
              AI recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-700">{referral.aiReasoning}</p>
            {canValidate && (
              <div className="mt-5 flex flex-wrap gap-3">
                <Button size="sm" variant="success" onClick={() => handleValidate("accept")} disabled={actionLoading}>
                  Validate & refer
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleValidate("reject")} disabled={actionLoading}>
                  Validate rejection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {needsScreening && (
        <div className="mb-6">
          <DecisionForm
            loading={actionLoading}
            onDecide={async (outcome, reason, requiresPhone) => {
              setActionLoading(true);
              try {
                await reviewApi.decide(id, { outcome, reason, decidedBy: "Screening Team", requiresPhoneContact: requiresPhone });
                load();
              } finally {
                setActionLoading(false);
              }
            }}
          />
        </div>
      )}

      {showOverride && (
        <div className="mb-6">
          <DecisionForm
            showOverride
            loading={actionLoading}
            onDecide={async () => {}}
            onOverride={async (outcome, reason) => {
              setActionLoading(true);
              try {
                await reviewApi.override(id, { outcome, reason, decidedBy: "Secretariat" });
                load();
              } finally {
                setActionLoading(false);
              }
            }}
          />
        </div>
      )}

      {referral.decisions.length > 0 && (
        <Card>
          <CardHeader className="border-0">
            <CardTitle>Decision history</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l-2 border-forta-border pl-6">
              {referral.decisions.map((d) => (
                <li key={d.id} className="relative">
                  <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-forta-primary ring-2 ring-forta-primary-soft" />
                  <p className="font-semibold text-forta-primary-dark">{d.decisionType}</p>
                  <p className="text-sm text-slate-600">
                    {d.outcome}
                    {d.reason && ` · ${d.reason}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(d.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
