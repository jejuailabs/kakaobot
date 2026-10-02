"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/shared/cn";

type Toast = { id: number; tone: "success" | "error"; message: string };

const ToastContext = React.createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export function useToast() {
  return React.useContext(ToastContext);
}

/** 저장·연결 상태 알림만 aria-live=polite 로 읽는다 (docs/02). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const nextId = React.useRef(0);

  const push = React.useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = ++nextId.current;
    setToasts((t) => [...t, { id, tone, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "glass-solid animate-fade-in pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-[14px] px-4 py-3 text-body shadow-xl",
            )}
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
            ) : (
              <AlertTriangle className="size-5 shrink-0 text-danger" aria-hidden />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
