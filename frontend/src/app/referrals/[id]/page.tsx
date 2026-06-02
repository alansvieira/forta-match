"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { referralsApi, reviewApi, matchApi, labelsApi } from "@/lib/api";

import type {
  ReferralDetail, RecommendationResult, LabelRankingResult,
  LabelMatchResult, LabelSummary,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/Skeleton";
import {
  ArrowLeft, Brain, User, CheckCircle2, XCircle, AlertCircle,
  MapPin, Clock, Heart, Shield, CreditCard, RefreshCw,
  Sparkles, Calendar, FileText, Activity, ChevronRight, Medal,
  MessageSquare, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types & helpers ──────────────────────────────────────────────────────────

type TrafficLight = "green" | "amber" | "red" | "neutral";

function tlClass(c: TrafficLight) {
  return {
    green:   "text-emerald-700 bg-emerald-50  border-emerald-200",
    amber:   "text-amber-700   bg-amber-50    border-amber-200",
    red:     "text-red-700     bg-red-50      border-red-200",
    neutral: "text-slate-600   bg-slate-50    border-slate-200",
  }[c];
}

function TLDot({ color }: { color: TrafficLight }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0 mt-1.5",
    color === "green" ? "bg-emerald-500" :
    color === "amber" ? "bg-amber-400"   :
    color === "red"   ? "bg-red-500"     : "bg-slate-300"
  )} />;
}

function extractColor(field: string, value: string | number | null | undefined): TrafficLight {
  if (!value) return "red";
  if (field === "riskLevel") return String(value) === "crisis" ? "red" : String(value) === "high" ? "amber" : "green";
  if (field === "age")       return Number(value) < 18 ? "red" : "green";
  if (field === "probableDsm") return String(value).toLowerCase().includes("unknown") ? "amber" : "green";
  return "green";
}

const RULE_ICONS: Record<string, React.ElementType> = {
  ExclusionCriteria: Shield, LocationMatch: MapPin, CapacityCheck: Clock,
  InsurerCoverage: CreditCard, DsmSupported: Heart,
};
const RULE_NL: Record<string, string> = {
  ExclusionCriteria: "Exclusiecriteria", LocationMatch: "Locatiecheck",
  CapacityCheck: "Capaciteitscheck", InsurerCoverage: "Verzekeringsdekking", DsmSupported: "DSM-classificatie",
};
const RISK_NL: Record<string, string> = { low: "Laag", medium: "Medium", high: "Hoog", crisis: "Crisis" };

const LABEL_COLORS: Record<string, string> = {
  JA:      "border-l-emerald-400 bg-emerald-50/40",
  TWIJFEL: "border-l-amber-400   bg-amber-50/40",
  NEE:     "border-l-red-400     bg-red-50/20",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExtractionField({ label, value, color, referralId, fieldKey }: {
  label:      string;
  value:      string | number | null | undefined;
  color:      TrafficLight;
  referralId: string;
  fieldKey:   string;
}) {
  const [editing,   setEditing]   = useState(false);
  const [editVal,   setEditVal]   = useState(String(value ?? ""));
  const [saving,    setSaving]    = useState(false);
  const [corrected, setCorrected] = useState(false);

  const handleSave = async () => {
    if (editVal === String(value ?? "")) { setEditing(false); return; }
    setSaving(true);
    try {
      await referralsApi.saveExtractionCorrection(referralId, fieldKey, String(value ?? ""), editVal);
      setCorrected(true);
      setEditing(false);
    } finally { setSaving(false); }
  };

  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border p-3 group relative", tlClass(color))}>
      <TLDot color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
          {corrected && (
            <span className="rounded-full bg-emerald-200 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
              Gecorrigeerd
            </span>
          )}
        </div>
        {editing ? (
          <div className="mt-1 flex items-center gap-1.5">
            <input
              autoFocus
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              className="flex-1 rounded-lg border border-forta-border bg-white px-2 py-1 text-xs focus:border-forta-primary focus:outline-none"
              onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            />
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-forta-primary px-2 py-1 text-[10px] font-semibold text-white hover:bg-forta-primary-hover disabled:opacity-50">
              {saving ? "…" : "✓"}
            </button>
            <button onClick={() => setEditing(false)} className="text-[10px] text-slate-400 hover:text-slate-600">✕</button>
          </div>
        ) : (
          <p className="mt-0.5 text-sm font-medium leading-snug">{(corrected ? editVal : value) ?? "—"}</p>
        )}
      </div>
      {!editing && !corrected && (
        <button
          onClick={() => { setEditVal(String(value ?? "")); setEditing(true); }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 rounded-lg p-1 text-slate-400 hover:text-forta-primary hover:bg-white transition-all"
          title="Waarde corrigeren (feedback voor AI)"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      )}
    </div>
  );
}

function RuleRow({ ruleName, passed, message }: { ruleName: string; passed: boolean; message: string | null }) {
  const Icon  = RULE_ICONS[ruleName] ?? Activity;
  const label = RULE_NL[ruleName] ?? ruleName;
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3", passed ? tlClass("green") : tlClass("red"))}>
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
        passed ? "bg-emerald-100" : "bg-red-100")}>
        <Icon className={cn("h-3.5 w-3.5", passed ? "text-emerald-700" : "text-red-700")} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{label}</span>
          {passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  : <XCircle      className="h-3.5 w-3.5 text-red-600" />}
        </div>
        {message && <p className="mt-0.5 text-xs opacity-75">{message}</p>}
      </div>
    </div>
  );
}

// ─── Label ranking: top card + dropdown compare ───────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-emerald-500" : score >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-xs font-bold tabular-nums w-8 text-right",
        score >= 75 ? "text-emerald-700" : score >= 40 ? "text-amber-600" : "text-red-600")}>
        {score}%
      </span>
    </div>
  );
}

function RuleChips({ rules }: { rules: LabelMatchResult["ruleResults"] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {rules.map(r => (
        <span key={r.ruleName}
          className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            r.passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700")}>
          {r.passed ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
          {r.ruleName}
        </span>
      ))}
    </div>
  );
}

function LabelRankingSection({
  ranking, onRefresh, refreshing, extractionHint,
}: {
  ranking:        LabelRankingResult;
  onRefresh?:     () => void;
  refreshing?:    boolean;
  extractionHint?: { age?: number | null; riskLevel?: string | null; region?: string | null };
}) {
  const [compareIdx, setCompareIdx] = useState<number | null>(null);
  const top    = ranking.labels[0];
  const others = ranking.labels.slice(1);
  const compareLabel = compareIdx !== null ? others[compareIdx] : null;

  if (!top) return null;

  const recBadge = (rec: string) =>
    rec === "JA"      ? "bg-emerald-600 text-white" :
    rec === "TWIJFEL" ? "bg-amber-500 text-white"   : "bg-red-500 text-white";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-forta-primary-dark">Label matching</h2>
          <p className="text-xs text-slate-500">
            {ranking.labels.length} labels beoordeeld · gesorteerd op score · live uit label-rules
          </p>
          {extractionHint && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              Patiëntdata: leeftijd {extractionHint.age ?? "—"}, risico {extractionHint.riskLevel ?? "—"}
              {extractionHint.region ? `, regio ${extractionHint.region}` : ""}
            </p>
          )}
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-forta-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-forta-primary/30 hover:text-forta-primary disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Herberekenen…" : "Herbereken"}
          </button>
        )}
      </div>

      {/* Top label — always visible */}
      <div className={cn(
        "rounded-2xl border border-l-4 bg-white p-4 shadow-card",
        LABEL_COLORS[top.recommendation] ?? "border-l-slate-200"
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forta-primary text-white">
              <Medal className="h-3.5 w-3.5" />
            </span>
            <span className="font-bold text-forta-primary-dark">{top.displayName}</span>
            <span className="rounded-full bg-forta-primary/10 px-2 py-0.5 text-[10px] font-bold text-forta-primary">AANBEVOLEN</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", recBadge(top.recommendation))}>
              {top.recommendation}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <ScoreBar score={top.score} />
        </div>
        {top.reasoning && (
          <p className="mt-2 text-xs text-slate-600 italic">{top.reasoning}</p>
        )}
        <RuleChips rules={top.ruleResults} />
      </div>

      {/* Compare dropdown */}
      {others.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Vergelijk met:</span>
            <select
              value={compareIdx ?? ""}
              onChange={e => setCompareIdx(e.target.value === "" ? null : Number(e.target.value))}
              className="rounded-xl border border-forta-border bg-white px-3 py-1.5 text-xs focus:border-forta-primary focus:outline-none focus:ring-1 focus:ring-forta-primary/20"
            >
              <option value="">— Kies een label —</option>
              {others.map((l, i) => (
                <option key={l.labelName} value={i}>
                  {l.displayName} ({l.score}% · {l.recommendation})
                </option>
              ))}
            </select>
          </div>

          {compareLabel && (
            <div className={cn(
              "mt-2 rounded-2xl border border-l-4 bg-white p-4 shadow-card",
              LABEL_COLORS[compareLabel.recommendation] ?? "border-l-slate-200"
            )}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-forta-primary-dark">{compareLabel.displayName}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", recBadge(compareLabel.recommendation))}>
                  {compareLabel.recommendation}
                </span>
              </div>
              <div className="mt-3">
                <ScoreBar score={compareLabel.score} />
              </div>
              {compareLabel.reasoning && (
                <p className="mt-2 text-xs text-slate-600 italic">{compareLabel.reasoning}</p>
              )}
              <RuleChips rules={compareLabel.ruleResults} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Human feedback form ──────────────────────────────────────────────────────

function FeedbackForm({
  referralId, aiTopLabel, labelOptions, onSubmitted,
}: {
  referralId:    string;
  aiTopLabel:    string | null;
  labelOptions:  { labelName: string; displayName: string }[];
  onSubmitted:   (agreedWithAi: boolean, chosenLabel: string) => void;
}) {
  const [chosenLabel, setChosenLabel] = useState("");
  const [outcome, setOutcome]         = useState("JA");
  const [reasoning, setReasoning]     = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!chosenLabel || !reasoning.trim()) {
      setError("Kies een label en geef een motivatie.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const agreedWithAi = chosenLabel === aiTopLabel && outcome === "JA";
      await matchApi.submitFeedback(referralId, {
        chosenLabel, outcome, reasoning, agreedWithAi, decidedBy: "Secretariaat",
      });
      onSubmitted(agreedWithAi, chosenLabel);
    } catch {
      setError("Opslaan mislukt. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-forta-primary/20 bg-gradient-to-br from-forta-primary-soft/30 to-white">
      <CardHeader className="border-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-forta-primary" />
          Uw beoordeling
          <span className="ml-1 rounded-full bg-forta-primary/10 px-2 py-0.5 text-[10px] font-semibold text-forta-primary">
            Pilot 1a — parallelrun
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-500">
          Geef uw eigen beoordeling — dit wordt vergeleken met het AI-advies voor validatie.
        </p>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Welk label kiest u?</label>
          <select
            value={chosenLabel}
            onChange={e => setChosenLabel(e.target.value)}
            className="w-full rounded-xl border border-forta-border bg-white px-3 py-2.5 text-sm focus:border-forta-primary focus:outline-none focus:ring-1 focus:ring-forta-primary/20"
          >
            <option value="">— Kies een label —</option>
            {labelOptions.map(l => (
              <option key={l.labelName} value={l.labelName}>{l.displayName}</option>
            ))}
            <option value="Geen">Geen passend label</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Uitkomst</label>
          <div className="flex gap-2">
            {["JA", "TWIJFEL", "NEE"].map(o => (
              <button
                key={o}
                onClick={() => setOutcome(o)}
                className={cn(
                  "flex-1 rounded-xl border py-2 text-xs font-bold transition-colors",
                  outcome === o
                    ? o === "JA" ? "border-emerald-500 bg-emerald-600 text-white"
                      : o === "NEE" ? "border-red-500 bg-red-600 text-white"
                      : "border-amber-500 bg-amber-500 text-white"
                    : "border-forta-border text-slate-600 hover:border-forta-primary/30"
                )}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Uw motivatie *</label>
          <textarea
            value={reasoning}
            onChange={e => setReasoning(e.target.value)}
            rows={3}
            placeholder="Beschrijf kort waarom u dit label en deze uitkomst kiest…"
            className="w-full resize-none rounded-xl border border-forta-border bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-forta-primary focus:outline-none focus:ring-1 focus:ring-forta-primary/20"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <Button onClick={handleSubmit} disabled={loading} className="w-full">
          {loading ? "Opslaan…" : "Beoordeling opslaan"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Feedback comparison ──────────────────────────────────────────────────────

function FeedbackResult({
  agreedWithAi, chosenLabel, aiTopLabel, displayName,
}: {
  agreedWithAi: boolean;
  chosenLabel:  string;
  aiTopLabel:   string | null;
  displayName:  (name: string | null) => string;
}) {
  return (
    <Card className={cn("border-2", agreedWithAi ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50")}>
      <CardContent className="py-5">
        <div className="flex items-center gap-3 mb-4">
          {agreedWithAi
            ? <ThumbsUp className="h-6 w-6 text-emerald-600" />
            : <ThumbsDown className="h-6 w-6 text-amber-600" />}
          <div>
            <p className={cn("font-bold", agreedWithAi ? "text-emerald-800" : "text-amber-800")}>
              {agreedWithAi ? "Overeenstemming met AI" : "Afwijking van AI-advies"}
            </p>
            <p className="text-xs text-slate-500">Parallelrun feedback opgeslagen</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">AI-advies</p>
            <p className="font-bold text-forta-primary-dark text-sm">
              {aiTopLabel ? displayName(aiTopLabel) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Uw keuze</p>
            <p className="font-bold text-forta-primary-dark text-sm">
              {displayName(chosenLabel)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Action bar ───────────────────────────────────────────────────────────────

// ─── Deviation feedback ────────────────────────────────────────────────────────

function DeviationFeedback({ referralId, aiAdvice, humanDecision, onDone }: {
  referralId:    string;
  aiAdvice:      string;
  humanDecision: string;
  onDone:        () => void;
}) {
  const [reason,  setReason]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await referralsApi.saveDeviationFeedback(referralId, aiAdvice, humanDecision, reason || "Geen toelichting");
      setSaved(true);
      setTimeout(onDone, 1200);
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900">U wijkt af van het AI-advies</p>
          <p className="text-xs text-amber-700 mt-0.5">
            AI: <strong>{aiAdvice}</strong> · Uw beslissing: <strong>{humanDecision}</strong>
          </p>
        </div>
      </div>

      {saved ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Feedback opgeslagen — bedankt!
        </div>
      ) : (
        <>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder="Waarom wijkt u af? (optioneel — helpt het model verbeteren)"
            className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm placeholder:text-slate-300 focus:border-forta-primary focus:outline-none focus:ring-1 focus:ring-forta-primary/20"
          />
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
              {saving ? "Opslaan…" : "Feedback opslaan"}
            </button>
            <button onClick={onDone} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              Overslaan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type ActionMode = null | "accept" | "screenteam" | "reject";

function ActionBar({ referralId, status, aiRecommendation, onRefresh }: {
  referralId: string; status: string; aiRecommendation: string | null; onRefresh: () => void;
}) {
  const [mode,      setMode]      = useState<ActionMode>(null);
  const [reason,    setReason]    = useState("");
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [deviation, setDeviation] = useState<{ ai: string; human: string } | null>(null);

  const isFinalized    = status.startsWith("Finalized") || status.startsWith("Validated");
  const isScreenteam   = status === "ScreeningReview";
  const hasNoMatch     = !["RecommendedYes","RecommendedNo","RecommendedUncertain",
                           "Complete","ScreeningReview","Extracted","Evaluating"].includes(status);

  const reset = () => { setMode(null); setReason(""); setError(null); };

  const doAction = async () => {
    if (mode === "reject" && !reason.trim()) { setError("Geef een reden voor afwijzing."); return; }
    setBusy(true); setError(null);
    try {
      if (mode === "accept")     await reviewApi.validate(referralId, { action: "accept", validatedBy: "Secretariaat", reason });
      if (mode === "reject")     await reviewApi.validate(referralId, { action: "reject", validatedBy: "Secretariaat", reason });
      if (mode === "screenteam") await reviewApi.forwardScreenteam(referralId, reason || undefined);

      // Afwijkingsdetectie
      const aiNorm = aiRecommendation?.toLowerCase();
      const isDeviation =
        (aiNorm === "yes" && mode === "reject") ||
        (aiNorm === "no"  && mode === "accept") ||
        (aiNorm === "yes" && mode === "screenteam");

      if (isDeviation) {
        const aiLabel    = aiNorm === "yes" ? "JA" : aiNorm === "no" ? "NEE" : "TWIJFEL";
        const humanLabel = mode === "accept" ? "JA" : mode === "reject" ? "NEE" : "Screenteam";
        setDeviation({ ai: aiLabel, human: humanLabel });
      }

      reset();
      onRefresh();
    } catch { setError("Actie mislukt. Probeer opnieuw."); }
    finally { setBusy(false); }
  };

  if (isFinalized) return (
    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      <div>
        <p className="text-sm font-semibold text-emerald-800">Beslissing vastgelegd</p>
        <p className="text-xs text-emerald-600">Geen verdere actie vereist</p>
      </div>
    </div>
  );

  if (isScreenteam && !mode) return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3 mb-4">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900">In behandeling bij screenteam</p>
          <p className="text-xs text-amber-700 mt-0.5">Het screenteam beoordeelt dit twijfelgeval. Secretariaat kan alsnog direct beslissen.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setMode("accept")}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">
          <CheckCircle2 className="h-3.5 w-3.5" /> Toch accepteren
        </button>
        <button onClick={() => setMode("reject")}
          className="flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors">
          <XCircle className="h-3.5 w-3.5" /> Toch afwijzen
        </button>
      </div>
    </div>
  );

  if (hasNoMatch) return null;

  // Afwijkingsfeedback tonen na beslissing
  if (deviation) return (
    <DeviationFeedback
      referralId={referralId}
      aiAdvice={deviation.ai}
      humanDecision={deviation.human}
      onDone={() => { setDeviation(null); onRefresh(); }}
    />
  );

  const BTNS = [
    { id: "accept"    as ActionMode, icon: CheckCircle2, label: "JA",           sub: "Accepteren",        cls: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm" },
    { id: "screenteam"as ActionMode, icon: AlertCircle,  label: "Twijfel?",     sub: "→ Screenteam",      cls: "border-2 border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100" },
    { id: "reject"    as ActionMode, icon: XCircle,      label: "NEE",          sub: "Afwijzen",          cls: "border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100" },
  ];

  return (
    <div className="rounded-2xl border border-forta-border bg-white shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-forta-border bg-forta-muted/30">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Uw beslissing</p>
      </div>

      {/* Buttons */}
      {!mode && (
        <div className="grid grid-cols-3 divide-x divide-forta-border">
          {BTNS.map(b => {
            const Icon = b.icon;
            return (
              <button key={String(b.id)} onClick={() => setMode(b.id)}
                className={cn("flex flex-col items-center gap-1.5 py-5 px-3 text-center transition-all", b.cls)}>
                <Icon className="h-5 w-5" />
                <span className="text-sm font-bold">{b.label}</span>
                <span className="text-[10px] opacity-75">{b.sub}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Inline confirmation form */}
      {mode && (
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            {mode === "accept"     && <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="font-semibold text-emerald-800">Accepteren</span></>}
            {mode === "screenteam" && <><AlertCircle  className="h-4 w-4 text-amber-600"   /><span className="font-semibold text-amber-800">Doorsturen naar screenteam</span></>}
            {mode === "reject"     && <><XCircle      className="h-4 w-4 text-red-600"     /><span className="font-semibold text-red-800">Afwijzen</span></>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              {mode === "reject" ? "Reden voor afwijzing *" : "Toelichting (optioneel)"}
            </label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setError(null); }}
              rows={3}
              placeholder={
                mode === "accept"     ? "Bijv. voldoet aan alle criteria…"
                : mode === "screenteam" ? "Bijv. onduidelijke hulpvraag, complexe comorbiditeit…"
                : "Bijv. buiten behandelkader, leeftijd te jong…"
              }
              className="w-full resize-none rounded-xl border border-forta-border px-3 py-2.5 text-sm placeholder:text-slate-300 focus:border-forta-primary focus:outline-none focus:ring-1 focus:ring-forta-primary/20"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button onClick={doAction} disabled={busy}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50",
                mode === "accept"     ? "bg-emerald-600 hover:bg-emerald-700"
                : mode === "screenteam" ? "bg-amber-500 hover:bg-amber-600"
                : "bg-red-600 hover:bg-red-700"
              )}>
              {busy ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Verwerken…</>
                    : mode === "screenteam" ? "Doorsturen naar screenteam"
                    : mode === "accept"     ? "Accepteren bevestigen"
                    : "Afwijzen bevestigen"}
            </button>
            <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
              ← Terug
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReferralDetailPage() {
  const params = useParams();
  const id     = params.id as string;

  const [referral,     setReferral]     = useState<ReferralDetail | null>(null);
  const [ruleResults,  setRuleResults]  = useState<RecommendationResult | null>(null);
  const [labelRanking, setLabelRanking] = useState<LabelRankingResult | null>(null);
  const [labelCatalog, setLabelCatalog] = useState<LabelSummary[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [rerunLoading, setRerunLoading]   = useState(false);
  const [labelRefreshing, setLabelRefreshing] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState<{ agreedWithAi: boolean; chosenLabel: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      referralsApi.get(id),
      matchApi.getRuleResults(id).catch(() => null),
      matchApi.getLabelRanking(id).catch(() => null),
      labelsApi.get().catch(() => null),
    ]).then(([ref, rules, labels, catalog]) => {
      setReferral(ref);
      if (rules)  setRuleResults(rules);
      if (labels) setLabelRanking(labels);
      if (catalog) setLabelCatalog(catalog.labels);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const refreshLabelRanking = useCallback(async () => {
    setLabelRefreshing(true);
    try {
      const labels = await matchApi.getLabelRanking(id);
      setLabelRanking(labels);
      if (labels.labels.length > 0) {
        setLabelCatalog(labels.labels.map(l => ({
          workflowName:      l.labelName,
          displayName:       l.displayName,
          sortOrder:         0,
          knockoutRuleNames: [],
          ruleCount:         l.ruleResults.length,
        })));
      }
    } catch {
      setLabelRanking(null);
    } finally {
      setLabelRefreshing(false);
    }
  }, [id]);

  const handleRerun = async () => {
    setRerunLoading(true);
    try {
      await matchApi.run(id);
      await load();
      await refreshLabelRanking();
    } finally {
      setRerunLoading(false);
    }
  };

  if (loading || !referral) return <PageSkeleton />;

  const ext     = referral.extraction;
  const hasMatch = !!referral.aiRecommendation;

  const displayNameByKey = new Map<string, string>();
  for (const l of labelRanking?.labels ?? []) {
    displayNameByKey.set(l.labelName, l.displayName);
  }
  for (const l of labelCatalog) {
    if (!displayNameByKey.has(l.workflowName)) {
      displayNameByKey.set(l.workflowName, l.displayName);
    }
  }
  const labelDisplay = (name: string | null) =>
    name ? displayNameByKey.get(name) ?? name : "—";
  const labelOptions = [...displayNameByKey.entries()]
    .map(([labelName, displayName]) => ({ labelName, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "nl"));

  const heroConfig = !hasMatch ? null
    : referral.aiRecommendation === "YES" || referral.aiRecommendation === "Yes"
      ? { label: "JA — Aanbevolen",  bg: "from-emerald-50 to-white", border: "border-emerald-200", icon: CheckCircle2, iconColor: "text-emerald-600", badgeBg: "bg-emerald-600" }
      : referral.aiRecommendation === "NO" || referral.aiRecommendation === "No"
      ? { label: "NEE — Afgeraden",  bg: "from-red-50 to-white",     border: "border-red-200",     icon: XCircle,      iconColor: "text-red-600",     badgeBg: "bg-red-600"     }
      : { label: "TWIJFEL",          bg: "from-amber-50 to-white",   border: "border-amber-200",   icon: AlertCircle,  iconColor: "text-amber-600",   badgeBg: "bg-amber-500"   };

  return (
    <div className="page-container max-w-5xl">
      {/* Back */}
      <Link href="/referrals"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-forta-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Terug naar aanmeldingen
      </Link>

      {/* Patient header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-forta-primary-dark">{referral.patient.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            {referral.location    && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{referral.location}</span>}
            {referral.probableDsm && <span className="flex items-center gap-1"><Brain className="h-3.5 w-3.5" />{referral.probableDsm}</span>}
            {referral.referralDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(referral.referralDate).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
        <button onClick={handleRerun} disabled={rerunLoading}
          className="flex items-center gap-2 rounded-xl border border-forta-border bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:border-forta-primary/30 hover:text-forta-primary transition-colors disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", rerunLoading && "animate-spin")} />
          {rerunLoading ? "AI opnieuw…" : "AI opnieuw uitvoeren"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── Left (2/3) ─────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">

          {/* Hero */}
          {heroConfig ? (() => {
            const Icon = heroConfig.icon;
            return (
              <div className={cn("rounded-2xl border bg-gradient-to-br p-6", heroConfig.bg, heroConfig.border)}>
                <div className="flex items-start gap-4">
                  <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm border", heroConfig.border)}>
                    <Icon className={cn("h-7 w-7", heroConfig.iconColor)} />
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-3 py-1 text-sm font-bold text-white", heroConfig.badgeBg)}>
                        {heroConfig.label}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Sparkles className="h-3 w-3" /> AI-advies
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-700">{referral.aiReasoning}</p>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-forta-border bg-white py-10 text-center">
              <Sparkles className="h-10 w-10 text-slate-200" />
              <p className="font-medium text-slate-600">Nog geen AI-advies</p>
              <button onClick={handleRerun} disabled={rerunLoading}
                className="mt-2 flex items-center gap-2 rounded-xl bg-forta-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-forta-primary-hover disabled:opacity-50">
                <Sparkles className="h-4 w-4" /> AI Match starten
              </button>
            </div>
          )}

          {/* Action bar */}
          {(hasMatch || referral.status === "ScreeningReview") && (
            <ActionBar
              referralId={id}
              status={referral.status}
              aiRecommendation={referral.aiRecommendation}
              onRefresh={load}
            />
          )}

          {/* ── Label Ranking (Pilot 1a) ─────────────────────────────── */}
          {labelRanking && labelRanking.labels.length > 0 && (
            <LabelRankingSection
              ranking={labelRanking}
              onRefresh={refreshLabelRanking}
              refreshing={labelRefreshing}
              extractionHint={ext ? { age: ext.age, riskLevel: ext.riskLevel, region: ext.region } : undefined}
            />
          )}

          {/* ── Human feedback / parallelrun ─────────────────────────── */}
          {hasMatch && (
            feedbackDone ? (
              <FeedbackResult
                agreedWithAi={feedbackDone.agreedWithAi}
                chosenLabel={feedbackDone.chosenLabel}
                aiTopLabel={labelRanking?.topLabel ?? null}
                displayName={labelDisplay}
              />
            ) : labelOptions.length > 0 ? (
              <FeedbackForm
                referralId={id}
                aiTopLabel={labelRanking?.topLabel ?? null}
                labelOptions={labelOptions}
                onSubmitted={(agreedWithAi, chosenLabel) =>
                  setFeedbackDone({ agreedWithAi, chosenLabel })}
              />
            ) : null
          )}

          {/* Extraction */}
          {ext && (
            <Card>
              <CardHeader className="border-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Brain className="h-4 w-4 text-forta-primary" />
                  AI Extractie
                  <span className="ml-auto text-[10px] font-normal text-slate-400">Mistral AI</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-slate-400 mb-2.5">Hover over een veld om de AI-waarde te corrigeren — wordt opgeslagen als feedback.</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <ExtractionField label="Woonplaats / regio" fieldKey="region"      referralId={id} value={ext.region ?? referral.location}           color={ext.region ? "green" : "amber"} />
                  <ExtractionField label="Vermoedelijke DSM"  fieldKey="probableDsm" referralId={id} value={ext.probableDsm}                           color={extractColor("probableDsm", ext.probableDsm)} />
                  <ExtractionField label="Leeftijd"           fieldKey="age"         referralId={id} value={ext.age ? `${ext.age} jaar` : null}        color={extractColor("age", ext.age)} />
                  <ExtractionField label="Risicoprofiel"      fieldKey="riskLevel"   referralId={id} value={RISK_NL[ext.riskLevel ?? ""] ?? ext.riskLevel} color={extractColor("riskLevel", ext.riskLevel)} />
                  {ext.symptoms && <ExtractionField label="Klachten & symptomen" fieldKey="symptoms" referralId={id} value={ext.symptoms} color="green" />}
                  {ext.context  && <ExtractionField label="Context"              fieldKey="context"  referralId={id} value={ext.context}  color="neutral" />}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Decision history */}
          {referral.decisions.filter(d => d.decisionType !== "HumanParallelrunFeedback").length > 0 && (
            <Card>
              <CardHeader className="border-0 pb-2">
                <CardTitle className="text-base">Beslissingshistorie</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-4 border-l-2 border-forta-border pl-6">
                  {referral.decisions
                    .filter(d => d.decisionType !== "HumanParallelrunFeedback")
                    .map(d => (
                    <li key={d.id} className="relative">
                      <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-forta-primary ring-2 ring-forta-primary-soft" />
                      <p className="font-semibold text-forta-primary-dark text-sm">{d.decisionType}</p>
                      <p className="text-sm text-slate-600">{d.outcome}{d.reason && ` · ${d.reason}`}</p>
                      {d.decidedBy && <p className="text-xs text-slate-400">{d.decidedBy}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(d.createdAt).toLocaleString("nl-NL")}
                      </p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right (1/3) ─────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Rule results */}
          {ruleResults && ruleResults.ruleResults.length > 0 && (
            <Card>
              <CardHeader className="border-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-forta-primary" /> Regelcheck
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ruleResults.ruleResults.map(r => (
                  <RuleRow key={r.ruleName} ruleName={r.ruleName} passed={r.passed} message={r.message} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Patient */}
          <Card>
            <CardHeader className="border-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-forta-primary" /> Patiëntgegevens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: "Naam",          value: referral.patient.name          },
                { label: "BSN",           value: referral.patient.bsn           },
                { label: "Contact",       value: referral.patient.contactDetails },
                { label: "E-mail",        value: referral.patient.email         },
                { label: "Telefoon",      value: referral.patient.phone         },
                { label: "Locatie",       value: referral.location              },
                { label: "Zorgverzekering", value: referral.insurer            },
                { label: "AGB-code",      value: referral.referrerAgb           },
              ].filter(f => f.value).map(({ label, value }) => (
                <div key={label} className="flex gap-2">
                  <span className="w-28 shrink-0 text-slate-400 text-xs pt-0.5">{label}</span>
                  <span className="font-medium text-forta-primary-dark break-words text-sm">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Dossier */}
          <Card>
            <CardHeader className="border-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-forta-primary" /> Dossier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {referral.uploadedFileName && (
                <div className="flex gap-2">
                  <span className="w-24 shrink-0 text-slate-400 text-xs pt-0.5">Bestand</span>
                  <span className="font-medium text-forta-primary-dark break-all text-xs">{referral.uploadedFileName}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="w-24 shrink-0 text-slate-400 text-xs pt-0.5">Handtekening</span>
                <span className={cn("font-medium text-xs", referral.hasSignature ? "text-emerald-700" : "text-red-600")}>
                  {referral.hasSignature ? "✓ Aanwezig" : "✗ Ontbreekt"}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="w-24 shrink-0 text-slate-400 text-xs pt-0.5">Aangemeld</span>
                <span className="font-medium text-forta-primary-dark text-xs">
                  {new Date(referral.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
