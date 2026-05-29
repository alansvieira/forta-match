import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  YES: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  Yes: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  NO: "bg-red-100 text-red-800 ring-red-600/20",
  No: "bg-red-100 text-red-800 ring-red-600/20",
  UNCERTAIN: "bg-amber-100 text-amber-900 ring-amber-600/20",
  Uncertain: "bg-amber-100 text-amber-900 ring-amber-600/20",
  Complete: "bg-sky-100 text-sky-800 ring-sky-600/20",
  Incomplete: "bg-slate-100 text-slate-700 ring-slate-500/20",
  RecommendedYes: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  RecommendedNo: "bg-red-100 text-red-800 ring-red-600/20",
  RecommendedUncertain: "bg-amber-100 text-amber-900 ring-amber-600/20",
  ScreeningReview: "bg-violet-100 text-violet-800 ring-violet-600/20",
  FinalizedAccept: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  FinalizedReject: "bg-red-100 text-red-800 ring-red-600/20",
  Accept: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  Reject: "bg-red-100 text-red-800 ring-red-600/20",
};

export function StatusBadge({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-sm text-slate-400">—</span>;
  const style =
    statusStyles[value] ||
    statusStyles[value.replace(/\s/g, "")] ||
    "bg-slate-100 text-slate-700 ring-slate-500/20";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        style,
        className
      )}
    >
      {value}
    </span>
  );
}
