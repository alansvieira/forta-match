"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/input";
import {
  type ConditionRow,
  type Connector,
  type ConditionOperator,
  RULE_FIELDS,
  compileRule,
  builderStateFromExpression,
  createEmptyRow,
  defaultOperatorsForType,
  getFieldDef,
  operatorLabel,
  parseExpression,
} from "@/lib/ruleSchema";
import { Plus, Trash2, ChevronDown, ChevronRight, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RuleBuilderState {
  mode: "visual" | "raw";
  connector: Connector;
  rows: ConditionRow[];
  rawExpression: string;
}

interface RuleConditionBuilderProps {
  expression: string;
  errorMessage: string;
  previewPassed: boolean | null;
  previewMessage: string | null;
  onExpressionChange: (expression: string) => void;
  onErrorMessageChange: (message: string) => void;
}

function groupLabel(group: string): string {
  const map: Record<string, string> = {
    extraction: "Patiënt / extractie",
    capacity: "Capaciteit",
    insurer: "Verzekering",
  };
  return map[group] ?? group;
}

export function RuleConditionBuilder({
  expression,
  errorMessage,
  previewPassed,
  previewMessage,
  onExpressionChange,
  onErrorMessageChange,
}: RuleConditionBuilderProps) {
  const initial = useMemo(() => builderStateFromExpression(expression), [expression]);
  const [mode, setMode] = useState<"visual" | "raw">(initial.mode);
  const [connector, setConnector] = useState<Connector>(initial.connector);
  const [rows, setRows] = useState<ConditionRow[]>(initial.rows);
  const [rawExpression, setRawExpression] = useState(expression);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const localCompiled =
      mode === "visual" ? compileRule(rows, connector) : rawExpression.trim();
    if (localCompiled === expression.trim()) return;
    const next = builderStateFromExpression(expression);
    setMode(next.mode);
    setConnector(next.connector);
    setRows(next.rows);
    setRawExpression(expression);
  }, [expression, mode, rows, connector, rawExpression]);

  const pushVisual = useCallback(
    (nextConnector: Connector, nextRows: ConditionRow[]) => {
      const compiled = compileRule(nextRows, nextConnector);
      if (compiled) onExpressionChange(compiled);
    },
    [onExpressionChange]
  );

  const updateRows = (nextRows: ConditionRow[]) => {
    setRows(nextRows);
    if (mode === "visual") pushVisual(connector, nextRows);
  };

  const updateConnector = (c: Connector) => {
    setConnector(c);
    if (mode === "visual") pushVisual(c, rows);
  };

  const switchToRaw = () => {
    setMode("raw");
    setRawExpression(expression);
  };

  const switchToVisual = () => {
    const parsed = parseExpression(rawExpression);
    if (!parsed.parsed) return false;
    setMode("visual");
    setConnector(parsed.connector);
    setRows(parsed.rows);
    onExpressionChange(compileRule(parsed.rows, parsed.connector));
    return true;
  };

  const compiledPreview = mode === "visual" ? compileRule(rows, connector) : rawExpression;

  return (
    <div className="space-y-4" onClick={e => e.stopPropagation()}>
      {/* Preview chip */}
      {previewPassed !== null && (
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
            previewPassed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
          )}
        >
          {previewPassed ? "Test: voldoet" : "Test: voldoet niet"}
          {previewMessage && !previewPassed && (
            <span className="font-normal opacity-90 truncate max-w-[240px]" title={previewMessage}>
              — {previewMessage}
            </span>
          )}
        </div>
      )}

      {mode === "raw" ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs text-amber-900">
            <strong>Geavanceerde modus</strong> — deze expressie kon niet automatisch worden omgezet naar bouwstenen.
          </p>
          <Textarea
            value={rawExpression}
            onChange={e => {
              setRawExpression(e.target.value);
              onExpressionChange(e.target.value);
            }}
            rows={5}
            spellCheck={false}
            className="font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => {
              if (switchToVisual()) return;
              alert("Expressie kan niet worden omgezet. Gebruik alleen AND of OR (niet gemengd), zonder haakjes.");
            }}
            className="text-xs font-medium text-forta-primary hover:underline"
          >
            Probeer visuele modus
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Voldoet wanneer</span>
            <div className="inline-flex rounded-lg border border-forta-border bg-forta-muted/40 p-0.5">
              {(["AND", "OR"] as Connector[]).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateConnector(c)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                    connector === c
                      ? "bg-forta-primary text-white shadow-sm"
                      : "text-slate-600 hover:bg-white"
                  )}
                >
                  {c === "AND" ? "ALLE voorwaarden" : "ÉÉN VAN"}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">waar is</span>
          </div>

          <div className="space-y-2">
            {rows.map((row, idx) => (
              <ConditionRowEditor
                key={row.id}
                row={row}
                onChange={updated => {
                  const next = [...rows];
                  next[idx] = updated;
                  updateRows(next);
                }}
                onRemove={() => {
                  if (rows.length <= 1) return;
                  updateRows(rows.filter((_, i) => i !== idx));
                }}
                canRemove={rows.length > 1}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => updateRows([...rows, createEmptyRow()])}
            className="flex items-center gap-1.5 text-xs font-semibold text-forta-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Voorwaarde toevoegen
          </button>

          <button
            type="button"
            onClick={() => setShowAdvanced(s => !s)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Code2 className="h-3.5 w-3.5" />
            Geavanceerd: gegenereerde expressie
          </button>
          {showAdvanced && (
            <div className="space-y-2">
              <code className="block rounded-lg bg-forta-muted px-3 py-2 text-[11px] font-mono text-slate-700 break-all">
                {compiledPreview || "(leeg)"}
              </code>
              <button
                type="button"
                onClick={switchToRaw}
                className="text-xs text-slate-500 hover:text-forta-primary hover:underline"
              >
                Bewerk als ruwe expressie
              </button>
            </div>
          )}
        </>
      )}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
          Foutmelding bij afwijzing
        </p>
        <Textarea
          value={errorMessage}
          onChange={e => onErrorMessageChange(e.target.value)}
          rows={2}
          className="text-sm"
          placeholder="Tekst voor het secretariaat als deze regel faalt"
        />
      </div>

      <p className="text-[10px] text-slate-400">
        Testresultaat gebruikt de voorbeelddata uit het tabblad <strong>Testen</strong>. Klik{" "}
        <strong>Opslaan &amp; herladen</strong> om wijzigingen actief te maken.
      </p>
    </div>
  );
}

function ConditionRowEditor({
  row,
  onChange,
  onRemove,
  canRemove,
}: {
  row: ConditionRow;
  onChange: (row: ConditionRow) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const field = getFieldDef(row.fieldId);
  const fieldType = field?.type ?? "string";
  const operators = defaultOperatorsForType(fieldType);
  const needsValue = !["empty", "not_empty", "true", "false"].includes(row.operator);

  const fieldsByGroup = useMemo(() => {
    const groups: Record<string, typeof RULE_FIELDS> = {};
    for (const f of RULE_FIELDS) {
      if (!groups[f.group]) groups[f.group] = [];
      groups[f.group].push(f);
    }
    return groups;
  }, []);

  const onFieldChange = (fieldId: string) => {
    const def = getFieldDef(fieldId);
    const ops = defaultOperatorsForType(def?.type ?? "string");
    onChange({
      ...row,
      fieldId,
      operator: ops[0],
      value: def?.type === "number" ? "0" : def?.enumValues?.[0] ?? "",
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-forta-border bg-forta-muted/30 p-3">
      <div className="min-w-[140px] flex-1">
        <label className="mb-0.5 block text-[10px] font-medium text-slate-500">Veld</label>
        <select
          value={row.fieldId}
          onChange={e => onFieldChange(e.target.value)}
          className="w-full rounded-lg border border-forta-border bg-white px-2 py-1.5 text-xs"
        >
          {Object.entries(fieldsByGroup).map(([group, fields]) => (
            <optgroup key={group} label={groupLabel(group)}>
              {fields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="min-w-[120px]">
        <label className="mb-0.5 block text-[10px] font-medium text-slate-500">Vergelijking</label>
        <select
          value={row.operator}
          onChange={e => onChange({ ...row, operator: e.target.value as ConditionOperator })}
          className="w-full rounded-lg border border-forta-border bg-white px-2 py-1.5 text-xs"
        >
          {operators.map(op => (
            <option key={op} value={op}>
              {operatorLabel(op, fieldType)}
            </option>
          ))}
        </select>
      </div>

      {needsValue && (
        <div className="min-w-[100px] flex-1">
          <label className="mb-0.5 block text-[10px] font-medium text-slate-500">Waarde</label>
          {fieldType === "enum" && field?.enumValues ? (
            <select
              value={row.value}
              onChange={e => onChange({ ...row, value: e.target.value })}
              className="w-full rounded-lg border border-forta-border bg-white px-2 py-1.5 text-xs"
            >
              {field.enumValues.map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : fieldType === "number" ? (
            <input
              type="number"
              value={row.value}
              onChange={e => onChange({ ...row, value: e.target.value })}
              className="w-full rounded-lg border border-forta-border bg-white px-2 py-1.5 text-xs"
            />
          ) : (
            <input
              type="text"
              list={field?.suggestions ? `suggest-${row.fieldId}` : undefined}
              value={row.value}
              onChange={e => onChange({ ...row, value: e.target.value })}
              className="w-full rounded-lg border border-forta-border bg-white px-2 py-1.5 text-xs"
              placeholder="waarde"
            />
          )}
          {field?.suggestions && (
            <datalist id={`suggest-${row.fieldId}`}>
              {field.suggestions.map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </div>
      )}

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
          title="Voorwaarde verwijderen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
