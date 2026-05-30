"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { referralsApi } from "@/lib/api";
import type { DashboardStats, ReferralSummary } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { PageSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  FileUp,
  Brain,
  Users,
} from "lucide-react";

type FeedbackStats = { total: number; agreed: number; deviated: number; agreementPct: number; recent: boolean[] };

export default function DashboardPage() {
  const [stats,         setStats]         = useState<DashboardStats | null>(null);
  const [referrals,     setReferrals]     = useState<ReferralSummary[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([referralsApi.stats(), referralsApi.list(), referralsApi.feedbackStats().catch(() => null)])
      .then(([s, r, fs]) => {
        setStats(s);
        setReferrals(r.slice(0, 8));
        if (fs) setFeedbackStats(fs);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  const statCards = stats
    ? [
        { label: "Totaal",          value: stats.total,     icon: Activity,     variant: "default" as const },
        { label: "In behandeling",  value: stats.pending,   icon: Clock,        variant: "info"    as const },
        { label: "Geaccepteerd",    value: stats.approved,  icon: CheckCircle2, variant: "success" as const },
        { label: "Afgewezen",       value: stats.rejected,  icon: XCircle,      variant: "danger"  as const },
        { label: "Twijfel",         value: stats.uncertain, icon: HelpCircle,   variant: "warning" as const },
      ]
    : [];

  return (
    <div className="page-container">
      <PageHeader
        title="Dashboard"
        description="Overzicht van aanmeldingen — AI adviseert, jouw team beslist."
      >
        <Link href="/intake">
          <Button>
            <FileUp className="mr-2 h-4 w-4" />
            Nieuwe intake
          </Button>
        </Link>
      </PageHeader>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-0 pb-0">
            <div>
              <CardTitle>Recente aanmeldingen</CardTitle>
            </div>
            <Link href="/referrals">
              <Button variant="ghost" size="sm" className="cursor-pointer">
                Alles bekijken
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-forta-border bg-forta-muted/30 py-12 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">Nog geen aanmeldingen</p>
                <Link href="/intake" className="mt-4 inline-block">
                  <Button size="sm">Eerste intake starten</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Patiënt</th>
                      <th>Status</th>
                      <th>AI-advies</th>
                      <th>Locatie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link
                            href={`/referrals/${r.id}`}
                            className="cursor-pointer font-semibold text-forta-primary hover:text-forta-primary-hover hover:underline"
                          >
                            {r.patientName}
                          </Link>
                        </td>
                        <td>
                          <StatusBadge value={r.status} />
                        </td>
                        <td>
                          <StatusBadge value={r.aiRecommendation ?? undefined} />
                        </td>
                        <td className="text-slate-600">{r.location ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-0 pb-0">
            <CardTitle>Werkproces & validatie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { phase: "1", title: "Intake",   desc: "Uploaden & patiënt registreren",       href: "/intake",    icon: FileUp },
              { phase: "2", title: "AI Match", desc: "Mistral extractie + regelcheck",        href: "/referrals", icon: Brain  },
              { phase: "3", title: "Review",   desc: "Screenteam beoordeelt twijfelgevallen", href: "/review",    icon: Users  },
            ].map((step) => (
              <Link
                key={step.phase}
                href={step.href}
                className="group flex cursor-pointer items-center gap-4 rounded-xl border border-forta-border p-4 transition-colors duration-200 hover:border-forta-primary/30 hover:bg-forta-primary-soft/50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forta-primary text-sm font-bold text-white shadow-sm">
                  {step.phase}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-semibold text-forta-primary-dark group-hover:text-forta-primary">
                    {step.title}
                  </p>
                  <p className="text-xs text-slate-500">{step.desc}</p>
                </div>
                <step.icon className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-forta-primary" />
              </Link>
            ))}

            {/* AI vs mens overeenstemming widget */}
            {feedbackStats && feedbackStats.total > 0 && (
              <div className="rounded-xl border border-forta-border bg-forta-muted/40 p-4 mt-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-600">AI — mens overeenstemming</p>
                  <span className={`text-sm font-black ${
                    feedbackStats.agreementPct >= 80 ? "text-emerald-600"
                    : feedbackStats.agreementPct >= 60 ? "text-amber-600"
                    : "text-red-600"
                  }`}>
                    {feedbackStats.agreementPct}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      feedbackStats.agreementPct >= 80 ? "bg-emerald-500"
                      : feedbackStats.agreementPct >= 60 ? "bg-amber-400"
                      : "bg-red-500"
                    }`}
                    style={{ width: `${feedbackStats.agreementPct}%` }}
                  />
                </div>
                {/* Recent dots */}
                {feedbackStats.recent.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Recent:</span>
                    {feedbackStats.recent.map((agreed, i) => (
                      <span key={i} className={`h-2 w-2 rounded-full ${agreed ? "bg-emerald-400" : "bg-red-400"}`} />
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {feedbackStats.agreed}/{feedbackStats.total} beslissingen komen overeen
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
