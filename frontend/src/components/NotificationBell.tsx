"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { notificationsApi } from "@/lib/api";
import type { EmailNotification } from "@/lib/types";
import { Bell, Mail, ChevronRight, CheckCheck, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const router = useRouter();
  const [open,         setOpen]         = useState(false);
  const [count,        setCount]        = useState(0);
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Sluit dropdown bij klik buiten
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Poll unread count elke 30 seconden
  useEffect(() => {
    const fetch = () => notificationsApi.unreadCount().then(setCount).catch(() => {});
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = async () => {
    setOpen(o => !o);
    if (!open) {
      setLoading(true);
      try {
        const data = await notificationsApi.list();
        setNotifications(data);
        setCount(data.filter(n => !n.isRead).length);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markRead("all").catch(() => {});
    setNotifications(ns => ns.map(n => ({ ...n, isRead: true })));
    setCount(0);
  };

  const handleStartIntake = async (n: EmailNotification) => {
    setActionLoading(n.id);
    try {
      // create-intake draait prescan automatisch en geeft referralId + prescan terug
      const { referralId, prescan } = await notificationsApi.createIntake(n.id);
      setNotifications(ns => ns.map(x => x.id === n.id
        ? { ...x, isProcessed: true, referralId } : x));

      // Sla prescan op in sessionStorage zodat intake pagina hem kan gebruiken
      sessionStorage.setItem("pendingIntake", JSON.stringify({
        referralId,
        prescan,
        fromEmail: true,
        attachmentFileName: n.subject,
      }));

      setOpen(false);
      router.push("/intake");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddTest = async () => {
    await notificationsApi.addTest();
    const data = await notificationsApi.list();
    setNotifications(data);
    setCount(data.filter(n => !n.isRead).length);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-forta-muted hover:text-forta-primary"
        title="Notificaties"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-forta-primary text-[9px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 w-80 rounded-2xl border border-forta-border bg-white shadow-card-hover">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-forta-border px-4 py-3">
            <span className="font-semibold text-forta-primary-dark text-sm">Inbox</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAddTest}
                className="flex items-center gap-1 rounded-lg bg-forta-primary px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-forta-primary-hover transition-colors"
                title="Simuleer een verwijsbrief (demo)"
              >
                <Plus className="h-2.5 w-2.5" /> Simuleer
              </button>
              {notifications.length > 0 && (
                <button
                  onClick={async () => {
                    await notificationsApi.clearAll();
                    setNotifications([]);
                    setCount(0);
                  }}
                  className="rounded-lg border border-forta-border px-2 py-1 text-[10px] font-medium text-slate-400 hover:border-red-200 hover:text-red-500 transition-colors"
                  title="Wis alle notificaties"
                >
                  Wis
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Laden…</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Mail className="h-8 w-8 text-slate-200" />
                <p className="mt-2 text-xs text-slate-400">Geen berichten</p>
                <button onClick={handleAddTest}
                  className="mt-3 rounded-lg bg-forta-primary-soft px-3 py-1.5 text-[11px] font-medium text-forta-primary hover:bg-forta-accent-soft transition-colors">
                  + Simuleer een e-mail
                </button>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    "border-b border-forta-border px-4 py-3 transition-colors last:border-0",
                    !n.isRead ? "bg-forta-primary-soft/40" : "hover:bg-forta-muted/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", !n.isRead ? "bg-forta-primary" : "bg-transparent")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-forta-primary-dark">{n.subject}</p>
                      <p className="text-[10px] text-slate-400">{n.fromName || n.fromEmail}</p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-500">{n.body}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          disabled={!!actionLoading}
                          onClick={() => handleStartIntake(n)}
                          className="flex items-center gap-1 rounded-lg bg-forta-primary px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-forta-primary-hover disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === n.id ? "Laden…" : n.isProcessed ? "Bekijk dossier" : "Start intake"}
                          <ChevronRight className="h-2.5 w-2.5" />
                        </button>
                        <span className="text-[9px] text-slate-400">
                          {new Date(n.receivedAt).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
