import React, { useRef } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Callout } from "../ui/Callout";
import { Field, Input } from "../ui/Field";

export type ConfirmModalVariant = "danger" | "warning" | "info" | "primary";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  itemName?: string;
  itemType?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmModalVariant;
  isLoading?: boolean;
  warningMessage?: string;
  inputPrompt?: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
  };
}

const defaultConfirm: Record<ConfirmModalVariant, string> = {
  danger: "Supprimer définitivement",
  warning: "Confirmer",
  info: "Compris",
  primary: "Valider la demande",
};

/**
 * Dialogue de confirmation sobre : titre, phrase, l'élément concerné,
 * un avertissement éventuel, deux boutons. Le focus arrive sur « Annuler »
 * pour éviter une suppression par Entrée.
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  itemType,
  confirmText,
  cancelText = "Annuler",
  variant = "danger",
  isLoading = false,
  warningMessage,
  inputPrompt,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const blocked = Boolean(inputPrompt?.required && !inputPrompt.value.trim());

  const handleConfirm = () => {
    if (isLoading || blocked) return;
    void onConfirm();
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => !isLoading && onClose()}
      title={title}
      description={description}
      size="sm"
      initialFocusRef={cancelRef}
      closeOnBackdrop={!isLoading}
      hideClose
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={isLoading}
            disabled={blocked}
          >
            {confirmText || defaultConfirm[variant]}
          </Button>
        </>
      }
    >
      {(itemName || warningMessage || inputPrompt) && (
        <div className="space-y-3 pb-2">
          {itemName && (
            <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
              {itemType && <p className="text-xs text-muted">{itemType}</p>}
              <p className="truncate text-base font-medium text-ink">{itemName}</p>
            </div>
          )}
          {warningMessage && <Callout tone={variant === "danger" ? "danger" : "warn"}>{warningMessage}</Callout>}
          {inputPrompt && (
            <Field label={inputPrompt.label} required={inputPrompt.required}>
              <Input
                value={inputPrompt.value}
                onChange={(e) => inputPrompt.onChange(e.target.value)}
                placeholder={inputPrompt.placeholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirm();
                }}
              />
            </Field>
          )}
        </div>
      )}
    </Modal>
  );
};
