"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { StepIndicator } from "@/components/StepIndicator";
import { Alert } from "@/components/Alert";
import { intakeApi, matchApi } from "@/lib/api";
import { Sparkles } from "lucide-react";

const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "register", label: "Register" },
  { id: "validate", label: "Validate" },
  { id: "match", label: "AI Match" },
];

export default function IntakePage() {
  const router = useRouter();
  const [referralId, setReferralId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "register" | "validate" | "match">("upload");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    bsn: "",
    contactDetails: "",
    email: "",
    phone: "",
    referrerAgb: "",
    referralDate: new Date().toISOString().split("T")[0],
    hasSignature: false,
    probableDsm: "",
    complaint: "",
    location: "",
    insurer: "",
    letterText: "",
  });

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await intakeApi.upload(file, referralId ?? undefined);
      setReferralId(result.referralId);
      setStep("register");
      setSuccess("File uploaded successfully. Complete patient registration below.");
    } catch {
      setError("Upload failed. Ensure the backend is running on port 5072.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await intakeApi.register({
        ...form,
        referralDate: form.referralDate ? new Date(form.referralDate).toISOString() : null,
        referralId: referralId ?? undefined,
      });
      setReferralId(data.id);
      setStep("validate");
      setSuccess("Patient registered. Run the completeness check next.");
    } catch {
      setError("Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!referralId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await intakeApi.validate(referralId);
      if (result.isComplete) {
        setMissingFields([]);
        setStep("match");
        setSuccess("All required fields present. Ready for AI Match.");
      } else {
        setMissingFields(result.missingFields);
        setError(`Please complete: ${result.missingFields.join(", ")}`);
      }
    } catch {
      setError("Validation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunMatch = async () => {
    if (!referralId) return;
    setLoading(true);
    setError(null);
    try {
      await matchApi.run(referralId);
      router.push(`/referrals/${referralId}`);
    } catch {
      setError("AI Match failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-4xl">
      <PageHeader
        title="Intake & Registration"
        description="Phase 1 — Receive referral letter, register in Medicore, verify completeness."
      />

      <StepIndicator steps={STEPS} current={step} />

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}
      {success && <Alert variant="success" className="mb-6">{success}</Alert>}

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload referral letter</CardTitle>
            <CardDescription>PDF, Word document, or image from the referring physician</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FileUpload onFileSelect={setFile} disabled={loading} />
            <Button onClick={handleUpload} disabled={!file || loading} size="lg">
              Upload and continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "register" && (
        <Card>
          <CardHeader>
            <CardTitle>Patient registration</CardTitle>
            <CardDescription>Required fields for Medicore and completeness check</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>BSN *</Label><Input value={form.bsn} onChange={(e) => setForm({ ...form, bsn: e.target.value })} /></div>
              <div><Label>Contact details *</Label><Input value={form.contactDetails} onChange={(e) => setForm({ ...form, contactDetails: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Referrer AGB *</Label><Input value={form.referrerAgb} onChange={(e) => setForm({ ...form, referrerAgb: e.target.value })} /></div>
              <div><Label>Referral date *</Label><Input type="date" value={form.referralDate} onChange={(e) => setForm({ ...form, referralDate: e.target.value })} /></div>
              <div><Label>Location *</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Noord-Holland" /></div>
              <div><Label>Probable DSM *</Label><Input value={form.probableDsm} onChange={(e) => setForm({ ...form, probableDsm: e.target.value })} placeholder="e.g. F32.1" /></div>
              <div><Label>Insurer</Label><Input value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} /></div>
              <div className="sm:col-span-2">
                <Label>Complaint *</Label>
                <Textarea value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Label>Letter text (for AI extraction)</Label>
                <Textarea value={form.letterText} onChange={(e) => setForm({ ...form, letterText: e.target.value })} rows={4} placeholder="Paste referral letter content..." />
              </div>
              <label className="sm:col-span-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.hasSignature} onChange={(e) => setForm({ ...form, hasSignature: e.target.checked })} className="h-4 w-4 rounded border-forta-border text-forta-primary focus:ring-forta-primary" />
                Letter includes signature *
              </label>
            </div>
            <Button onClick={handleRegister} disabled={loading} className="mt-6" size="lg">
              Register in Medicore
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "validate" && (
        <Card>
          <CardHeader>
            <CardTitle>Completeness check</CardTitle>
            <CardDescription>Name, BSN, contact, AGB, date, signature, DSM, complaint, location</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {missingFields.length > 0 && (
              <ul className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 list-disc list-inside">
                {missingFields.map((f) => (
                  <li key={f}>Missing: {f}</li>
                ))}
              </ul>
            )}
            <Button onClick={handleValidate} disabled={loading} size="lg">
              Run completeness check
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "match" && (
        <Card className="border-forta-primary/20 bg-gradient-to-br from-white to-forta-primary-soft/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-forta-primary" />
              Run AI Match
            </CardTitle>
            <CardDescription>Mistral extraction → Rules engine → YES / NO / UNCERTAIN</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRunMatch} disabled={loading} size="lg">
              {loading ? "Processing..." : "Extract & evaluate rules"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
