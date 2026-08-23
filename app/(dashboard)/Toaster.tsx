"use client";

/**
 * Toasts for the dashboard's async actions (SPEC §13).
 *
 * §13 asks for an error toast on a failed export rather than a silent
 * failure, so failures need somewhere to surface that is not tied to the row
 * that raised them — a Download button that has already returned to its
 * resting state has nowhere to put a message. One provider at the layout
 * level serves the whole screen and the phases that follow.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Tone = "error" | "info";

interface Toast {
  id: number;
  tone: Tone;
  message: string;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

/** Long enough to read a Puppeteer failure; errors also stay until dismissed. */
const DISMISS_AFTER_MS = 8000;

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = ++nextId;
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
      >
        {toasts.map((toast) => (
          <div
            className={`pointer-events-auto flex max-w-xl items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
              toast.tone === "error" ? "bg-red-700 text-white" : "bg-gray-900 text-white"
            }`}
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <span>{toast.message}</span>
            <button
              aria-label="Dismiss"
              className="ml-auto text-white/70 hover:text-white"
              onClick={() => dismiss(toast.id)}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside a ToastProvider");
  return show;
}
