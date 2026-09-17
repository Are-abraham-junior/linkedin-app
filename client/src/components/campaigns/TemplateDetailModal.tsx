import React from "react";
import { ArrowRight, Send, Eye, UserCheck, MessageSquare, Zap, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ActionType } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export interface SequenceTemplateStep {
  actionType: ActionType;
  delayDays: number;
  defaultMessage: string;
  label: string;
}

export interface SequenceTemplate {
  id: string;
  title: string;
  badge?: string;
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
  /** Ouverte au-dessus de l'assistant de campagne. */
  zIndex?: number;
}

const ACTION_META: Record<string, { name: string; icon: LucideIcon }> = {
  INVITATION: { name: "Invitation", icon: Send },
  MESSAGE: { name: "Message", icon: MessageSquare },
  VISIT: { name: "Visite de profil", icon: Eye },
  VISIT_PROFILE: { name: "Visite de profil", icon: Eye },
  FOLLOW: { name: "Suivre le profil", icon: UserCheck },
};

/** Aperçu d'un modèle de séquence : titre, cible, déroulé des étapes. */
export const TemplateDetailModal: React.FC<TemplateDetailModalProps> = ({
  template,
  isOpen,
  onClose,
  onSelectAndProceed,
  isSelected = false,
  zIndex = 60,
}) => {
  if (!template) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={template.title}
      description={template.description}
      size="lg"
      zIndex={zIndex}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Retour aux modèles
          </Button>
          <Button onClick={() => onSelectAndProceed(template.id)} icon={isSelected ? CheckCircle2 : undefined} iconRight={isSelected ? undefined : ArrowRight}>
            {isSelected ? "Continuer avec ce modèle" : "Choisir ce modèle"}
          </Button>
        </>
      }
    >
      <div className="space-y-6 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {template.badge && <Badge tone="accent">{template.badge}</Badge>}
          {template.popularity && <Badge>{template.popularity} utilisateurs</Badge>}
          <Badge tone="ok">Arrêt dès qu'une réponse arrive</Badge>
        </div>

        {template.recommendedFor && (
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
            <p className="font-medium text-ink">Cible recommandée</p>
            <p className="mt-0.5 text-muted">{template.recommendedFor}</p>
          </div>
        )}

        <div>
          <p className="mb-3 text-sm font-medium text-ink">Déroulé ({template.steps.length} étapes)</p>
          <ol className="divide-y divide-line rounded-xl border border-line">
            {template.steps.map((step, idx) => {
              const meta = ACTION_META[step.actionType] ?? { name: "Action", icon: Zap };
              const Icon = meta.icon;
              const hasNote = step.actionType === "INVITATION" && step.defaultMessage && step.defaultMessage.trim().length > 0;
              return (
                <li key={idx} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-xs tabular-nums text-muted">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                        <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} aria-hidden />
                        {step.label || meta.name}
                      </span>
                      {step.actionType === "INVITATION" && (
                        <Badge size="sm" tone={hasNote ? "accent" : "neutral"}>
                          {hasNote ? "Note au choix" : "Sans note"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {hasNote ? "Note d'invitation suggérée, à accepter ou refuser à l'étape suivante." : "Action automatisée sur le profil LinkedIn."}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted">
                    {idx === 0 ? "Au lancement" : `+${step.delayDays} jour${step.delayDays > 1 ? "s" : ""}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Modal>
  );
};
