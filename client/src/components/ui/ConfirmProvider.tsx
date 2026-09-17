import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { ConfirmModal, type ConfirmModalVariant } from "../common/ConfirmModal";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmModalVariant;
  itemName?: string;
  itemType?: string;
  warningMessage?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Remplace `window.confirm` : `if (await confirm({ title: "Supprimer ?" })) …` */
export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpts(o);
    });
  }, []);

  const settle = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmModal
        isOpen={Boolean(opts)}
        onClose={() => settle(false)}
        onConfirm={() => settle(true)}
        title={opts?.title ?? ""}
        description={opts?.description}
        confirmText={opts?.confirmText}
        cancelText={opts?.cancelText}
        variant={opts?.variant ?? "danger"}
        itemName={opts?.itemName}
        itemType={opts?.itemType}
        warningMessage={opts?.warningMessage}
      />
    </ConfirmContext.Provider>
  );
};

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) return async (o) => window.confirm(o.title);
  return ctx;
}
