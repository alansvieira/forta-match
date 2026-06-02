/**
 * Visual rule builder schema — mirrors RulesInputModels.cs / Microsoft RulesEngine lambdas.
 */

export type FieldType = "number" | "string" | "enum" | "boolean";
export type Connector = "AND" | "OR";

export type StringOperator =
  | "eq"
  | "neq"
  | "contains"
  | "empty"
  | "not_empty";
export type NumberOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
export type EnumOperator = "eq" | "neq";
export type BooleanOperator = "true" | "false";

export type ConditionOperator = StringOperator | NumberOperator | EnumOperator | BooleanOperator;

export interface RuleFieldDef {
  id: string;
  label: string;
  type: FieldType;
  group: "extraction" | "capacity" | "insurer";
  enumValues?: string[];
  suggestions?: string[];
}

export interface ConditionRow {
  id: string;
  fieldId: string;
  operator: ConditionOperator;
  value: string;
}

export interface ParsedRule {
  connector: Connector;
  rows: ConditionRow[];
  parsed: boolean;
}

export const RULE_FIELDS: RuleFieldDef[] = [
  { id: "extraction.ProbableDsm", label: "DSM-classificatie", type: "string", group: "extraction" },
  { id: "extraction.Symptoms", label: "Symptomen", type: "string", group: "extraction" },
  { id: "extraction.Age", label: "Leeftijd", type: "number", group: "extraction" },
  {
    id: "extraction.RiskLevel",
    label: "Risiconiveau",
    type: "enum",
    group: "extraction",
    enumValues: ["low", "medium", "high", "crisis"],
  },
  {
    id: "extraction.Region",
    label: "Regio",
    type: "string",
    group: "extraction",
    suggestions: ["Noord-Holland", "Zuid-Holland", "Utrecht"],
  },
  { id: "extraction.Context", label: "Context", type: "string", group: "extraction" },
  { id: "capacity.AvailableSlots", label: "Beschikbare plekken", type: "number", group: "capacity" },
  { id: "capacity.WaitingWeeks", label: "Wachttijd (weken)", type: "number", group: "capacity" },
  { id: "insurer.IsCovered", label: "Verzekering dekt", type: "boolean", group: "insurer" },
  { id: "insurer.CapRemaining", label: "Resterend verzekeringsplafond", type: "number", group: "insurer" },
];

export function getFieldDef(fieldId: string): RuleFieldDef | undefined {
  return RULE_FIELDS.find(f => f.id === fieldId);
}

export function defaultOperatorsForType(type: FieldType): ConditionOperator[] {
  switch (type) {
    case "number":
      return ["gt", "gte", "lt", "lte", "eq", "neq"];
    case "enum":
      return ["eq", "neq"];
    case "boolean":
      return ["true", "false"];
    default:
      return ["eq", "neq", "contains", "empty", "not_empty"];
  }
}

export function operatorLabel(op: ConditionOperator, type: FieldType): string {
  const labels: Record<string, string> = {
    eq: "is",
    neq: "is niet",
    gt: "groter dan",
    gte: "groter of gelijk",
    lt: "kleiner dan",
    lte: "kleiner of gelijk",
    contains: "bevat",
    empty: "is leeg",
    not_empty: "is niet leeg",
    true: "is waar",
    false: "is onwaar",
  };
  if (type === "boolean") return op === "true" ? "is waar (ja)" : "is onwaar (nee)";
  return labels[op] ?? op;
}

export function createEmptyRow(): ConditionRow {
  return {
    id: crypto.randomUUID(),
    fieldId: "extraction.Age",
    operator: "gte",
    value: "18",
  };
}

function escapeString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function compileRow(row: ConditionRow): string | null {
  const field = getFieldDef(row.fieldId);
  if (!field) return null;

  const f = row.fieldId;

  if (field.type === "boolean") {
    return row.operator === "true" ? `${f} == true` : `${f} == false`;
  }

  if (field.type === "number") {
    const n = row.value.trim();
    if (!n || Number.isNaN(Number(n))) return null;
    const opMap: Record<NumberOperator, string> = {
      gt: ">",
      gte: ">=",
      lt: "<",
      lte: "<=",
      eq: "==",
      neq: "!=",
    };
    const op = opMap[row.operator as NumberOperator];
    if (!op) return null;
    return `${f} ${op} ${n}`;
  }

  if (row.operator === "empty") {
    return `${f} == null OR ${f} == ""`;
  }
  if (row.operator === "not_empty") {
    return `${f} != null AND ${f} != ""`;
  }
  if (row.operator === "contains") {
    const v = escapeString(row.value.trim());
    if (!v) return null;
    return `${f}.Contains("${v}")`;
  }

  const v = escapeString(row.value.trim());
  if (!v) return null;
  if (row.operator === "eq") return `${f} == "${v}"`;
  if (row.operator === "neq") return `${f} != "${v}"`;
  return null;
}

export function compileRule(rows: ConditionRow[], connector: Connector): string {
  const parts = rows.map(compileRow).filter((p): p is string => !!p);
  if (parts.length === 0) return "";
  const joiner = connector === "AND" ? " AND " : " OR ";
  return parts.join(joiner);
}

function splitTopLevel(expr: string): { connector: Connector; parts: string[] } | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;

  const andParts = trimmed.split(/\s+AND\s+/i);
  const orParts = trimmed.split(/\s+OR\s+/i);

  const hasAnd = andParts.length > 1;
  const hasOr = orParts.length > 1;

  if (hasAnd && hasOr) return null;
  if (trimmed.includes("(")) return null;

  if (hasOr) return { connector: "OR", parts: orParts.map(p => p.trim()) };
  if (hasAnd) return { connector: "AND", parts: andParts.map(p => p.trim()) };
  return { connector: "AND", parts: [trimmed] };
}

function parsePart(part: string): Omit<ConditionRow, "id"> | null {
  if (part.startsWith("__notempty__:")) {
    const fieldId = part.slice("__notempty__:".length);
    return { fieldId, operator: "not_empty", value: "" };
  }

  const nullOnly = part.match(/^([\w.]+)\s*!=\s*null$/i);
  if (nullOnly) {
    return { fieldId: nullOnly[1], operator: "not_empty", value: "" };
  }

  const emptyStr = part.match(/^([\w.]+)\s*!=\s*""$/);
  if (emptyStr) {
    return { fieldId: emptyStr[1], operator: "not_empty", value: "" };
  }

  const containsMatch = part.match(/^([\w.]+)\.Contains\("((?:[^"\\]|\\.)*)"\)$/);
  if (containsMatch) {
    const value = containsMatch[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    return { fieldId: containsMatch[1], operator: "contains", value };
  }

  const boolMatch = part.match(/^([\w.]+)\s*==\s*(true|false)$/i);
  if (boolMatch) {
    return {
      fieldId: boolMatch[1],
      operator: boolMatch[2].toLowerCase() === "true" ? "true" : "false",
      value: "",
    };
  }

  const numMatch = part.match(/^([\w.]+)\s*(>=|<=|>|<|==|!=)\s*(-?\d+(?:\.\d+)?)$/);
  if (numMatch) {
    const opMap: Record<string, NumberOperator> = {
      ">": "gt",
      ">=": "gte",
      "<": "lt",
      "<=": "lte",
      "==": "eq",
      "!=": "neq",
    };
    const op = opMap[numMatch[2]];
    if (!op) return null;
    return { fieldId: numMatch[1], operator: op, value: numMatch[3] };
  }

  const strMatch = part.match(/^([\w.]+)\s*(==|!=)\s*"((?:[^"\\]|\\.)*)"$/);
  if (strMatch) {
    const value = strMatch[3].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    return {
      fieldId: strMatch[1],
      operator: strMatch[2] === "==" ? "eq" : "neq",
      value,
    };
  }

  return null;
}

/** Detect "field != null AND field != \"\"" collapsed into one visual row */
function tryParseNotEmptyPair(parts: string[], connector: Connector): ConditionRow | null {
  if (connector !== "AND" || parts.length !== 2) return null;
  const nullPart = parts.find(p => /\.[\w]+\s*!=\s*null$/i.test(p));
  const emptyPart = parts.find(p => /\.[\w]+\s*!=\s*""$/i.test(p));
  if (!nullPart || !emptyPart) return null;
  const fieldNull = nullPart.match(/^([\w.]+)\s*!=\s*null$/i);
  const fieldEmpty = emptyPart.match(/^([\w.]+)\s*!=\s*""$/i);
  if (!fieldNull || !fieldEmpty || fieldNull[1] !== fieldEmpty[1]) return null;
  return {
    id: crypto.randomUUID(),
    fieldId: fieldNull[1],
    operator: "not_empty",
    value: "",
  };
}

/** Merge `field != null` + `field != ""` into one not_empty row when both appear in AND chain */
function mergeNullEmptyParts(parts: string[]): string[] {
  const used = new Set<number>();
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (used.has(i)) continue;
    const nullM = parts[i].match(/^([\w.]+)\s*!=\s*null$/i);
    if (!nullM) continue;
    for (let j = 0; j < parts.length; j++) {
      if (i === j || used.has(j)) continue;
      const emptyM = parts[j].match(/^([\w.]+)\s*!=\s*""$/);
      if (emptyM && emptyM[1] === nullM[1]) {
        result.push(`__notempty__:${nullM[1]}`);
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  for (let i = 0; i < parts.length; i++) {
    if (!used.has(i)) result.push(parts[i]);
  }
  return result.length > 0 ? result : parts;
}

function tryParseEmptyPair(parts: string[], connector: Connector): ConditionRow | null {
  if (connector !== "OR" || parts.length !== 2) return null;
  const nullPart = parts.find(p => /\.[\w]+\s*==\s*null$/i.test(p));
  const emptyPart = parts.find(p => /\.[\w]+\s*==\s*""$/i.test(p));
  if (!nullPart || !emptyPart) return null;
  const fieldNull = nullPart.match(/^([\w.]+)\s*==\s*null$/i);
  const fieldEmpty = emptyPart.match(/^([\w.]+)\s*==\s*""$/i);
  if (!fieldNull || !fieldEmpty || fieldNull[1] !== fieldEmpty[1]) return null;
  return {
    id: crypto.randomUUID(),
    fieldId: fieldNull[1],
    operator: "empty",
    value: "",
  };
}

export function parseExpression(expression: string): ParsedRule {
  const split = splitTopLevel(expression);
  if (!split) {
    return { connector: "AND", rows: [createEmptyRow()], parsed: false };
  }

  const notEmptyRow = tryParseNotEmptyPair(split.parts, split.connector);
  if (notEmptyRow && split.parts.length === 2) {
    return { connector: split.connector, rows: [notEmptyRow], parsed: true };
  }

  const emptyRow = tryParseEmptyPair(split.parts, split.connector);
  if (emptyRow && split.parts.length === 2) {
    return { connector: split.connector, rows: [emptyRow], parsed: true };
  }

  const mergedParts = mergeNullEmptyParts(split.parts);

  const rows: ConditionRow[] = [];
  for (const part of mergedParts) {
    const parsed = parsePart(part);
    if (!parsed) {
      return { connector: split.connector, rows: [createEmptyRow()], parsed: false };
    }
    if (!getFieldDef(parsed.fieldId)) {
      return { connector: split.connector, rows: [createEmptyRow()], parsed: false };
    }
    rows.push({ ...parsed, id: crypto.randomUUID() });
  }

  if (rows.length === 0) {
    return { connector: "AND", rows: [createEmptyRow()], parsed: false };
  }

  return { connector: split.connector, rows, parsed: true };
}

export function builderStateFromExpression(expression: string): {
  connector: Connector;
  rows: ConditionRow[];
  mode: "visual" | "raw";
} {
  const parsed = parseExpression(expression);
  if (parsed.parsed) {
    return { connector: parsed.connector, rows: parsed.rows, mode: "visual" };
  }
  return {
    connector: "AND",
    rows: [createEmptyRow()],
    mode: "raw",
  };
}
