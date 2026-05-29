"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { reviewApi } from "@/lib/api";
import type { ReferralSummary } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/Skeleton";
import { ClipboardCheck, ChevronRight, Inbox } from "lucide-react";

export default function ReviewPage() {
  const [queue, setQueue] = useState<ReferralSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reviewApi.queue().then(setQueue).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="page-container">
      <PageHeader
        title="Screening team"
        description="Phase 3 — Review uncertain cases. Phone contact needed for ~40% of complex referrals."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-forta-primary" />
            Uncertain cases queue
          </CardTitle>
          <CardDescription>AI could not reach a confident YES or NO recommendation</CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forta-muted">
                <Inbox className="h-8 w-8 text-slate-300" />
              </div>
              <p className="mt-4 font-medium text-slate-600">Queue is empty</p>
              <p className="mt-1 text-sm text-slate-500">No cases awaiting screening review</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((r) => (
                <Link
                  key={r.id}
                  href={`/referrals/${r.id}`}
                  className="group flex cursor-pointer items-center justify-between rounded-xl border border-forta-border p-5 transition-colors duration-200 hover:border-forta-primary/30 hover:bg-forta-primary-soft/40 hover:shadow-card"
                >
                  <div>
                    <p className="font-heading text-lg font-semibold text-forta-primary-dark group-hover:text-forta-primary">
                      {r.patientName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {r.location ?? "Unknown location"} · DSM {r.probableDsm ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge value={r.aiRecommendation ?? "UNCERTAIN"} />
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-forta-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
