import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { fetchEnrichmentBalance, subscribeEnrichmentBalance } from "../../services/enrichment";
import type { EnrichmentBalance } from "../../types";
import { TokenGlyph } from "../common/TokenGlyph";

/**
 * Solde de tokens d'enrichissement de l'espace courant, dans le bandeau.
 * Chip fantôme au gabarit des autres contrôles du Header ; la couleur du texte
 * porte l'alerte (ambre sous 20 %, rouge à 0), jamais de pastille ni de violet.
 * Absent quand aucune organisation n'est active (Hub Global du super admin).
 */
export const EnrichmentTokensChip: React.FC = () => {
  const { user, impersonatedOrg } = useAuth();
  const [balance, setBalance] = useState<EnrichmentBalance | null | undefined>(undefined); // undefined = chargement

  const organizationId = impersonatedOrg?.id || user?.organization?.id || null;

  useEffect(() => {
    if (!organizationId) {
      setBalance(null);
      return;
    }
    let active = true;
    setBalance(undefined);
    fetchEnrichmentBalance()
      .then((b) => active && setBalance(b))
      .catch(() => active && setBalance(null));
    return () => {
      active = false;
    };
  }, [organizationId]);

  // Mises à jour poussées par la page Prospects après chaque enrichissement
  useEffect(() => subscribeEnrichmentBalance(setBalance), []);

  if (balance === null) return null;

  const total = balance ? balance.allowance + balance.granted : 0;
  const tone =
    !balance
      ? "text-muted-2"
      : balance.remaining === 0
        ? "text-danger"
        : balance.remaining <= Math.ceil(total * 0.2)
          ? "text-warn"
          : "text-ink";

  return (
    <Link
      to="/settings?tab=billing"
      className={`hidden sm:flex h-8 items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-2.5 text-sm font-medium transition-colors hover:border-ink ${tone}`}
      title={
        balance
          ? `Tokens d'enrichissement · ${balance.debited} débités, ${balance.refunded} restitués ce mois-ci. 1 = 1 e-mail, 5 = 1 téléphone.`
          : "Tokens d'enrichissement"
      }
    >
      <TokenGlyph className={balance ? "" : "opacity-40"} />
      {balance ? (
        <span className="tabular-nums leading-none">
          {balance.remaining}
          <span className="font-medium text-muted-2">
            {" "}/ {total}
            <span className="hidden md:inline"> tokens</span>
          </span>
        </span>
      ) : (
        <span className="inline-block w-14 h-2.5 rounded bg-line/70 animate-pulse" />
      )}
    </Link>
  );
};
