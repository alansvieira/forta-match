"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileUp, List, ClipboardCheck, Settings2 } from "lucide-react";

const nav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/intake", label: "Intake", icon: FileUp },
  { href: "/referrals", label: "List", icon: List },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/rules", label: "Rules", icon: Settings2 },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-forta-border bg-white/95 px-2 py-2 backdrop-blur-md lg:hidden">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors",
              active ? "text-forta-primary" : "text-slate-500"
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-forta-primary")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
