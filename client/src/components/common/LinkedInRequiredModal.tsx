import React from "react";
import { Sparkles, X, ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";

const LinkedInIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.25c-.9 0-1.63.73-1.63 1.63s.73 1.63 1.63 1.63 1.63-.73 1.63-1.63-.73-1.63-1.63-1.63Z" />
  </svg>
);

interface LinkedInRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectLinkedIn: () => void;
  title?: string;
  description?: string;
  featureName?: string;
}

export const LinkedInRequiredModal: React.FC<LinkedInRequiredModalProps> = ({
  isOpen,
  onClose,
  onConnectLinkedIn,
  title = "Connexion LinkedIn requise",
  description = "Pour rechercher des profils ciblés et lancer des campagnes automatisées, vous devez d'abord associer votre compte LinkedIn personnel à votre espace.",
  featureName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#21164c]/40 backdrop-blur-md animate-fade-in">
      <div
        className="bg-white w-full max-w-md rounded-[32px] shadow-2xl shadow-[#592eff]/15 border border-[#e0e0db]/80 overflow-hidden relative"
        style={{ animation: "modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-2xl bg-[#f8f9fc] hover:bg-gray-100 flex items-center justify-center text-[#5f5f69] hover:text-[#21164c] transition-colors cursor-pointer border border-[#e0e0db]/60 z-10"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Decorative Top Accent Header */}
        <div className="p-7 pb-4 text-center relative bg-gradient-to-b from-[#592eff]/5 to-transparent">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#0077b5] to-[#0a66c2] text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#0077b5]/25 ring-4 ring-white">
            <LinkedInIcon className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0077b5]/10 text-[#0077b5] text-xs font-bold mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Compte LinkedIn non lié</span>
          </div>

          <h2 className="text-xl font-extrabold text-[#21164c] tracking-tight">
            {title}
          </h2>

          <p className="text-xs text-[#5f5f69] mt-2 leading-relaxed px-2">
            {featureName ? (
              <>
                L'action <span className="font-bold text-[#21164c]">"{featureName}"</span> nécessite un compte LinkedIn actif pour interagir avec le réseau en toute sécurité.
              </>
            ) : (
              description
            )}
          </p>
        </div>

        {/* Value Points */}
        <div className="px-7 py-3">
          <div className="bg-[#f8f9fc] rounded-2xl p-4 border border-[#e0e0db]/60 space-y-2.5 text-xs text-[#21164c]">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">Recherche & extraction de profils ciblés</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">Envoi automatique d'invitations & relances</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">Protection anti-spam avec jitter intelligent</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-7 pt-3 space-y-2.5">
          <button
            onClick={() => {
              onClose();
              onConnectLinkedIn();
            }}
            className="w-full py-3.5 px-5 rounded-2xl font-bold text-white text-xs shadow-lg shadow-[#592eff]/25 hover:shadow-[#592eff]/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
          >
            <LinkedInIcon className="w-4 h-4" />
            <span>Connecter mon compte LinkedIn</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-[#5f5f69] hover:text-[#21164c] hover:bg-[#f8f9fc] transition-colors cursor-pointer"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
};
