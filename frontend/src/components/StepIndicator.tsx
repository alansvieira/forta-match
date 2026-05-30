import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  id:    string;
  label: string;
}

interface StepIndicatorProps {
  steps:        Step[];
  current:      string;
  onStepClick?: (stepId: string) => void;   // alleen voor al bezochte stappen
  visited?:     string[];                    // stap-ids die al bezocht zijn
}

export function StepIndicator({ steps, current, onStepClick, visited = [] }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(s => s.id === current);

  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const done       = index < currentIndex;
        const active     = step.id === current;
        const isVisited  = visited.includes(step.id) || done;
        const clickable  = onStepClick && isVisited && !active;

        return (
          <div key={step.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(step.id)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-all duration-200",
                done   && "bg-emerald-100 text-emerald-700",
                active && "bg-forta-primary text-white shadow-sm",
                !done && !active && "bg-forta-muted text-slate-400",
                clickable && "cursor-pointer hover:ring-2 hover:ring-forta-primary/30 hover:shadow-sm"
              )}
            >
              <span className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                active && "bg-white/20",
                done   && "bg-emerald-200"
              )}>
                {done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              {step.label}
            </button>

            {index < steps.length - 1 && (
              <div className={cn(
                "hidden h-px w-6 sm:block transition-colors duration-300",
                index < currentIndex ? "bg-emerald-300" : "bg-forta-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
