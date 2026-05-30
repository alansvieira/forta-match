"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { referralsApi } from "@/lib/api";
import type { ReferralSummary } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { PageSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import {
  FileUp, Search, Brain, MapPin, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = [
  { label: "Alle",        value: "" },
  { label: "Aanbevolen",  value: "RecommendedYes"       },
  { label: "Twijfel",     value: "RecommendedUncertain" },
  { label: "Afgeraden",   value: "RecommendedNo"        },
  { label: "In review",   value: "ScreeningReview"      },
  { label: "Incompleet",  value: "Incomplete"           },
];

function aiColor(rec: string | null) {
  if (!rec) return "";
  if (rec.toLowerCase().includes("yes")) return "border-l-emerald-400";
  if (rec.toLowerCase().includes("no"))  return "border-l-red-400";
  if (rec.toLowerCase().includes("uncertain")) return "border-l-amber-400";
  return "border-l-slate-200";
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<ReferralSummary[]>([]);
  const [filter,    setFilter]    = useState("");
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    referralsApi.list().then(setReferrals).finally(() => setLoading(false));
  }, []);

  const filtered = referrals.filter(r => {
    const matchesFilter = !filter || r.status === filter || r.aiRecommendation === filter;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      r.patientName.toLowerCase().includes(q) ||
      (r.location ?? "").toLowerCase().includes(q) ||
      (r.probableDsm ?? "").toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  if (loading) return <PageSkeleton />;

  return (
    <div className="page-container">
      <PageHeader
        title="Aanmeldingen"
        description="Overzicht van alle aanmeldingen — intake, AI-match en review."
      >
        <Link href="/intake">
          <Button>
            <FileUp className="mr-2 h-4 w-4" />
            Nieuwe intake
          </Button>
        </Link>
      </PageHeader>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filter === f.value
                ? "bg-forta-primary text-white shadow-sm"
                : "bg-white text-slate-600 border border-forta-border hover:border-forta-primary/40 hover:text-forta-primary"
            )}
          >
            {f.label}
          </button>
        ))}

        {/* Search */}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Zoek patiënt, locatie, DSM…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-full border border-forta-border bg-white py-1.5 pl-8 pr-4 text-xs focus:border-forta-primary focus:outline-none focus:ring-1 focus:ring-forta-primary/20"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-forta-border py-20 text-center text-slate-500">
          Geen aanmeldingen gevonden
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Link
              key={r.id}
              href={`/referrals/${r.id}`}
              className={cn(
                "group flex cursor-pointer items-center gap-4 rounded-2xl border border-l-4 bg-white px-5 py-4 shadow-card transition-all hover:shadow-card-hover hover:border-forta-primary/30",
                aiColor(r.aiRecommendation)
              )}
            >
              {/* Avatar */}
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forta-primary-soft text-sm font-bold text-forta-primary">
                {r.patientName.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </span>

              {/* Name + meta */}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-forta-primary-dark group-hover:text-forta-primary">
                  {r.patientName}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-500">
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
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {new Date(r.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge value={r.status} />
                {r.aiRecommendation && r.aiRecommendation !== r.status && (
                  <StatusBadge value={r.aiRecommendation} />
                )}
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-forta-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="mt-4 text-xs text-slate-400 text-center">
          {filtered.length} van {referrals.length} aanmeldingen
        </p>
      )}
    </div>
  );
}
