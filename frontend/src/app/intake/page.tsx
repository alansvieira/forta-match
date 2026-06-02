"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { StepIndicator } from "@/components/StepIndicator";
import { Alert } from "@/components/Alert";
import { intakeApi, matchApi, emailApi } from "@/lib/api";
import type { PrescanResult, PrescanField } from "@/lib/types";
import {
  Sparkles, Bot, CheckCircle2, AlertCircle, Loader2,
  Mail, X, ArrowLeft, FileText, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Steps ───────────────────────────────────────────────────────────────────

type StepId = "upload" | "register" | "validate" | "match";

const STEPS = [
  { id: "upload",   label: "Upload"       },
  { id: "register", label: "Registratie"  },
  { id: "validate", label: "Volledigheid" },
  { id: "match",    label: "AI Match"     },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.8)
    return <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{pct}%</span>;
  if (confidence >= 0.55)
    return <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{pct}%</span>;
  return   <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">{pct}%</span>;
}

interface AiFieldProps {
  label:       string;
  field:       PrescanField | null;
  value:       string;
  onChange:    (v: string) => void;
  type?:       string;
  placeholder?: string;
  required?:   boolean;
  textarea?:   boolean;
  rows?:       number;
}

function AiField({ label, field, value, onChange, type = "text", placeholder, required, textarea, rows = 2 }: AiFieldProps) {
  const ai = !!field;
  return (
    <div>
      <Label className="flex items-center gap-1 mb-1">
        {label}
        {required && <span className="text-forta-primary">*</span>}
        {ai && <><Sparkles className="h-3 w-3 text-amber-500" /><ConfidenceBadge confidence={field.confidence} /></>}
      </Label>
      {textarea ? (
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={cn(ai && "border-amber-200 bg-amber-50/60 focus:border-amber-400")}
        />
      ) : (
        <Input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(ai && "border-amber-200 bg-amber-50/60 focus:border-amber-400")}
        />
      )}
    </div>
  );
}

// ─── Email Reminder Modal ─────────────────────────────────────────────────────

function EmailReminderModal({ patientName, referrerEmail, missingFields, onClose }: {
  patientName:   string;
  referrerEmail: string;
  missingFields: string[];
  onClose:       () => void;
}) {
  const [to,      setTo]      = useState(referrerEmail);
  const [subject, setSubject] = useState("Verwijsbrief incompleet — aanvullende informatie vereist");
  const [body,    setBody]    = useState("");
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  useEffect(() => {
    emailApi.getTemplate("intake_herinnering").then(t => {
      const fieldsList = missingFields.map(f => `<li>${f}</li>`).join("");
      setSubject(t.subject.replace(/\{\{naam_patiënt\}\}/g, patientName));
      setBody(t.body
        .replace(/\{\{naam_patiënt\}\}/g, patientName)
        .replace(/\{\{naam_verwijzer\}\}/g, "Verwijzer")
        .replace(/\{\{ontbrekende_velden\}\}/g, fieldsList));
    }).catch(() => {
      setBody(`Geachte verwijzer,\n\nDe verwijsbrief voor ${patientName} is onvolledig.\nOntbrekend: ${missingFields.join(", ")}\n\nMet vriendelijke groet,\nForta Match`);
    });
  }, [patientName, missingFields]);

  const handleSend = async () => {
    if (!to.trim()) return;
    setSending(true);
    try {
      await emailApi.send(to, subject, body);
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl rounded-2xl border border-forta-border bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-forta-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-forta-primary" />
            <span className="font-semibold text-forta-primary-dark">Herinnering sturen naar verwijzer</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-forta-muted hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <p className="text-lg font-semibold text-forta-primary-dark">Verstuurd!</p>
            <p className="text-sm text-slate-500">De herinnering is verstuurd naar {to}</p>
            <button onClick={onClose} className="mt-2 rounded-xl bg-forta-primary px-6 py-2 text-sm font-semibold text-white hover:bg-forta-primary-hover">
              Sluiten
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Aan</label>
              <input value={to} onChange={e => setTo(e.target.value)}
                className="w-full rounded-xl border border-forta-border px-3 py-2.5 text-sm focus:border-forta-primary focus:outline-none focus:ring-1 focus:ring-forta-primary/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Onderwerp</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full rounded-xl border border-forta-border px-3 py-2.5 text-sm focus:border-forta-primary focus:outline-none focus:ring-1 focus:ring-forta-primary/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Bericht</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={9}
                className="w-full resize-y rounded-xl border border-forta-border px-3 py-2.5 text-sm focus:border-forta-primary focus:outline-none focus:ring-1 focus:ring-forta-primary/20" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSend} disabled={sending || !to.trim()}
                className="flex items-center gap-2 rounded-xl bg-forta-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-forta-primary-hover disabled:opacity-50">
                <Mail className="h-4 w-4" />
                {sending ? "Versturen…" : "Versturen"}
              </button>
              <button onClick={onClose}
                className="rounded-xl border border-forta-border px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-forta-muted">
                Annuleren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntakePage() {
  const router = useRouter();

  const [step,           setStep]           = useState<StepId>("upload");
  const [visited,        setVisited]        = useState<StepId[]>(["upload"]);
  const [referralId,     setReferralId]     = useState<string | null>(null);
  const [file,           setFile]           = useState<File | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [scanning,       setScanning]       = useState(false);
  const [missingFields,  setMissingFields]  = useState<string[]>([]);
  const [error,          setError]          = useState<string | null>(null);
  const [success,        setSuccess]        = useState<string | null>(null);
  const [prescan,        setPrescan]        = useState<PrescanResult | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [fromEmail,      setFromEmail]      = useState(false);

  const [form, setForm] = useState({
    name: "", bsn: "", contactDetails: "", email: "", phone: "",
    referrerAgb: "", referralDate: new Date().toISOString().split("T")[0],
    hasSignature: false, probableDsm: "", complaint: "", location: "",
    insurer: "", letterText: "",
  });

  const f = (key: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [key]: v }));

  const goTo = (s: StepId) => {
    setStep(s);
    setError(null);
    setSuccess(null);
    if (!visited.includes(s)) setVisited(v => [...v, s]);
  };

  const applyPrescan = (p: PrescanResult) => {
    setPrescan(p);
    setForm(prev => ({
      ...prev,
      name:           p.name?.value           ?? prev.name,
      bsn:            p.bsn?.value            ?? prev.bsn,
      contactDetails: p.contactDetails?.value ?? prev.contactDetails,
      email:          p.email?.value          ?? prev.email,
      phone:          p.phone?.value          ?? prev.phone,
      referrerAgb:    p.referrerAgb?.value    ?? prev.referrerAgb,
      referralDate:   p.referralDate?.value   ?? prev.referralDate,
      hasSignature:   p.hasSignature?.value === "true" ? true : prev.hasSignature,
      probableDsm:    p.probableDsm?.value    ?? prev.probableDsm,
      complaint:      p.complaint?.value      ?? prev.complaint,
      location:       p.location?.value       ?? prev.location,
      insurer:        p.insurer?.value        ?? prev.insurer,
      letterText:     p.letterText            ?? prev.letterText,
    }));
  };

  // Van e-mailnotificatie binnengekomen
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingIntake");
    if (!pending) return;
    try {
      const { referralId: rid, prescan: p, fromEmail: fe, attachmentFileName } = JSON.parse(pending);
      sessionStorage.removeItem("pendingIntake");
      setReferralId(rid);
      setFromEmail(!!fe);
      applyPrescan(p);
      setVisited(["upload", "register"]);
      goTo("register");
      setSuccess(attachmentFileName
        ? `E-mail ontvangen — "${attachmentFileName}" ingelezen en automatisch ingevuld door AI.`
        : "E-mail ontvangen — formulier automatisch ingevuld op basis van de verwijsbrief.");
    } catch { /* negeer */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setError(null); setSuccess(null);
    try {
      const result = await intakeApi.upload(file, referralId ?? undefined);
      setReferralId(result.referralId);
      setScanning(true);
      try {
        const p = await intakeApi.prescan(result.referralId);
        applyPrescan(p);
        setSuccess("Verwijsbrief geüpload — formulier is vooringevuld door AI.");
      } catch {
        setSuccess("Verwijsbrief geüpload. Vul de gegevens hieronder aan.");
      } finally { setScanning(false); }
      setVisited(v => [...v, "register"]);
      goTo("register");
    } catch {
      setError("Upload mislukt. Controleer of de backend actief is.");
    } finally { setLoading(false); }
  };

  const saveRegistration = async () => {
    if (!referralId) throw new Error("Geen referral");
    return intakeApi.register({
      ...form,
      referrerAgb: form.referrerAgb.trim(),
      referralDate: form.referralDate ? new Date(form.referralDate).toISOString() : null,
      referralId,
    });
  };

  const handleRegister = async () => {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const data = await saveRegistration();
      setReferralId(data.id);
      setVisited(v => [...v, "validate"]);
      goTo("validate");
      const result = await intakeApi.validate(data.id);
      setMissingFields(result.missingFields);
      if (!result.isComplete)
        setError(`Ontbrekende velden: ${result.missingFields.join(", ")}`);
    } catch { setError("Registratie mislukt."); }
    finally { setLoading(false); }
  };

  const handleValidate = async () => {
    if (!referralId) return;
    setLoading(true); setError(null); setSuccess(null);
    try {
      await saveRegistration();
      const result = await intakeApi.validate(referralId);
      if (result.isComplete) {
        setMissingFields([]);
        setVisited(v => [...v, "match"]);
        goTo("match");
        setSuccess("Alle verplichte velden aanwezig. Klaar voor AI Match.");
      } else {
        setMissingFields(result.missingFields);
        setError(`Ontbrekende velden: ${result.missingFields.join(", ")}`);
      }
    } catch { setError("Volledigheidscheck mislukt."); }
    finally { setLoading(false); }
  };

  const handleRunMatch = async () => {
    if (!referralId) return;
    setLoading(true); setError(null);
    try {
      await matchApi.run(referralId);
      router.push(`/referrals/${referralId}`);
    } catch { setError("AI Match mislukt."); }
    finally { setLoading(false); }
  };

  const aiFilledCount = prescan
    ? [prescan.name, prescan.bsn, prescan.contactDetails, prescan.email, prescan.phone,
       prescan.referrerAgb, prescan.referralDate, prescan.probableDsm, prescan.complaint,
       prescan.location, prescan.insurer].filter(Boolean).length
    : 0;

  // ── Nav header per stap ──────────────────────────────────────────────────────

  const BackButton = ({ to, label }: { to: StepId; label: string }) => (
    <button
      onClick={() => goTo(to)}
      className="mb-5 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-forta-primary transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );

  const CancelButton = () => (
    <button
      onClick={() => router.push("/referrals")}
      className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
    >
      Annuleren
    </button>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page-container max-w-3xl">
      <div className="mb-2 flex items-start justify-between">
        <PageHeader
          title="Nieuwe intake"
          description="Verwijsbrief ontvangen, patiënt registreren, volledigheid controleren."
        />
        <div className="mt-8 shrink-0">
          <CancelButton />
        </div>
      </div>

      <StepIndicator
        steps={STEPS}
        current={step}
        visited={visited}
        onStepClick={id => goTo(id as StepId)}
      />

      {error   && <Alert variant="error"   className="mb-5">{error}</Alert>}
      {success && <Alert variant="success" className="mb-5">{success}</Alert>}

      {/* ── UPLOAD ─────────────────────────────────────────────────────── */}
      {step === "upload" && (
        <Card>
          <CardHeader className="border-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-forta-primary" />
              Verwijsbrief uploaden
            </CardTitle>
            <p className="text-sm text-slate-500">PDF, Word of ZorgMail van de verwijzend arts</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <FileUpload onFileSelect={setFile} disabled={loading} />
            {scanning && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                Mistral AI scant verwijsbrief en vult formulier in…
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button onClick={handleUpload} disabled={!file || loading || scanning} size="lg">
                {loading ? "Uploaden…" : "Uploaden en doorgaan"}
              </Button>
              {referralId && (
                <button
                  onClick={() => goTo("register")}
                  className="text-sm font-medium text-forta-primary hover:underline"
                >
                  Sla upload over →
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── REGISTRATIE ────────────────────────────────────────────────── */}
      {step === "register" && (
        <>
          <BackButton to="upload" label="Terug naar upload" />
          <Card>
            <CardHeader className="border-0 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-forta-primary" />
                Patiëntregistratie
                {aiFilledCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    {aiFilledCount} velden door AI ingevuld
                  </span>
                )}
              </CardTitle>
              <p className="text-sm text-slate-500">Verplichte velden voor Medicore en volledigheidscheck</p>
            </CardHeader>
            <CardContent>
              {fromEmail && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  <Mail className="h-4 w-4 shrink-0 text-sky-600" />
                  <span><strong>Binnengekomen via e-mail</strong> — bijlage automatisch ingelezen door Mistral AI.</span>
                </div>
              )}
              {prescan?.aiSource === "local" && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                  <Bot className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                  <span>
                    <strong>Lokale extractie</strong> — velden zijn uit de brieftekst gehaald.
                    {prescan.aiMessage
                      ? <> {prescan.aiMessage}</>
                      : <> Zet <code className="rounded bg-sky-100 px-1">MISTRAL_API_KEY</code> in <code className="rounded bg-sky-100 px-1">config/.env</code> voor Mistral AI.</>}
                  </span>
                </div>
              )}
              {aiFilledCount > 0 && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    <strong>AI heeft {aiFilledCount} velden vooringevuld.</strong>{" "}
                    Controleer en pas aan waar nodig. Velden met <Sparkles className="inline h-3 w-3 text-amber-500" /> zijn AI-gegenereerd.
                  </span>
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <AiField label="Naam patiënt"       field={prescan?.name          ?? null} value={form.name}           onChange={f("name")}           required placeholder="Voornaam Achternaam" />
                <AiField label="BSN"                field={prescan?.bsn           ?? null} value={form.bsn}            onChange={f("bsn")}            required placeholder="9-cijferig BSN" />
                <AiField label="Contactgegevens"    field={prescan?.contactDetails ?? null} value={form.contactDetails} onChange={f("contactDetails")} required placeholder="Adres, postcode, plaats" />
                <AiField label="E-mailadres"        field={prescan?.email         ?? null} value={form.email}          onChange={f("email")}          type="email" placeholder="patiënt@email.nl" />
                <AiField label="Telefoonnummer"     field={prescan?.phone         ?? null} value={form.phone}          onChange={f("phone")}          placeholder="06-12345678" />
                <AiField label="AGB-code verwijzer" field={prescan?.referrerAgb   ?? null} value={form.referrerAgb}    onChange={f("referrerAgb")}    required placeholder="8-cijferige AGB-code" />
                <AiField label="Datum verwijsbrief" field={prescan?.referralDate  ?? null} value={form.referralDate}   onChange={f("referralDate")}   required type="date" />
                <AiField label="Locatievoorkeur"    field={prescan?.location      ?? null} value={form.location}       onChange={f("location")}       required placeholder="bijv. Utrecht" />
                <AiField label="Vermoedelijke DSM"  field={prescan?.probableDsm   ?? null} value={form.probableDsm}    onChange={f("probableDsm")}    required placeholder="bijv. F32.1" />
                <AiField label="Zorgverzekeraar"    field={prescan?.insurer       ?? null} value={form.insurer}        onChange={f("insurer")}        placeholder="bijv. Zilveren Kruis" />
                <div className="sm:col-span-2">
                  <AiField label="Hulpvraag omschrijving" field={prescan?.complaint ?? null} value={form.complaint} onChange={f("complaint")} required textarea rows={2} placeholder="Korte omschrijving van de hulpvraag" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1 block">Brieftekst <span className="font-normal text-slate-400">(voor AI-extractie)</span></Label>
                  <Textarea value={form.letterText} onChange={e => setForm(p => ({ ...p, letterText: e.target.value }))} rows={4} placeholder="Plak hier de tekst van de verwijsbrief…" />
                </div>
                <label className="sm:col-span-2 flex cursor-pointer items-center gap-2.5 rounded-xl border border-forta-border bg-forta-muted/40 px-4 py-3 text-sm text-slate-700 hover:bg-forta-primary-soft/30 transition-colors">
                  <input type="checkbox" checked={form.hasSignature} onChange={e => setForm(p => ({ ...p, hasSignature: e.target.checked }))}
                    className="h-4 w-4 rounded border-forta-border text-forta-primary focus:ring-forta-primary" />
                  Brief bevat handtekening arts <span className="text-forta-primary">*</span>
                  {prescan?.hasSignature && <Sparkles className="h-3 w-3 text-amber-500" />}
                </label>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <Button onClick={handleRegister} disabled={loading} size="lg">
                  {loading ? "Opslaan…" : "Registreren en doorgaan"}
                </Button>
                <button onClick={() => goTo("upload")} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  ← Terug
                </button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── VOLLEDIGHEID ───────────────────────────────────────────────── */}
      {step === "validate" && (
        <>
          <BackButton to="register" label="Terug naar registratie" />
          <Card>
            <CardHeader className="border-0 pb-2">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-forta-primary" />
                Volledigheidscheck
              </CardTitle>
              <p className="text-sm text-slate-500">Naam, BSN, contact, AGB-code, datum, handtekening, DSM, hulpvraag, locatie</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                Wijzigingen op de registratiestap worden hier automatisch opgeslagen voordat de check draait.
              </p>
              {missingFields.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <AlertCircle className="h-4 w-4" /> Ontbrekende velden
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 mb-4">
                    {missingFields.map(f => <li key={f}>{f}</li>)}
                  </ul>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => goTo("register")}
                      className="flex items-center gap-1.5 rounded-xl bg-forta-primary px-4 py-2 text-sm font-semibold text-white hover:bg-forta-primary-hover transition-colors">
                      <ArrowLeft className="h-3.5 w-3.5" /> Aanvullen in registratie
                    </button>
                    <button onClick={() => setShowEmailModal(true)}
                      className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 transition-colors">
                      <Mail className="h-3.5 w-3.5" /> Herinnering sturen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> Alle velden volledig — klaar voor AI Match
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button onClick={handleValidate} disabled={loading} size="lg">
                  {loading ? "Controleren…" : "Volledigheidscheck uitvoeren"}
                </Button>
                <button onClick={() => goTo("register")} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  ← Terug
                </button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── AI MATCH ───────────────────────────────────────────────────── */}
      {step === "match" && (
        <>
          <BackButton to="validate" label="Terug naar volledigheidscheck" />
          <Card className="border-forta-primary/20 bg-gradient-to-br from-white to-forta-primary-soft/30">
            <CardHeader className="border-0 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-forta-primary" />
                AI Match uitvoeren
              </CardTitle>
              <p className="text-sm text-slate-500">Mistral extractie → Rules Engine → Label ranking → JA / TWIJFEL / NEE</p>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
                {["Extractie via Mistral", "4 labels beoordeeld", "Parallelrun feedback"].map(t => (
                  <div key={t} className="rounded-xl border border-forta-border bg-white py-3 px-2 font-medium">
                    {t}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleRunMatch} disabled={loading} size="lg">
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verwerken…</>
                  ) : (
                    <><Zap className="mr-2 h-4 w-4" />Match starten</>
                  )}
                </Button>
                <button onClick={() => goTo("validate")} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  ← Terug
                </button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {showEmailModal && (
        <EmailReminderModal
          patientName={form.name || "Patiënt"}
          referrerEmail={form.email || ""}
          missingFields={missingFields}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
}
