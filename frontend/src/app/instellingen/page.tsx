"use client";

import { useEffect, useState } from "react";
import { emailApi } from "@/lib/api";
import type { EmailTemplate } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/Skeleton";
import { Alert } from "@/components/Alert";
import {
  Mail, Save, Info, Eye, Code2, ChevronRight,
  CheckCircle2, FileText, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const VARIABLES: Record<string, { key: string; example: string }[]> = {
  intake_herinnering: [
    { key: "naam_patiënt",       example: "J. de Vries"          },
    { key: "naam_verwijzer",     example: "Huisarts B. de Jong"  },
    { key: "ontbrekende_velden", example: "<li>AGB-code</li>"    },
  ],
  aanmelding_geaccepteerd: [
    { key: "naam_patiënt",   example: "J. de Vries"         },
    { key: "naam_verwijzer", example: "Huisarts B. de Jong" },
  ],
  aanmelding_afgewezen: [
    { key: "naam_patiënt",   example: "J. de Vries"                    },
    { key: "naam_verwijzer", example: "Huisarts B. de Jong"            },
    { key: "reden",          example: "Patiënt jonger dan 18 jaar"     },
  ],
};

function fillPreview(body: string, name: string): string {
  const vars = VARIABLES[name] ?? [];
  let result = body;
  for (const v of vars) {
    result = result.replace(new RegExp(`\\{\\{${v.key}\\}\\}`, "g"), `<mark style="background:#fef08a;padding:0 2px;border-radius:3px">${v.example}</mark>`);
  }
  return result;
}

type Tab = "bewerken" | "voorbeeld";

export default function InstellingenPage() {
  const [templates,  setTemplates]  = useState<EmailTemplate[]>([]);
  const [selected,   setSelected]   = useState<EmailTemplate | null>(null);
  const [subject,    setSubject]    = useState("");
  const [body,       setBody]       = useState("");
  const [tab,        setTab]        = useState<Tab>("bewerken");
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [dirty,      setDirty]      = useState(false);
  const [message,    setMessage]    = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    emailApi.getTemplates().then(ts => {
      setTemplates(ts);
      if (ts.length > 0) selectTemplate(ts[0]);
    }).finally(() => setLoading(false));
  }, []);

  const selectTemplate = (t: EmailTemplate) => {
    if (dirty && !confirm("Je hebt onopgeslagen wijzigingen. Toch wisselen?")) return;
    setSelected(t);
    setSubject(t.subject);
    setBody(t.body.trim());
    setTab("bewerken");
    setMessage(null);
    setDirty(false);
  };

  const handleSubjectChange = (v: string) => { setSubject(v); setDirty(true); };
  const handleBodyChange    = (v: string) => { setBody(v);    setDirty(true); };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await emailApi.updateTemplate(selected.name, subject, body);
      setTemplates(ts => ts.map(t => t.name === selected.name ? updated : t));
      setSelected(updated);
      setDirty(false);
      setMessage({ type: "success", text: "Template opgeslagen." });
    } catch {
      setMessage({ type: "error", text: "Opslaan mislukt." });
    } finally {
      setSaving(false);
    }
  };

  const insertVar = (key: string) => {
    const snippet = `{{${key}}}`;
    setBody(b => b + snippet);
    setDirty(true);
  };

  if (loading) return <PageSkeleton />;

  const vars = selected ? (VARIABLES[selected.name] ?? []) : [];

  return (
    <div className="page-container max-w-7xl">
      <PageHeader
        title="E-mailtemplates"
        description="Beheer de standaard e-mails die automatisch verstuurd worden aan verwijzers."
      />

      {message && (
        <Alert variant={message.type === "error" ? "error" : "success"} className="mb-4">
          {message.text}
        </Alert>
      )}

      <div className="flex gap-6 min-h-[calc(100vh-220px)]">

        {/* ── Sidebar: template kiezer ────────────────────────────────── */}
        <aside className="w-56 shrink-0">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Templates</p>
          <div className="space-y-1">
            {templates.map(t => (
              <button
                key={t.name}
                onClick={() => selectTemplate(t)}
                className={cn(
                  "w-full rounded-xl border px-3 py-3 text-left transition-all",
                  selected?.name === t.name
                    ? "border-forta-primary bg-forta-primary text-white shadow-sm"
                    : "border-forta-border bg-white text-slate-600 hover:border-forta-primary/40 hover:bg-forta-primary-soft/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-sm font-medium leading-snug">{t.displayName}</span>
                </div>
                <p className={cn("mt-1 truncate text-[10px]",
                  selected?.name === t.name ? "text-white/70" : "text-slate-400")}>
                  {t.subject}
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="mt-6">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Variabelen</p>
              <div className="space-y-1">
                {vars.map(v => (
                  <button
                    key={v.key}
                    onClick={() => insertVar(v.key)}
                    title={`Klik om in te voegen: {{${v.key}}}`}
                    className="flex w-full items-center justify-between rounded-lg border border-forta-border bg-white px-2.5 py-1.5 text-left hover:border-forta-primary/40 hover:bg-forta-primary-soft/40 transition-colors group"
                  >
                    <code className="text-[10px] font-mono text-forta-primary">{`{{${v.key}}}`}</code>
                    <ChevronRight className="h-2.5 w-2.5 text-slate-300 group-hover:text-forta-primary transition-colors" />
                  </button>
                ))}
              </div>
              <p className="mt-2 px-1 text-[9px] text-slate-400">Klik om in te voegen in de tekst</p>
            </div>
          )}
        </aside>

        {/* ── Editor ──────────────────────────────────────────────────── */}
        {selected ? (
          <div className="flex-1 flex flex-col gap-0 rounded-2xl border border-forta-border bg-white shadow-card overflow-hidden">

            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-forta-border px-5 py-3 bg-forta-muted/30">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-forta-primary" />
                <span className="font-semibold text-forta-primary-dark">{selected.displayName}</span>
                {dirty && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Niet opgeslagen
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Tabs */}
                <div className="flex rounded-lg border border-forta-border bg-white p-0.5">
                  {([
                    { id: "bewerken", icon: Code2, label: "Bewerken" },
                    { id: "voorbeeld", icon: Eye,  label: "Voorbeeld" },
                  ] as const).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                        tab === id
                          ? "bg-forta-primary text-white shadow-sm"
                          : "text-slate-500 hover:text-forta-primary"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                    dirty
                      ? "bg-forta-primary text-white hover:bg-forta-primary-hover shadow-sm"
                      : "bg-forta-muted text-slate-400 cursor-not-allowed"
                  )}
                >
                  {saving
                    ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Opslaan…</>
                    : <><Save className="h-3.5 w-3.5" />{dirty ? "Opslaan" : "Opgeslagen"}</>
                  }
                </button>
              </div>
            </div>

            {/* Onderwerp */}
            <div className="flex items-center gap-3 border-b border-forta-border px-5 py-3">
              <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">Onderwerp</span>
              <input
                value={subject}
                onChange={e => handleSubjectChange(e.target.value)}
                className="flex-1 rounded-lg border-0 bg-transparent py-1 text-sm font-medium text-forta-primary-dark placeholder:text-slate-300 focus:outline-none focus:ring-0"
                placeholder="E-mailonderwerp…"
              />
            </div>

            {/* Variabelen hint */}
            {vars.length > 0 && tab === "bewerken" && (
              <div className="flex items-center gap-2 border-b border-forta-border bg-sky-50/50 px-5 py-2 text-xs text-sky-700">
                <Info className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                <span>
                  Gebruik {vars.map((v, i) => (
                    <span key={v.key}>
                      <button onClick={() => insertVar(v.key)} className="font-mono font-semibold hover:underline">{`{{${v.key}}}`}</button>
                      {i < vars.length - 1 ? ", " : ""}
                    </span>
                  ))} voor dynamische waarden. Klik om in te voegen.
                </span>
              </div>
            )}

            {/* Editor / Preview */}
            <div className="flex-1 overflow-hidden">
              {tab === "bewerken" ? (
                <textarea
                  value={body}
                  onChange={e => handleBodyChange(e.target.value)}
                  spellCheck={false}
                  placeholder="HTML-inhoud van de e-mail…"
                  className="h-full w-full resize-none p-5 font-mono text-sm leading-relaxed text-slate-700 focus:outline-none"
                  style={{ minHeight: "480px" }}
                />
              ) : (
                <div className="h-full overflow-y-auto p-6 bg-white">
                  <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white shadow-sm">
                    {/* Email header simulatie */}
                    <div className="rounded-t-xl border-b border-slate-100 bg-slate-50 px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forta-primary">
                          <Mail className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Forta Match — Secretariaat</p>
                          <p className="text-xs text-slate-400">secretariaat@fortamatch.nl</p>
                        </div>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-slate-800">
                        {subject
                          .replace(/\{\{naam_patiënt\}\}/g, "J. de Vries")
                          .replace(/\{\{naam_verwijzer\}\}/g, "Huisarts B. de Jong")
                        }
                      </div>
                    </div>
                    {/* Email body */}
                    <div
                      className="prose prose-sm max-w-none px-6 py-5 text-slate-700"
                      dangerouslySetInnerHTML={{ __html: fillPreview(body, selected.name) }}
                    />
                    <div className="rounded-b-xl border-t border-slate-100 bg-slate-50 px-6 py-3 text-xs text-slate-400">
                      Forta Match · AI-ondersteund doorverwijzingsplatform · forta.nl
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between border-t border-forta-border bg-forta-muted/20 px-5 py-2 text-[10px] text-slate-400">
              <span>HTML ondersteund · variabelen via {"{{naam}}"}  syntaxis</span>
              <span className="flex items-center gap-1">
                {dirty
                  ? <><XCircle className="h-3 w-3 text-amber-400" /> Wijzigingen niet opgeslagen</>
                  : <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Opgeslagen</>
                }
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Kies een template links
          </div>
        )}
      </div>
    </div>
  );
}
