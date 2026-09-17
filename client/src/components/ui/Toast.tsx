import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { IconButton } from "./IconButton";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: React.ReactNode;
  description?: React.ReactNode;
}

interface ToastOptions {
  description?: React.ReactNode;
  /** Durée en ms (4000 par défaut, 0 = persistant). */
  duration?: number;
}

interface ToastApi {
  success: (message: React.ReactNode, opts?: ToastOptions) => void;
  error: (message: React.ReactNode, opts?: ToastOptions) => void;
  info: (message: React.ReactNode, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const icons: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-ok" strokeWidth={1.75} aria-hidden />,
  error: <AlertCircle className="h-4 w-4 text-danger" strokeWidth={1.75} aria-hidden />,
  info: <Info className="h-4 w-4 text-muted" strokeWidth={1.75} aria-hidden />,
};

const MAX = 3;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, message: React.ReactNode, opts?: ToastOptions) => {
      const id = ++seq.current;
      setItems((list) => [...list, { id, kind, message, description: opts?.description }].slice(-MAX));
      const duration = opts?.duration ?? (kind === "error" ? 6000 : 4000);
      if (duration > 0) window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => push("success", m, o),
      error: (m, o) => push("error", m, o),
      info: (m, o) => push("info", m, o),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-6 right-6 z-[70] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2"
          role="status"
          aria-live="polite"
        >
          {items.map((t) => (
            <div
              key={t.id}
              className={clsx(
                "modal-in pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-pop",
              )}
            >
              <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.message}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
              </div>
              <IconButton label="Fermer" icon={X} onClick={() => dismiss(t.id)} className="-mr-2 -mt-1.5" />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Hors provider (tests, scripts) : repli console pour ne jamais casser un flux.
    return {
      success: (m) => console.info(m),
      error: (m) => console.error(m),
      info: (m) => console.info(m),
    };
  }
  return ctx;
}
