import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-xl font-semibold transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forta-primary/40 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        {
          "bg-forta-primary text-white shadow-sm hover:bg-forta-primary-hover": variant === "primary",
          "bg-forta-muted text-forta-primary-dark hover:bg-forta-border": variant === "secondary",
          "border border-forta-border bg-white text-forta-primary-dark hover:bg-forta-muted": variant === "outline",
          "text-forta-primary hover:bg-forta-primary-soft": variant === "ghost",
          "bg-forta-danger text-white hover:bg-red-700": variant === "danger",
          "bg-forta-success text-white hover:bg-emerald-700": variant === "success",
          "h-9 px-3.5 text-sm": size === "sm",
          "h-11 px-5 text-sm": size === "md",
          "h-12 px-6 text-base": size === "lg",
        },
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
