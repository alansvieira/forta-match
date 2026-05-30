"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { reviewApi } from "@/lib/api";
import type { ReferralSummary } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { PageSkeleton } from "@/components/Skeleton";
import { AlertCircle, Brain, ChevronRight, Inbox, MapPin, Phone } from "lucide-react";

export default function ReviewPage() {
  const [queue,   setQueue]   = useState<ReferralSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reviewApi.queue().then(setQueue).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="page-container">
      <PageHeader
        title="Screenteam"
        description="Twijfelgevallen waarbij de AI geen duidelijk JA of NEE kon geven — menselijke beoordeling vereist."
      />

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>
          <strong>~40% van alle aanmeldingen</strong> gaat naar het screenteam voor telefonisch contact.
          Het screenteam beslist, secretariaat krijgt terugkoppeling.
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-forta-border py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forta-muted">
            <Inbox className="h-8 w-8 text-slate-300" />
          </div>
          <p className="mt-4 font-semibold text-slate-600">Wachtrij is leeg</p>
          <p className="mt-1 text-sm text-slate-500">Geen twijfelgevallen op dit moment</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {queue.length} {queue.length === 1 ? "geval" : "gevallen"} in wachtrij
          </p>
          {queue.map(r => (
            <Link
              key={r.id}
              href={`/referrals/${r.id}`}
              className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-l-4 border-l-amber-400 bg-white px-5 py-4 shadow-card transition-all hover:shadow-card-hover hover:border-forta-primary/30"
            >
              {/* Avatar */}
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-sm font-bold text-amber-700">
                {r.patientName.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-forta-primary-dark group-hover:text-forta-primary">
                  {r.patientName}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-500">
                  {r.location && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" /> {r.location}
                    </span>
                  )}
                  {r.probableDsm && (
                    <span className="flex items-center gap-0.5">
                      <Brain className="h-3 w-3" /> {r.probableDsm}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-medium text-amber-600">
                    <Phone className="h-3 w-3" /> Telefonisch contact aanbevolen
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge value="UNCERTAIN" />
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-forta-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
