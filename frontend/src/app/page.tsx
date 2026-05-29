"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { referralsApi } from "@/lib/api";
import type { DashboardStats, ReferralSummary } from "@/lib/types";
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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([referralsApi.stats(), referralsApi.list()])
      .then(([s, r]) => {
        setStats(s);
        setReferrals(r.slice(0, 8));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  const statCards = stats
    ? [
        { label: "Total referrals", value: stats.total, icon: Activity, variant: "default" as const },
        { label: "Pending intake", value: stats.pending, icon: Clock, variant: "info" as const },
        { label: "Approved", value: stats.approved, icon: CheckCircle2, variant: "success" as const },
        { label: "Rejected", value: stats.rejected, icon: XCircle, variant: "danger" as const },
        { label: "Uncertain", value: stats.uncertain, icon: HelpCircle, variant: "warning" as const },
      ]
    : [];

  return (
    <div className="page-container">
      <PageHeader
        title="Dashboard"
        description="Overview of referral triage — AI recommends, your team decides."
      >
        <Link href="/intake">
          <Button>
            <FileUp className="mr-2 h-4 w-4" />
            New intake
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
              <CardTitle>Recent referrals</CardTitle>
            </div>
            <Link href="/referrals">
              <Button variant="ghost" size="sm" className="cursor-pointer">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-forta-border bg-forta-muted/30 py-12 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">No referrals yet</p>
                <Link href="/intake" className="mt-4 inline-block">
                  <Button size="sm">Start first intake</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Status</th>
                      <th>AI</th>
                      <th>Location</th>
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
            <CardTitle>Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { phase: "1", title: "Intake", desc: "Upload & register patient", href: "/intake", icon: FileUp },
              { phase: "2", title: "AI Match", desc: "Mistral + rules engine", href: "/referrals", icon: Brain },
              { phase: "3", title: "Review", desc: "Screening team decides", href: "/review", icon: Users },
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
