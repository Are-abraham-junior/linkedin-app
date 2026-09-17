import React, { useId, useRef } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useFocusTrap } from "./hooks";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const sizes: Record<ModalSize, string> = {
  sm: "max-w-[420px]",
  md: "max-w-[560px]",
  lg: "max-w-[720px]",
  xl: "max-w-[960px]",
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  size?: ModalSize;
  /** Panneau latéral ancré à droite au lieu d'une modale centrée. */
  side?: "right";
  footer?: React.ReactNode;
  /** Élément à droite du titre (badge, actions). */
  headerActions?: React.ReactNode;
  closeOnBackdrop?: boolean;
  hideClose?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Modale imbriquée : passe au-dessus de la précédente. */
  zIndex?: number;
  /** Classes du corps (par défaut `px-6 py-2`). */
  bodyClassName?: string;
  className?: string;
  children?: React.ReactNode;
}

export const backdropClass = "fixed inset-0 flex items-center justify-center bg-ink/40 p-4";

/**
 * Surface flottante unique de l'app : un seul backdrop, un seul panneau,
 * focus piégé, Échap pour fermer, focus rendu au déclencheur.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  size = "md",
  side,
  footer,
  headerActions,
  closeOnBackdrop = true,
  hideClose,
  initialFocusRef,
  zIndex = 50,
  bodyClassName,
  className,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(panelRef, open, onClose, initialFocusRef);

  if (!open) return null;

  return createPortal(
    <div
      className={clsx(backdropClass, side === "right" && "justify-end p-0")}
      style={{ zIndex }}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={clsx(
          "modal-in flex w-full flex-col border border-line bg-surface shadow-pop outline-none",
          side === "right"
            ? "h-full max-w-[520px] rounded-none border-y-0 border-r-0"
            : clsx("max-h-[calc(100vh-2rem)] rounded-2xl", sizes[size]),
          className,
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-lg font-semibold text-ink">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              {!hideClose && <IconButton label="Fermer" icon={X} onClick={onClose} className="-mr-2 -mt-1" />}
            </div>
          </div>
        )}
        <div className={clsx("min-h-0 flex-1 overflow-y-auto", bodyClassName ?? "px-6 py-2")}>{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};
