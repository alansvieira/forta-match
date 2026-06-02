"use client";

import { useEffect, useRef, useState } from "react";
import { rulesApi } from "@/lib/api";
import type { GenerateRuleResponse } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/Alert";
import { StatusBadge } from "@/components/StatusBadge";
import { PageSkeleton } from "@/components/Skeleton";
import {
  Settings2, Play, Save, Code2, Bot, Send, Plus, Trash2,
  CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight, ChevronUp,
  Sparkles, MapPin, Heart, CreditCard, Clock, ShieldAlert,
  FileText, Brain, Zap, ArrowRight, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface RuleObj {
  RuleName:             string;
  Expression:          string;
  SuccessEvent?:        string;
  ErrorMessage?:        string;
  ErrorType?:           string;
  RuleExpressionType?: string;
}

interface WorkflowObj {
  WorkflowName: string;
  Rules: RuleObj[];
}

interface ChatMessage {
  role:      "user" | "assistant";
  content:   string;
  generated?: GenerateRuleResponse;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const RULE_ICONS: Record<string, React.ElementType> = {
  ExclusionCriteria: ShieldAlert,
  LocationMatch:     MapPin,
  CapacityCheck:     Clock,
  InsurerCoverage:   CreditCard,
  DsmSupported:      Heart,
};

const RULE_LABELS: Record<string, { label: string; color: string }> = {
  ExclusionCriteria: { label: "Exclusie",    color: "bg-red-100 text-red-800"      },
  LocationMatch:     { label: "Locatie",     color: "bg-blue-100 text-blue-800"    },
  CapacityCheck:     { label: "Capaciteit",  color: "bg-purple-100 text-purple-800"},
  InsurerCoverage:   { label: "Verzekering", color: "bg-teal-100 text-teal-800"    },
  DsmSupported:      { label: "DSM",         color: "bg-amber-100 text-amber-800"  },
};

function ruleLabel(name: string) {
  return RULE_LABELS[name] ?? { label: "Aangepast", color: "bg-slate-100 text-slate-700" };
}

function isRequired(name: string) {
  return ["ExclusionCriteria", "LocationMatch", "CapacityCheck", "InsurerCoverage"].includes(name);
}

const SAMPLE_INPUT = JSON.stringify({
  extraction: { probableDsm: "F32.1", symptoms: "depressie, angst", age: 35, riskLevel: "medium", region: "Utrecht", context: "Ambulante verwijzing" },
  capacity:   { availableSlots: 5, waitingWeeks: 8 },
  insurer:    { isCovered: true, capRemaining: 5000 },
}, null, 2);

// ── Rules Engine visual explanation ─────────────────────────────────────────

function RulesEngineExplainer({ activeWorkflow, ruleCount }: {
  activeWorkflow: string;
  ruleCount:      number;
}) {
  const [open, setOpen] = useState(false);

  const steps = [
    { icon: FileText,  label: "Verwijsbrief",  sub: "PDF / e-mail",          color: "bg-slate-100 text-slate-700 border-slate-200"          },
    { icon: Brain,     label: "Mistral AI",     sub: "Extractie & tagging",   color: "bg-violet-100 text-violet-800 border-violet-200"        },
    { icon: Zap,       label: "Rules Engine",   sub: `${ruleCount} regels`,   color: "bg-forta-primary-soft text-forta-primary border-forta-border" },
    { icon: Settings2, label: "Label ranking",  sub: "4 labels beoordeeld",   color: "bg-amber-50 text-amber-800 border-amber-200"            },
  ];

  const outcomes = [
    { label: "JA",      cls: "bg-emerald-600 text-white",  desc: "Aanbevolen label" },
    { label: "TWIJFEL", cls: "bg-amber-500 text-white",    desc: "→ Screenteam"     },
    { label: "NEE",     cls: "bg-red-600 text-white",       desc: "Afgewezen"        },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-forta-border bg-white shadow-card overflow-hidden">
      {/* Header — altijd zichtbaar */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-forta-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forta-primary-soft">
            <Info className="h-4 w-4 text-forta-primary" />
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-forta-primary-dark">Hoe werkt de rules engine?</p>
            <p className="text-xs text-slate-500">
              Actief workflow: <span className="font-mono font-semibold text-forta-primary">{activeWorkflow}</span>
              {" · "}{ruleCount} actieve regels
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {/* Uitleg — uitklapbaar */}
      {open && (
        <div className="border-t border-forta-border px-5 pb-5 pt-4">
          <p className="mb-5 text-sm text-slate-600">
            Elke verwijsbrief doorloopt automatisch vier stappen. De rules engine evalueert geëxtraheerde gegevens
            tegen de geconfigureerde regels en geeft een advies terug aan het secretariaat.
          </p>

          {/* Flow diagram */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-2">
                  <div className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 min-w-[120px]",
                    s.color
                  )}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-xs font-bold leading-none">{s.label}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">{s.sub}</p>
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                  )}
                </div>
              );
            })}

            <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />

            {/* Outcomes */}
            <div className="flex flex-col gap-1.5">
              {outcomes.map(o => (
                <div key={o.label} className="flex items-center gap-1.5">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", o.cls)}>
                    {o.label}
                  </span>
                  <span className="text-[10px] text-slate-400">{o.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Regel typen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: ShieldAlert, label: "Exclusie",    desc: "Harde uitsluitcriteria (leeftijd, crisis)",      color: "text-red-600 bg-red-50 border-red-100"         },
              { icon: MapPin,      label: "Locatie",     desc: "Regio binnen servicegebied",                      color: "text-blue-700 bg-blue-50 border-blue-100"      },
              { icon: Clock,       label: "Capaciteit",  desc: "Beschikbare plekken en wachttijd",               color: "text-purple-700 bg-purple-50 border-purple-100" },
              { icon: CreditCard,  label: "Verzekering", desc: "Dekking en verzekeringsplafond",                 color: "text-teal-700 bg-teal-50 border-teal-100"      },
            ].map(t => {
              const Icon = t.icon;
              return (
                <div key={t.label} className={cn("rounded-xl border p-3", t.color)}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs font-bold">{t.label}</span>
                  </div>
                  <p className="text-[10px] leading-snug opacity-75">{t.desc}</p>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[11px] text-slate-400">
            Regels worden geëvalueerd bij elke AI Match. Bewerk expressies inline op de regelkaarten of via de JSON-tab;
            klik <strong>Opslaan &amp; herladen</strong> om wijzigingen actief te maken. Gebruik de AI-assistent voor nieuwe regels.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Rule card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule, onDelete, onExpressionChange, onErrorMessageChange,
}: {
  rule: RuleObj;
  onDelete: () => void;
  onExpressionChange: (expression: string) => void;
  onErrorMessageChange: (message: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon  = RULE_ICONS[rule.RuleName] ?? Settings2;
  const badge = ruleLabel(rule.RuleName);
  const req   = isRequired(rule.RuleName);

  return (
    <div className="rounded-xl border border-forta-border bg-white shadow-card transition-shadow hover:shadow-card-hover">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forta-primary-soft text-forta-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-forta-primary-dark text-sm">{rule.RuleName}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.color)}>
              {badge.label}
            </span>
            {req && (
              <span className="rounded-full bg-forta-primary/10 px-2 py-0.5 text-[10px] font-semibold text-forta-primary">
                Verplicht
              </span>
            )}
            {rule.ErrorType === "Warning" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Waarschuwing
              </span>
            )}
          </div>
          {!expanded && (
            <p className="mt-0.5 truncate text-xs text-slate-500">{rule.Expression}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!req && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Verwijder regel"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {expanded
            ? <ChevronDown className="h-4 w-4 text-slate-400" />
            : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-forta-border px-4 pb-4 pt-3 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Expressie
              <span className="ml-2 font-normal normal-case text-slate-400">— inline bewerkbaar</span>
            </p>
            <Textarea
              value={rule.Expression}
              onChange={e => onExpressionChange(e.target.value)}
              onClick={e => e.stopPropagation()}
              rows={4}
              spellCheck={false}
              className="font-mono text-xs leading-relaxed text-forta-primary-dark"
              placeholder="bijv. extraction.Age >= 18 AND extraction.RiskLevel != &quot;crisis&quot;"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Foutmelding bij afwijzing
            </p>
            <Textarea
              value={rule.ErrorMessage ?? ""}
              onChange={e => onErrorMessageChange(e.target.value)}
              onClick={e => e.stopPropagation()}
              rows={2}
              className="text-sm text-slate-700"
              placeholder="Tekst die wordt getoond als de regel faalt"
            />
          </div>
          <p className="text-[10px] text-slate-400">
            Wijzigingen worden direct in de JSON bijgewerkt. Klik <strong>Opslaan &amp; herladen</strong> om ze actief te maken in de engine.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const [rulesJson,     setRulesJson]     = useState("");
  const [workflows,     setWorkflows]     = useState<WorkflowObj[]>([]);
  const [testInput,     setTestInput]     = useState(SAMPLE_INPUT);
  const [testResult,    setTestResult]    = useState<{
    recommendation: string;
    ruleResults: { ruleName: string; passed: boolean; message: string | null }[];
  } | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [activeTab,     setActiveTab]     = useState<"chat" | "test" | "json">("chat");
  const [message,       setMessage]       = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showJsonError, setShowJsonError] = useState(false);

  // Chat state
  const [chatHistory,   setChatHistory]   = useState<ChatMessage[]>([
    { role: "assistant", content: "Hallo! Ik help je met het aanmaken en aanpassen van regels. Beschrijf een nieuwe regel in gewone taal — bijvoorbeeld: *\"Weiger patiënten jonger dan 18\"* of *\"Voeg een check toe voor crisis-situaties\"*." },
  ]);
  const [chatInput,     setChatInput]     = useState("");
  const [chatLoading,   setChatLoading]   = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rulesApi.get("ReferralMatch").then(w => {
      const raw = w.rulesJson;
      setRulesJson(raw);
      try {
        const parsed: WorkflowObj[] = JSON.parse(raw);
        setWorkflows(parsed);
      } catch { /* keep empty */ }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const syncJson = (wf: WorkflowObj[]) => {
    const j = JSON.stringify(wf, null, 2);
    setWorkflows(wf);
    setRulesJson(j);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      JSON.parse(rulesJson);
      await rulesApi.update("ReferralMatch", rulesJson);
      const parsed: WorkflowObj[] = JSON.parse(rulesJson);
      setWorkflows(parsed);
      setMessage({ type: "success", text: "Regels opgeslagen en engine herladen." });
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Ongeldige JSON of opslaan mislukt" });
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
      setMessage({ type: "error", text: "Ongeldige JSON in testinvoer" });
    }
  };

  const handleDeleteRule = (wfIdx: number, ruleIdx: number) => {
    const updated = workflows.map((wf, wi) =>
      wi === wfIdx ? { ...wf, Rules: wf.Rules.filter((_, ri) => ri !== ruleIdx) } : wf
    );
    syncJson(updated);
  };

  const handleUpdateRule = (wfIdx: number, ruleIdx: number, patch: Partial<RuleObj>) => {
    const updated = workflows.map((wf, wi) =>
      wi === wfIdx
        ? {
            ...wf,
            Rules: wf.Rules.map((r, ri) => (ri === ruleIdx ? { ...r, ...patch } : r)),
          }
        : wf
    );
    syncJson(updated);
  };

  const handleAddGeneratedRule = (ruleJson: string) => {
    try {
      const newRule: RuleObj = JSON.parse(ruleJson);
      if (!workflows.length) return;
      const updated = workflows.map((wf, i) =>
        i === 0 ? { ...wf, Rules: [...wf.Rules, newRule] } : wf
      );
      syncJson(updated);
      setMessage({ type: "success", text: `Regel "${newRule.RuleName}" toegevoegd. Vergeet niet op te slaan.` });
    } catch {
      setMessage({ type: "error", text: "Kon de gegenereerde regel niet toevoegen." });
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatHistory(h => [...h, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const result = await rulesApi.generate(userMsg, "ReferralMatch");
      if (result.success) {
        setChatHistory(h => [...h, {
          role:      "assistant",
          content:   `✅ Ik heb een nieuwe regel aangemaakt:\n\n**${result.ruleName}**\n\n${result.explanation}`,
          generated: result,
        }]);
      } else {
        setChatHistory(h => [...h, {
          role:    "assistant",
          content: `❌ Kon de regel niet aanmaken: ${result.error}`,
        }]);
      }
    } catch {
      setChatHistory(h => [...h, {
        role:    "assistant",
        content: "Er ging iets mis bij het genereren van de regel. Probeer het opnieuw.",
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) return <PageSkeleton />;

  const mainWorkflow = workflows[0];
  const rules = mainWorkflow?.Rules ?? [];

  return (
    <div className="page-container">
      <PageHeader
        title="Regelconfiguratie"
        description="Microsoft RulesEngine workflows — inclusie, locatie, capaciteit, verzekering, DSM."
      >
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Opslaan…" : "Opslaan & herladen"}
        </Button>
      </PageHeader>

      {message && (
        <Alert variant={message.type === "error" ? "error" : "success"} className="mb-6">
          {message.text}
        </Alert>
      )}

      {/* ── Rules Engine visual explainer ──────────────────────────── */}
      <RulesEngineExplainer
        activeWorkflow={mainWorkflow?.WorkflowName ?? "ReferralMatch"}
        ruleCount={rules.length}
      />

      <div className="grid gap-6 xl:grid-cols-5">

        {/* ── Left: Rule cards ────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-semibold text-forta-primary-dark">
                Workflow: {mainWorkflow?.WorkflowName ?? "ReferralMatch"}
              </h2>
              <p className="text-xs text-slate-500">{rules.length} actieve regels</p>
            </div>
          </div>

          {rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-forta-border py-12 text-center text-sm text-slate-500">
              Geen regels geconfigureerd. Gebruik de AI-assistent om regels toe te voegen.
            </div>
          ) : (
            rules.map((rule, ri) => (
              <RuleCard
                key={rule.RuleName + ri}
                rule={rule}
                onDelete={() => handleDeleteRule(0, ri)}
                onExpressionChange={expr => handleUpdateRule(0, ri, { Expression: expr })}
                onErrorMessageChange={msg => handleUpdateRule(0, ri, { ErrorMessage: msg })}
              />
            ))
          )}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-forta-border py-3 text-sm font-medium text-slate-500 transition-colors hover:border-forta-primary/40 hover:text-forta-primary"
            onClick={() => setActiveTab("chat")}
          >
            <Plus className="h-4 w-4" />
            Regel toevoegen via AI-assistent
          </button>
        </div>

        {/* ── Right: Tabs ─────────────────────────────────────────────── */}
        <div className="xl:col-span-2">
          <div className="rounded-xl border border-forta-border bg-white shadow-card overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-forta-border">
              {([
                { id: "chat", label: "AI-assistent", icon: Bot   },
                { id: "test", label: "Testen",        icon: Play  },
                { id: "json", label: "JSON",           icon: Code2 },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors",
                    activeTab === id
                      ? "border-b-2 border-forta-primary text-forta-primary bg-forta-primary-soft/50"
                      : "text-slate-500 hover:text-forta-primary hover:bg-forta-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* ── Chat tab ─────────────────────────────────────────── */}
            {activeTab === "chat" && (
              <div className="flex h-[560px] flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-2",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forta-primary text-white mt-0.5">
                          <Sparkles className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                          msg.role === "user"
                            ? "bg-forta-primary text-white rounded-br-sm"
                            : "bg-forta-muted text-forta-primary-dark rounded-bl-sm"
                        )}
                      >
                        {msg.content.split("\n").map((line, li) => (
                          <p key={li} className={line.startsWith("**") ? "font-semibold" : ""}>
                            {line.replace(/\*\*/g, "")}
                          </p>
                        ))}

                        {/* Generated rule preview + action buttons */}
                        {msg.generated?.success && (
                          <div className="mt-3 rounded-lg border border-forta-border bg-white p-3 space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Code2 className="h-3.5 w-3.5 text-forta-primary" />
                              <span className="text-xs font-semibold text-forta-primary-dark">
                                {msg.generated.ruleName}
                              </span>
                            </div>
                            <code className="block rounded bg-forta-muted px-2 py-1.5 text-[10px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap">
                              {(() => {
                                try {
                                  const parsed = JSON.parse(msg.generated.ruleJson);
                                  return parsed.Expression ?? msg.generated.ruleJson;
                                } catch {
                                  return msg.generated.ruleJson;
                                }
                              })()}
                            </code>
                            <div className="flex gap-2">
                              <button
                                className="flex items-center gap-1 rounded-lg bg-forta-primary px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-forta-primary-hover transition-colors"
                                onClick={() => handleAddGeneratedRule(msg.generated!.ruleJson)}
                              >
                                <Plus className="h-3 w-3" />
                                Toevoegen
                              </button>
                              <button
                                className="rounded-lg border border-forta-border px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-forta-muted transition-colors"
                                onClick={() => {
                                  setActiveTab("json");
                                  try {
                                    const rule = JSON.parse(msg.generated!.ruleJson);
                                    const updated = JSON.parse(rulesJson);
                                    if (updated[0]?.Rules) {
                                      updated[0].Rules.push(rule);
                                      const newJson = JSON.stringify(updated, null, 2);
                                      setRulesJson(newJson);
                                    }
                                  } catch { /* ignore */ }
                                }}
                              >
                                JSON bekijken
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex gap-2 justify-start">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forta-primary text-white">
                        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      </span>
                      <div className="rounded-2xl rounded-bl-sm bg-forta-muted px-4 py-3">
                        <div className="flex gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-forta-primary/40 animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-forta-primary/40 animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-forta-primary/40 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="border-t border-forta-border p-3">
                  <div className="flex gap-2">
                    <textarea
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
                      placeholder="Beschrijf een nieuwe regel in gewone taal…"
                      rows={2}
                      className="flex-1 resize-none rounded-xl border border-forta-border bg-forta-muted/50 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-forta-primary focus:outline-none focus:ring-1 focus:ring-forta-primary/30"
                      disabled={chatLoading}
                    />
                    <button
                      onClick={handleChat}
                      disabled={!chatInput.trim() || chatLoading}
                      className="flex h-10 w-10 self-end items-center justify-center rounded-xl bg-forta-primary text-white transition-colors hover:bg-forta-primary-hover disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    Enter om te versturen · Shift+Enter voor nieuwe regel
                  </p>
                </div>
              </div>
            )}

            {/* ── Test tab ─────────────────────────────────────────── */}
            {activeTab === "test" && (
              <div className="p-4 space-y-4">
                <p className="text-xs text-slate-500">Voer testdata in als JSON en evalueer de regels.</p>
                <Textarea
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  rows={12}
                  className="font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
                <Button variant="secondary" onClick={handleTest} className="w-full">
                  <Play className="mr-2 h-4 w-4" />
                  Test uitvoeren
                </Button>
                {testResult && (
                  <div className="rounded-xl border border-forta-border bg-forta-muted/50 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-600">Advies</span>
                      <StatusBadge value={testResult.recommendation} />
                    </div>
                    <ul className="space-y-2">
                      {testResult.ruleResults.map(r => (
                        <li
                          key={r.ruleName}
                          className={cn(
                            "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                            r.passed ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                          )}
                        >
                          {r.passed
                            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                          <span>
                            <span className="font-semibold">{r.ruleName}</span>
                            {r.message && ` — ${r.message}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── JSON tab ─────────────────────────────────────────── */}
            {activeTab === "json" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Gevorderde modus — wijzig de JSON direct en sla op.
                </div>
                <Textarea
                  value={rulesJson}
                  onChange={e => { setRulesJson(e.target.value); setShowJsonError(false); }}
                  rows={22}
                  className="font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
                {showJsonError && (
                  <p className="text-xs text-red-600">Ongeldige JSON — controleer de syntax.</p>
                )}
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Opslaan…" : "Opslaan & engine herladen"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
