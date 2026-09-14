import React, { useState } from "react";
import { ShieldCheck, RefreshCw, Loader2, Clock } from "lucide-react";
import { apiRequest } from "../../services/api";

interface LinkedInCheckpointFormProps {
  /** account_id Unipile en attente de vérification (le même est réutilisé : aucun nouveau compte créé). */
  accountId: string;
  /** Endpoint de résolution (ex. "/auth/linkedin/checkpoint" ou "/settings/linkedin/checkpoint"). */
  solveEndpoint: string;
  /** Endpoint de renvoi du code (ex. "/auth/linkedin/checkpoint/resend"). */
  resendEndpoint: string;
  /** Champs supplémentaires envoyés avec le code (ex. linkedinEmail pour le flux public). */
  extraBody?: Record<string, unknown>;
  message?: string | null;
  onSolved: (res: any) => void | Promise<void>;
  /** Un nouveau checkpoint a été demandé par LinkedIn (le formulaire reste affiché). */
  onNewCheckpoint?: (checkpoint: any) => void;
  onCancel?: () => void;
}

/**
 * Saisie du code 2FA / OTP LinkedIn. L'intent Unipile expire au bout de 5 minutes :
 * on affiche un compte à rebours et un bouton « Renvoyer le code ».
 */
export const LinkedInCheckpointForm: React.FC<LinkedInCheckpointFormProps> = ({
  accountId,
  solveEndpoint,
  resendEndpoint,
  extraBody,
  message,
  onSolved,
  onNewCheckpoint,
  onCancel,
}) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    const res = await apiRequest(solveEndpoint, {
      method: "POST",
      body: JSON.stringify({ accountId, code: code.trim(), ...(extraBody || {}) }),
    });
    if (res.success) {
      await onSolved(res);
    } else if (res.status === "CHECKPOINT") {
      setCode("");
      setInfo(res.message || "LinkedIn demande une vérification supplémentaire. Entrez le nouveau code.");
      onNewCheckpoint?.(res.checkpoint);
    } else {
      setError(res.error || "Code invalide ou expiré.");
    }
    setLoading(false);
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    setInfo(null);
    const res = await apiRequest(resendEndpoint, { method: "POST", body: JSON.stringify({ accountId }) });
    if (res.success) setInfo("Un nouveau code vient d'être envoyé.");
    else setError(res.error || "Impossible de renvoyer le code.");
    setResending(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-950">Code de sécurité requis</p>
          <p className="text-[11px] text-amber-800 mt-0.5">
            {message || "LinkedIn demande une vérification (2FA, SMS, e-mail ou notification mobile)."} Vous avez
            5 minutes pour saisir le code.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">{error}</div>
      )}
      {info && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">{info}</div>
      )}

      <div>
        <label className="block text-xs font-bold text-[#21164c] uppercase tracking-wider mb-1.5">Code de vérification</label>
        <div className="relative">
          <ShieldCheck className="w-4 h-4 text-[#5f5f69] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            autoFocus
            required
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e0e0db] text-[#21164c] text-sm tracking-[0.3em] font-bold focus:outline-none focus:border-[#592eff] focus:bg-white focus:ring-3 focus:ring-[#592eff]/10 transition-all"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !code.trim()}
        className="w-full py-3 rounded-xl font-bold text-xs text-white shadow-md shadow-[#592eff]/25 hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, #592eff, #7c3aed)" }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        Valider le code
      </button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={resend}
          disabled={resending || loading}
          className="inline-flex items-center gap-1.5 font-bold text-[#592eff] hover:underline cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
          Renvoyer le code
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="font-bold text-[#5f5f69] hover:text-[#21164c] cursor-pointer">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
};
