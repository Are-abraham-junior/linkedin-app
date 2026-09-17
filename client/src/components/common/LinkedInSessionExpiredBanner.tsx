import React from "react";
import { ArrowRight } from "lucide-react";
import { StatusDot } from "../ui/Badge";
import { Button } from "../ui/Button";

interface LinkedInSessionExpiredBannerProps {
  onReconnectClick: () => void;
  status?: string;
}

/** Bandeau d'alerte LinkedIn : une ligne, un point de statut, un bouton. */
export const LinkedInSessionExpiredBanner: React.FC<LinkedInSessionExpiredBannerProps> = ({
  onReconnectClick,
  status = "DISCONNECTED",
}) => {
  const isCheckpoint = status === "CHECKPOINT";
  const isGatewayIssue = status === "GATEWAY_UNAVAILABLE";

  const title = isCheckpoint
    ? "Code de vérification LinkedIn demandé."
    : isGatewayIssue
      ? "Synchronisation LinkedIn en pause."
      : "Votre session LinkedIn a expiré.";
  const detail = isCheckpoint
    ? "LinkedIn demande une validation de sécurité pour poursuivre les envois."
    : "Vos campagnes et messages sont en pause jusqu'à la reconnexion.";

  return (
    <div
      role="alert"
      className="z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-6"
    >
      <StatusDot tone="warn" className="min-w-0 flex-1">
        <span className="truncate">
          <span className="font-semibold text-ink">{title}</span> <span className="text-muted">{detail}</span>
        </span>
      </StatusDot>
      <Button size="sm" iconRight={ArrowRight} onClick={onReconnectClick}>
        {isCheckpoint ? "Valider le code" : "Reconnecter"}
      </Button>
    </div>
  );
};
