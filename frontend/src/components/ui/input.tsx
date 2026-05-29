import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-forta-border bg-white px-4 py-2 text-sm text-forta-primary-dark",
        "placeholder:text-slate-400 transition-colors duration-200",
        "focus:border-forta-primary focus:outline-none focus:ring-2 focus:ring-forta-primary/20",
        "disabled:cursor-not-allowed disabled:bg-forta-muted disabled:opacity-60",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn("mb-1.5 block text-sm font-medium text-slate-700", className)}
    {...props}
  />
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[100px] w-full rounded-xl border border-forta-border bg-white px-4 py-3 text-sm text-forta-primary-dark",
      "placeholder:text-slate-400 transition-colors duration-200",
      "focus:border-forta-primary focus:outline-none focus:ring-2 focus:ring-forta-primary/20",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
