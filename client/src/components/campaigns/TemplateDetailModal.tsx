import React, { useEffect, useRef } from "react";
import {
  X,
  Layers,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  Send,
  Eye,
  UserCheck,
  MessageSquare,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { ActionType } from "../../types";

export interface SequenceTemplateStep {
  actionType: ActionType;
  delayDays: number;
  defaultMessage: string;
  label: string;
}

export interface SequenceTemplate {
  id: string;
  title: string;
  badge: string;
  badgeColor?: string;
  description: string;
  recommendedFor: string;
  image: string;
  popularity?: string;
  steps: SequenceTemplateStep[];
}

interface TemplateDetailModalProps {
  template: SequenceTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectAndProceed: (templateId: string) => void;
  isSelected?: boolean;
}

export const TemplateDetailModal: React.FC<TemplateDetailModalProps> = ({
  template,
  isOpen,
  onClose,
  onSelectAndProceed,
  isSelected = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !template) return null;

  const getActionMeta = (type: ActionType) => {
    switch (type) {
      case "INVITATION":
        return {
          name: "Invitation",
          icon: <Send className="w-4 h-4" />,
          bgColor: "bg-blue-50 text-blue-600 border-blue-200",
          accentColor: "#3b82f6",
        };
      case "MESSAGE":
        return {
          name: "Message",
          icon: <MessageSquare className="w-4 h-4" />,
          bgColor: "bg-[#592eff]/10 text-[#592eff] border-[#592eff]/20",
          accentColor: "#592eff",
        };
      case "VISIT":
      case "VISIT_PROFILE":
        return {
          name: "Visite de profil",
          icon: <Eye className="w-4 h-4" />,
          bgColor: "bg-cyan-50 text-cyan-600 border-cyan-200",
          accentColor: "#06b6d4",
        };
      case "FOLLOW":
        return {
          name: "Suivre le profil",
          icon: <UserCheck className="w-4 h-4" />,
          bgColor: "bg-emerald-50 text-emerald-600 border-emerald-200",
          accentColor: "#10b981",
        };
      default:
        return {
          name: "Action",
          icon: <Zap className="w-4 h-4" />,
          bgColor: "bg-purple-50 text-purple-600 border-purple-200",
          accentColor: "#8b5cf6",
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#21164c]/45 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white w-full max-w-2xl rounded-[32px] sm:rounded-[36px] shadow-2xl shadow-[#21164c]/20 border border-[#e0e0db]/80 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* En-tête de la modale */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#e0e0db]/80 flex items-center justify-between shrink-0 bg-[#fbfbfe]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#21164c]">
                Aperçu du modèle de séquence
              </h2>
              <p className="text-xs text-[#5f5f69]">
                Visualisez la structure, les étapes et les délais de cette campagne
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-[#f8f9fc] hover:bg-gray-100 flex items-center justify-center text-[#5f5f69] hover:text-[#21164c] transition-colors cursor-pointer border border-[#e0e0db]/60"
            title="Fermer (Échap)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar space-y-6 flex-1">
          {/* Hero Banner avec Image 3D Waalaxy */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#f0f3fe] to-white border border-[#e0e0db]/80 p-6 flex flex-col sm:flex-row items-center gap-6 shadow-xs">
            {/* Image d'illustration Waalaxy */}
            <div className="w-full sm:w-56 h-40 sm:h-44 rounded-2xl overflow-hidden bg-white shadow-md border border-[#e0e0db]/60 shrink-0 flex items-center justify-center group relative">
              <img
                src={template.image}
                alt={template.title}
                className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                loading="eager"
              />
              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-[#0077b5] text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                <span>in</span>
                <span>LinkedIn</span>
              </div>
            </div>

            {/* Infos clés & Titre */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    template.badgeColor || "bg-[#592eff]/10 text-[#592eff]"
                  }`}
                >
                  {template.badge}
                </span>

                {template.popularity && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5f5f69] bg-white px-2.5 py-1 rounded-full border border-[#e0e0db]">
                    <Users className="w-3 h-3 text-[#592eff]" />
                    <span>{template.popularity} utilisateurs</span>
                  </span>
                )}
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-[#21164c] tracking-tight">
                {template.title}
              </h3>

              <p className="text-xs sm:text-sm text-[#5f5f69] leading-relaxed">
                {template.description}
              </p>
            </div>
          </div>

          {/* Cible Recommandée */}
          {template.recommendedFor && (
            <div className="p-4 rounded-2xl bg-[#592eff]/[0.04] border border-[#592eff]/15 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#592eff]/10 text-[#592eff] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-[#21164c] mb-0.5">Cible recommandée :</p>
                <p className="text-[#5f5f69] font-medium leading-relaxed">
                  {template.recommendedFor}
                </p>
              </div>
            </div>
          )}

          {/* Timeline Chronologique des Étapes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#21164c] uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#592eff]" />
                <span>Déroulement séquentiel ({template.steps.length} étapes)</span>
              </h4>
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                <ShieldCheck className="w-3 h-3" />
                Arrêt si réponse
              </span>
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#e0e0db]">
              {template.steps.map((step, idx) => {
                const meta = getActionMeta(step.actionType);

                return (
                  <div key={idx} className="relative flex items-start gap-3.5 group">
                    {/* Pastille chronologique */}
                    <div
                      className={`absolute -left-6 top-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-extrabold shadow-xs z-10 ${
                        meta.bgColor
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {/* Carte de l'étape */}
                    <div className="flex-1 p-3.5 sm:p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/80 hover:border-[#592eff]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center border ${meta.bgColor} shrink-0`}
                        >
                          {meta.icon}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#21164c]">
                            {step.label}
                          </p>
                          <p className="text-[11px] text-[#5f5f69] font-medium">
                            Action automatisée sur le profil LinkedIn
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-start sm:self-center px-2.5 py-1 rounded-lg bg-white border border-[#e0e0db] text-[11px] font-semibold text-[#5f5f69]">
                        <Clock className="w-3 h-3 text-[#592eff]" />
                        <span>
                          {idx === 0
                            ? "Dès le lancement (J+0)"
                            : `Attente : +${step.delayDays} jour${
                                step.delayDays > 1 ? "s" : ""
                              }`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Règle de sécurité Bime Link */}
          <div className="p-3.5 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db] text-xs text-[#5f5f69] flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Garantie anti-spam :</strong> Dès que le prospect répond ou accepte selon l'étape, les relances suivantes sont immédiatement interrompues.
            </span>
          </div>
        </div>

        {/* Footer avec Boutons d'Action */}
        <div className="px-6 sm:px-8 py-4 bg-[#fbfbfe] border-t border-[#e0e0db]/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#e0e0db] text-xs font-bold text-[#5f5f69] hover:bg-[#f5f5f7] transition-all cursor-pointer"
          >
            Retour aux modèles
          </button>

          <button
            type="button"
            onClick={() => onSelectAndProceed(template.id)}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#592eff] hover:bg-[#4d25e0] text-white text-xs font-bold shadow-lg shadow-[#592eff]/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            {isSelected ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Continuer avec ce modèle</span>
              </>
            ) : (
              <>
                <span>Choisir ce modèle</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
