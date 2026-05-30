import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertCircle, Clock, FileCheck, FileX, Users, Loader } from "lucide-react";

interface BadgeConfig {
  label:  string;
  color:  string;
  icon?:  React.ElementType;
}

const STATUS_MAP: Record<string, BadgeConfig> = {
  // AI recommendation
  YES:                  { label: "JA",           color: "bg-emerald-100 text-emerald-800 ring-emerald-600/20", icon: CheckCircle2 },
  Yes:                  { label: "JA",           color: "bg-emerald-100 text-emerald-800 ring-emerald-600/20", icon: CheckCircle2 },
  NO:                   { label: "NEE",          color: "bg-red-100 text-red-800 ring-red-600/20",             icon: XCircle      },
  No:                   { label: "NEE",          color: "bg-red-100 text-red-800 ring-red-600/20",             icon: XCircle      },
  UNCERTAIN:            { label: "TWIJFEL",      color: "bg-amber-100 text-amber-900 ring-amber-600/20",       icon: AlertCircle  },
  Uncertain:            { label: "TWIJFEL",      color: "bg-amber-100 text-amber-900 ring-amber-600/20",       icon: AlertCircle  },

  // Referral status
  Draft:                { label: "Concept",      color: "bg-slate-100 text-slate-600 ring-slate-400/20",       icon: Loader       },
  Complete:             { label: "Volledig",     color: "bg-sky-100 text-sky-800 ring-sky-600/20",             icon: FileCheck    },
  Incomplete:           { label: "Incompleet",   color: "bg-slate-100 text-slate-600 ring-slate-400/20",       icon: FileX        },
  Extracting:           { label: "AI bezig…",   color: "bg-violet-100 text-violet-800 ring-violet-500/20",    icon: Loader       },
  Extracted:            { label: "Geëxtraheerd", color: "bg-violet-100 text-violet-800 ring-violet-500/20",    icon: CheckCircle2 },
  Evaluating:           { label: "Evalueren…",  color: "bg-violet-100 text-violet-800 ring-violet-500/20",    icon: Loader       },
  RecommendedYes:       { label: "Aanbevolen",  color: "bg-emerald-100 text-emerald-800 ring-emerald-600/20", icon: CheckCircle2 },
  RecommendedNo:        { label: "Afgeraden",   color: "bg-red-100 text-red-800 ring-red-600/20",             icon: XCircle      },
  RecommendedUncertain: { label: "Twijfelgeval",color: "bg-amber-100 text-amber-900 ring-amber-600/20",       icon: AlertCircle  },
  ScreeningReview:      { label: "Bij screenteam",color:"bg-violet-100 text-violet-800 ring-violet-600/20",   icon: Users        },
  FinalizedAccept:      { label: "Geaccepteerd",color: "bg-emerald-100 text-emerald-800 ring-emerald-600/20", icon: CheckCircle2 },
  FinalizedReject:      { label: "Afgewezen",   color: "bg-red-100 text-red-800 ring-red-600/20",             icon: XCircle      },

  // Decision outcomes
  Accept:               { label: "Geaccepteerd",color: "bg-emerald-100 text-emerald-800 ring-emerald-600/20", icon: CheckCircle2 },
  Reject:               { label: "Afgewezen",   color: "bg-red-100 text-red-800 ring-red-600/20",             icon: XCircle      },
};

export function StatusBadge({
  value,
  className,
  showIcon = true,
}: {
  value:      string | null | undefined;
  className?: string;
  showIcon?:  boolean;
}) {
  if (!value) return <span className="text-sm text-slate-400">—</span>;

  const cfg = STATUS_MAP[value] ?? STATUS_MAP[value.replace(/\s/g, "")] ?? {
    label: value,
    color: "bg-slate-100 text-slate-700 ring-slate-500/20",
  };

  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        cfg.color,
        className
      )}
    >
      {showIcon && Icon && <Icon className="h-3 w-3 shrink-0" />}
      {cfg.label}
    </span>
  );
}
