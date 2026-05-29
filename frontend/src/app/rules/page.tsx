"use client";

import { useEffect, useState } from "react";
import { rulesApi } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { StatusBadge } from "@/components/StatusBadge";
import { PageSkeleton } from "@/components/Skeleton";
import { Settings2, Play, Save, Code2 } from "lucide-react";


const SAMPLE_INPUT = `{
  "extraction": {
    "probableDsm": "F32.1",
    "symptoms": "depression, anxiety",
    "age": 35,
    "riskLevel": "medium",
    "region": "Noord-Holland",
    "context": "Outpatient referral"
  },
  "capacity": { "availableSlots": 5, "waitingWeeks": 8 },
  "insurer": { "isCovered": true, "capRemaining": 5000 }
}`;

export default function RulesPage() {
  const [rulesJson, setRulesJson] = useState("");
  const [testInput, setTestInput] = useState(SAMPLE_INPUT);
  const [testResult, setTestResult] = useState<{
    recommendation: string;
    ruleResults: { ruleName: string; passed: boolean; message: string | null }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    rulesApi
      .get("ReferralMatch")
      .then((w) => {
        try {
          setRulesJson(JSON.stringify(JSON.parse(w.rulesJson), null, 2));
        } catch {
          setRulesJson(w.rulesJson);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      JSON.parse(rulesJson);
      await rulesApi.update("ReferralMatch", rulesJson);
      setMessage({ type: "success", text: "Rules saved and engine reloaded successfully." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Invalid JSON or save failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setMessage(null);
    try {
      const sampleInput = JSON.parse(testInput);
      const result = await rulesApi.test("ReferralMatch", sampleInput);
      setTestResult(result);
    } catch {
      setMessage({ type: "error", text: "Invalid test input JSON" });
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="page-container">
      <PageHeader
        title="Rules configuration"
        description="Microsoft RulesEngine workflows — inclusion, location, capacity, insurer, DSM."
      />

      {message && (
        <Alert variant={message.type === "error" ? "error" : "success"} className="mb-6">
          {message.text}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-forta-primary" />
              ReferralMatch workflow
            </CardTitle>
            <CardDescription>LambdaExpression rules — edit and save to hot-reload</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={rulesJson}
              onChange={(e) => setRulesJson(e.target.value)}
              rows={22}
              className="font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save & reload engine"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-forta-primary" />
              Test panel
            </CardTitle>
            <CardDescription>Evaluate rules against sample referral input</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              rows={14}
              className="font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
            <Button variant="secondary" onClick={handleTest}>
              <Play className="mr-2 h-4 w-4" />
              Run test
            </Button>
            {testResult && (
              <div className="rounded-xl border border-forta-border bg-forta-muted/50 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-600">Recommendation</span>
                  <StatusBadge value={testResult.recommendation} />
                </div>
                <ul className="space-y-2">
                  {testResult.ruleResults.map((r) => (
                    <li
                      key={r.ruleName}
                      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                        r.passed ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                      }`}
                    >
                      <span className="font-bold">{r.passed ? "PASS" : "FAIL"}</span>
                      <span>
                        <span className="font-semibold">{r.ruleName}</span>
                        {r.message && ` — ${r.message}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
