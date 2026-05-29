"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { referralsApi } from "@/lib/api";
import type { ReferralSummary } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUp, Search } from "lucide-react";

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<ReferralSummary[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    referralsApi.list().then(setReferrals).finally(() => setLoading(false));
  }, []);

  const filtered = referrals.filter(
    (r) =>
      !filter ||
      r.patientName.toLowerCase().includes(filter.toLowerCase()) ||
      r.status.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <PageSkeleton />;

  return (
    <div className="page-container">
      <PageHeader title="Referrals" description="All cases across intake, AI match, and review phases.">
        <Link href="/intake">
          <Button>
            <FileUp className="mr-2 h-4 w-4" />
            New intake
          </Button>
        </Link>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-0">
          <CardTitle>All referrals</CardTitle>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search patient or status..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-500">No referrals found</div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Status</th>
                    <th>AI recommendation</th>
                    <th>Final decision</th>
                    <th>DSM</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link
                          href={`/referrals/${r.id}`}
                          className="cursor-pointer font-semibold text-forta-primary hover:underline"
                        >
                          {r.patientName}
                        </Link>
                      </td>
                      <td><StatusBadge value={r.status} /></td>
                      <td><StatusBadge value={r.aiRecommendation ?? undefined} /></td>
                      <td><StatusBadge value={r.finalDecision ?? undefined} /></td>
                      <td className="text-slate-600">{r.probableDsm ?? "—"}</td>
                      <td className="text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
