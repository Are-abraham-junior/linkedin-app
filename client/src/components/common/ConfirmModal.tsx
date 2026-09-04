import React, { useEffect, useRef } from "react";
import {
  AlertTriangle,
  Trash2,
  HelpCircle,
  Info,
  X,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

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
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Auto-focus cancel button for safe keyboard navigation (prevents accidental Enter deletion)
      setTimeout(() => cancelButtonRef.current?.focus(), 50);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  // Variant config
  const config = {
    danger: {
      icon: <Trash2 className="w-6 h-6" />,
      iconBg: "bg-gradient-to-tr from-rose-600 to-red-500",
      iconShadow: "shadow-rose-500/25 ring-rose-100",
      tagBg: "bg-rose-50 text-rose-700 border-rose-200/80",
      tagIcon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
      tagLabel: "Action Irréversible",
      headerGradient: "from-rose-500/10 via-rose-500/5 to-transparent",
      confirmBtn:
        "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-lg shadow-rose-600/25",
      defaultConfirmText: "Supprimer définitivement",
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6" />,
      iconBg: "bg-gradient-to-tr from-amber-500 to-orange-500",
      iconShadow: "shadow-amber-500/25 ring-amber-100",
      tagBg: "bg-amber-50 text-amber-800 border-amber-200/80",
      tagIcon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
      tagLabel: "Attention Requise",
      headerGradient: "from-amber-500/10 via-amber-500/5 to-transparent",
      confirmBtn:
        "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25",
      defaultConfirmText: "Confirmer",
    },
    info: {
      icon: <Info className="w-6 h-6" />,
      iconBg: "bg-gradient-to-tr from-[#2ed6ff] to-[#0089a8]",
      iconShadow: "shadow-cyan-500/25 ring-cyan-100",
      tagBg: "bg-[#2ed6ff]/10 text-[#0089a8] border-[#2ed6ff]/30",
      tagIcon: <Info className="w-3.5 h-3.5 text-[#0089a8]" />,
      tagLabel: "Information",
      headerGradient: "from-[#2ed6ff]/10 via-[#2ed6ff]/5 to-transparent",
      confirmBtn:
        "bg-gradient-to-r from-[#0089a8] to-[#2ed6ff] hover:opacity-90 text-white shadow-lg shadow-cyan-500/25",
      defaultConfirmText: "Compris",
    },
    primary: {
      icon: <HelpCircle className="w-6 h-6" />,
      iconBg: "bg-gradient-to-tr from-[#592eff] to-[#7c3aed]",
      iconShadow: "shadow-[#592eff]/25 ring-[#592eff]/20",
      tagBg: "bg-[#592eff]/10 text-[#592eff] border-[#592eff]/20",
      tagIcon: <ShieldAlert className="w-3.5 h-3.5 text-[#592eff]" />,
      tagLabel: "Demande de Confirmation",
      headerGradient: "from-[#592eff]/10 via-[#592eff]/5 to-transparent",
      confirmBtn:
        "bg-gradient-to-r from-[#592eff] to-[#7c3aed] hover:from-[#4d25e0] hover:to-[#6d28d9] text-white shadow-lg shadow-[#592eff]/25",
      defaultConfirmText: "Valider la demande",
    },
  }[variant];

  const effectiveConfirmText = confirmText || config.defaultConfirmText;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (inputPrompt?.required && !inputPrompt.value.trim()) return;
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#21164c]/45 backdrop-blur-md animate-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
      onClick={(e) => {
        // Dismiss when clicking the dark backdrop
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div className="bg-white w-full max-w-lg rounded-[32px] sm:rounded-[36px] shadow-2xl shadow-[#21164c]/20 border border-[#e0e0db]/80 overflow-hidden relative animate-modal-pop">
        {/* Top Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 w-9 h-9 rounded-2xl bg-[#f8f9fc] hover:bg-gray-100 flex items-center justify-center text-[#5f5f69] hover:text-[#21164c] transition-colors cursor-pointer border border-[#e0e0db]/60 z-10 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Fermer (Échap)"
          aria-label="Fermer la boîte de dialogue"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Decorative Top Banner Header */}
        <div className={`p-7 pb-4 text-center relative bg-gradient-to-b ${config.headerGradient}`}>
          {/* Main Floating Icon */}
          <div
            className={`w-16 h-16 rounded-3xl ${config.iconBg} text-white flex items-center justify-center mx-auto mb-3.5 shadow-xl ${config.iconShadow} ring-4 transition-transform`}
          >
            {config.icon}
          </div>

          {/* Badge Tag */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2.5 border ${config.tagBg}`}
          >
            {config.tagIcon}
            <span>{config.tagLabel}</span>
          </div>

          {/* Title */}
          <h2
            id="confirm-modal-title"
            className="text-xl sm:text-2xl font-extrabold text-[#21164c] tracking-tight"
          >
            {title}
          </h2>

          {/* Optional Short Description */}
          {description && (
            <div
              id="confirm-modal-description"
              className="text-xs sm:text-sm text-[#5f5f69] mt-2 leading-relaxed px-2"
            >
              {description}
            </div>
          )}
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-3 space-y-4">
          {/* Highlight Target Item Card */}
          {itemName && (
            <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/80 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white border border-[#e0e0db] flex items-center justify-center font-extrabold text-[#21164c] text-xs shadow-xs shrink-0">
                {itemName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                {itemType && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#5f5f69]">
                    {itemType} ciblé
                  </p>
                )}
                <h4 className="font-bold text-[#21164c] text-sm truncate">{itemName}</h4>
              </div>
            </div>
          )}

          {/* Explicit Warning Callout */}
          {warningMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/60 flex items-start gap-2.5 text-xs text-rose-900 leading-normal">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{warningMessage}</span>
            </div>
          )}

          {/* Optional Input Prompt (for requests / demands / reasons) */}
          {inputPrompt && (
            <div className="space-y-1.5 pt-1 text-left">
              <label className="block text-xs font-bold text-[#21164c]">
                {inputPrompt.label}{" "}
                {inputPrompt.required && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="text"
                value={inputPrompt.value}
                onChange={(e) => inputPrompt.onChange(e.target.value)}
                placeholder={inputPrompt.placeholder}
                disabled={isLoading}
                required={inputPrompt.required}
                className="w-full px-4 py-2.5 rounded-xl border border-[#e0e0db] bg-white text-xs text-[#21164c] placeholder:text-[#5f5f69]/60 focus:outline-none focus:border-[#592eff] focus:ring-2 focus:ring-[#592eff]/15 transition-all"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 pb-5 flex flex-col-reverse sm:flex-row items-center gap-3">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto sm:flex-1 py-3 px-4 rounded-2xl font-bold text-xs text-[#353241] bg-[#f5f5f7] hover:bg-[#e9e9ee] border border-[#e0e0db] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {cancelText}
            </button>

            <button
              type="submit"
              disabled={isLoading || (inputPrompt?.required && !inputPrompt.value.trim())}
              className={`w-full sm:w-auto sm:flex-1 py-3 px-4 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${config.confirmBtn}`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Traitement en cours...</span>
                </>
              ) : (
                <>
                  <span>{effectiveConfirmText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
