"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileUp,
  List,
  ClipboardCheck,
  Settings2,
  Sparkles,
} from "lucide-react";
import { NotificationBell } from "./NotificationBell";

const nav = [
  { href: "/",              label: "Dashboard",          icon: LayoutDashboard },
  { href: "/intake",        label: "Nieuwe intake",       icon: FileUp          },
  { href: "/referrals",     label: "Aanmeldingen",        icon: List            },
  { href: "/review",        label: "Screenteam",          icon: ClipboardCheck  },
  { href: "/rules",         label: "Regelconfiguratie",   icon: Settings2       },
  { href: "/instellingen",  label: "E-mailtemplates",     icon: Settings2       },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-forta-border bg-white shadow-sidebar lg:flex">
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-forta-primary to-forta-primary-hover shadow-sm">
          <Sparkles className="h-5 w-5 text-white" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-lg font-bold tracking-tight text-forta-primary-dark">
            Forta Match
          </h1>
          <p className="text-xs font-medium text-slate-500">AI adviseert · Mensen beslissen</p>
        </div>
        <NotificationBell />
      </div>

      <nav className="flex-1 space-y-1 px-4 py-2">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Navigatie
        </p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                active
                  ? "bg-forta-primary-soft text-forta-primary-dark shadow-sm ring-1 ring-forta-primary/20"
                  : "text-slate-600 hover:bg-forta-muted hover:text-forta-primary-dark"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200",
                  active
                    ? "bg-forta-primary text-white"
                    : "bg-forta-muted text-slate-500 group-hover:bg-forta-primary/10 group-hover:text-forta-primary"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 mb-4 rounded-xl border border-forta-border bg-forta-muted/60 p-4">
        <p className="text-xs font-semibold text-forta-primary-dark">Principes</p>
        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-500">
          <li>Privacy by design</li>
          <li>Mens beslist altijd</li>
          <li>AI adviseert</li>
        </ul>
      </div>
    </aside>
  );
}
