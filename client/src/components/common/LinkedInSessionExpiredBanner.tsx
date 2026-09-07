import React from "react";
import { AlertTriangle, ArrowRight, ShieldAlert, KeyRound } from "lucide-react";

interface LinkedInSessionExpiredBannerProps {
  onReconnectClick: () => void;
  status?: string;
}

export const LinkedInSessionExpiredBanner: React.FC<LinkedInSessionExpiredBannerProps> = ({
  onReconnectClick,
  status = "DISCONNECTED",
}) => {
  const isCheckpoint = status === "CHECKPOINT";
  const isGatewayIssue = status === "GATEWAY_UNAVAILABLE";

  return (
    <div
      role="alert"
      className="bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-[#592eff]/15 border-b border-amber-500/30 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs z-30 shrink-0 shadow-sm backdrop-blur-md animate-fadeIn"
    >
      <div className="flex items-center gap-3 flex-1 min-w-[280px]">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-700 shrink-0">
          {isCheckpoint ? (
            <KeyRound className="w-4 h-4 animate-bounce" />
          ) : (
            <AlertTriangle className="w-4 h-4 animate-pulse text-amber-600" />
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-600 to-rose-600 text-white font-black text-[10px] uppercase tracking-wider shadow-xs shrink-0 w-fit">
            <ShieldAlert className="w-3 h-3" />
            {isCheckpoint ? "Sécurité Requise" : "Session Expirée"}
          </span>

          <p className="text-xs text-[#2e1d0f] font-medium leading-tight">
            <strong className="font-extrabold text-[#21164c]">
              {isCheckpoint
                ? "Code de vérification LinkedIn demandé : "
                : isGatewayIssue
                ? "Synchronisation LinkedIn en pause : "
                : "Votre session LinkedIn a expiré : "}
            </strong>
            <span className="text-[#451a03]">
              {isCheckpoint
                ? "LinkedIn requiert une validation de sécurité à 2 facteurs pour poursuivre l'envoi."
                : "Vos campagnes automatisées et messages sont temporairement en pause. Reconnectez votre compte pour reprendre."}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onReconnectClick}
          className="px-4 py-1.5 bg-gradient-to-r from-[#592eff] to-[#7c3aed] hover:from-[#4a22e0] hover:to-[#6d28d9] text-white font-bold text-xs rounded-xl shadow-md shadow-[#592eff]/30 hover:shadow-[#592eff]/50 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>{isCheckpoint ? "Valider le code" : "Reconnecter ma session"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
