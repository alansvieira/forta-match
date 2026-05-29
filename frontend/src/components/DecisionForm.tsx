"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface DecisionFormProps {
  onDecide: (outcome: "accept" | "reject", reason: string, requiresPhone: boolean) => Promise<void>;
  onOverride?: (outcome: "accept" | "reject", reason: string) => Promise<void>;
  showOverride?: boolean;
  loading?: boolean;
}

export function DecisionForm({ onDecide, onOverride, showOverride, loading }: DecisionFormProps) {
  const [reason, setReason] = useState("");
  const [requiresPhone, setRequiresPhone] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Human decision</CardTitle>
        <CardDescription>Document rationale — human override always possible</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label>Reason</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Clinical rationale for this decision..."
            rows={3}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={requiresPhone}
            onChange={(e) => setRequiresPhone(e.target.checked)}
            className="h-4 w-4 rounded border-forta-border text-forta-primary focus:ring-forta-primary"
          />
          Requires phone contact / additional assessment (~40% of complex cases)
        </label>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button disabled={loading || !reason.trim()} variant="success" onClick={() => onDecide("accept", reason, requiresPhone)}>
            Accept referral
          </Button>
          <Button disabled={loading || !reason.trim()} variant="danger" onClick={() => onDecide("reject", reason, requiresPhone)}>
            Reject referral
          </Button>
          {showOverride && onOverride && (
            <>
              <Button disabled={loading || !reason.trim()} variant="outline" onClick={() => onOverride("accept", reason)}>
                Override → Accept
              </Button>
              <Button disabled={loading || !reason.trim()} variant="outline" onClick={() => onOverride("reject", reason)}>
                Override → Reject
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
