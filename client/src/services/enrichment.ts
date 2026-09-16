import { apiRequest } from "./api";
import { ENRICHMENT_COST } from "../marketing/content/plans";
import type { EnrichmentBalance, EnrichmentHistoryRow, EnrichmentProspectResult } from "../types";

/** Tokens d'enrichissement : 1 = e-mail trouvé, 5 = téléphone trouvé, restitués si introuvables. */

/**
 * Diffusion du solde entre la page Prospects (qui consomme) et le chip du bandeau (qui affiche) :
 * un `CustomEvent` sur `window`, sans contexte React supplémentaire.
 */
const BALANCE_EVENT = "bleadin:enrichment-balance";

export function publishEnrichmentBalance(balance: EnrichmentBalance): void {
  window.dispatchEvent(new CustomEvent<EnrichmentBalance>(BALANCE_EVENT, { detail: balance }));
}

export function subscribeEnrichmentBalance(cb: (balance: EnrichmentBalance) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<EnrichmentBalance>).detail);
  window.addEventListener(BALANCE_EVENT, handler);
  return () => window.removeEventListener(BALANCE_EVENT, handler);
}

export async function fetchEnrichmentBalance(): Promise<EnrichmentBalance | null> {
  const res = await apiRequest<{ balance: EnrichmentBalance }>("/enrichment/balance");
  return res.success && res.balance ? (res.balance as EnrichmentBalance) : null;
}

export async function enrichProspects(prospectIds: string[]): Promise<{
  success: boolean;
  error?: string;
  code?: string;
  results: EnrichmentProspectResult[];
  balance: EnrichmentBalance | null;
}> {
  const res = await apiRequest("/enrichment/enrich", { method: "POST", body: { prospectIds } });
  return {
    success: res.success,
    error: res.error,
    code: res.code,
    results: (res.results as EnrichmentProspectResult[]) || [],
    balance: (res.balance as EnrichmentBalance) || null,
  };
}

export async function fetchEnrichmentHistory(limit = 100): Promise<EnrichmentHistoryRow[]> {
  const res = await apiRequest<{ history: EnrichmentHistoryRow[] }>(`/enrichment/history?limit=${limit}`);
  return res.success && Array.isArray(res.history) ? (res.history as EnrichmentHistoryRow[]) : [];
}

/** Coût maximal pour un prospect : uniquement ce qui lui manque. */
export function enrichmentCostFor(p: { email?: string | null; phone?: string | null }): number {
  return (p.email ? 0 : ENRICHMENT_COST.email) + (p.phone ? 0 : ENRICHMENT_COST.phone);
}

/** Prospects incomplets et coût maximal cumulé d'une sélection. */
export function enrichmentEstimate<T extends { email?: string | null; phone?: string | null }>(items: T[]) {
  const incomplete = items.filter((p) => enrichmentCostFor(p) > 0);
  const maxCost = incomplete.reduce((sum, p) => sum + enrichmentCostFor(p), 0);
  return { incomplete, maxCost };
}
