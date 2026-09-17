import React, { useState, useEffect } from "react";
import { useToast } from "../ui/Toast";
import { apiRequest } from "../../services/api";
import { PLANS, ACTION_LABELS, normalizePlanId, planLabel } from "../../marketing/content/plans";
import type { ActionQuotaKind, QuotasInfo, EnrichmentBalance, EnrichmentHistoryRow } from "../../types";
import { fetchEnrichmentHistory } from "../../services/enrichment";
import {
  CreditCard,
  Download,
  FileText,
  CheckCircle2,
  Zap,
  Shield,
  Clock,
  Sparkles,
  ArrowUpRight,
  Loader2,
  Check,
} from "lucide-react";

interface InvoiceRecord {
  id: string;
  number: string;
  amount: number;
  currency: string;
  plan: string;
  status: string;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
}

interface BillingData {
  plan: string;
  pricePerMonth: number;
  currency: string;
  billingCycle: string;
  renewalDate: string | null;
  /** Compte interne (super administrateur) : aucun prélèvement, aucune facture. */
  billingExempt?: boolean;
  /** Le super administrateur choisit son offre à tout moment. */
  canChangePlan?: boolean;
  paymentMethod: {
    brand: string;
    last4: string;
    expiry: string;
  } | null;
  limits: {
    maxProspects: number;
    maxCampaigns: number | string;
    maxTeamSeats: number;
  };
  usage: {
    prospectsCount: number;
    campaignsCount: number;
    teamCount: number;
  };
  /** Quotas d'actions LinkedIn de l'utilisateur courant (null sans compte connecté / utilisateur). */
  quotas: QuotasInfo | null;
  /** Solde de tokens d'enrichissement du mois (null sans organisation). */
  enrichment: EnrichmentBalance | null;
  invoices: InvoiceRecord[];
}

const QUOTA_KINDS: ActionQuotaKind[] = ["invites", "messages", "visits", "follows"];

/** Historique du mois : une ligne par recherche (réservé → débité / restitué) ou dotation. Repliable, natif. */
const EnrichmentHistoryTable: React.FC = () => {
  const [rows, setRows] = useState<EnrichmentHistoryRow[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || rows !== null) return;
    fetchEnrichmentHistory(100).then(setRows).catch(() => setRows([]));
  }, [open, rows]);

  const resultLabel = (r: EnrichmentHistoryRow) => {
    if (r.kind === "GRANT") return `Dotation${r.note ? ` — ${r.note}` : ""}`;
    if (r.status === "PENDING") return "En cours";
    if (r.status === "FAILED") return "Profil injoignable";
    if (r.emailFound && r.phoneFound) return "E-mail et téléphone";
    if (r.emailFound) return "E-mail";
    if (r.phoneFound) return "Téléphone";
    return "Introuvable";
  };

  return (
    <details open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} className="group">
      <summary className="list-none cursor-pointer select-none text-xs font-medium text-ink inline-flex items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">›</span> Historique du mois
      </summary>
      <div className="mt-3 overflow-x-auto">
        {rows === null ? (
          <p className="text-xs text-muted-2">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-2 max-w-[65ch]">
            Aucune recherche ce mois-ci. Depuis Prospects, survolez une ligne sans e-mail ou téléphone et cliquez sur « Enrichir »,
            ou sélectionnez plusieurs prospects pour les enrichir d'un coup.
          </p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-muted-2 text-xs">
                <th className="py-1.5 pr-4 font-medium">Date</th>
                <th className="py-1.5 pr-4 font-medium">Prospect</th>
                <th className="py-1.5 pr-4 font-medium">Par</th>
                <th className="py-1.5 pr-4 font-medium">Résultat</th>
                <th className="py-1.5 pr-4 font-medium text-right">Réservés</th>
                <th className="py-1.5 pr-4 font-medium text-right">Débités</th>
                <th className="py-1.5 font-medium text-right">Restitués</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line/70 text-ink-2">
                  <td className="py-1.5 pr-4 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}{" "}
                    <span className="text-muted-2">{new Date(r.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </td>
                  <td className="py-1.5 pr-4 font-semibold text-ink">
                    {r.prospect ? r.prospect.name : r.kind === "GRANT" ? "—" : "Prospect supprimé"}
                    {r.prospect?.company && <span className="font-normal text-muted-2"> · {r.prospect.company}</span>}
                  </td>
                  <td className="py-1.5 pr-4 text-muted">{r.user?.name || "—"}</td>
                  <td className="py-1.5 pr-4">{resultLabel(r)}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{r.kind === "GRANT" ? `+${r.granted}` : r.reserved}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums font-semibold text-ink">{r.kind === "GRANT" ? "" : r.charged}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{r.kind === "GRANT" ? "" : r.refunded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
};

const currencySymbol = (code: string) => (code === "USD" ? "$" : "€");

export const BillingSettingsTab: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [planBusy, setPlanBusy] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const fetchBilling = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; billing: BillingData }>("/settings/billing");
      if (res.success && res.billing) {
        setBilling(res.billing);
      }
    } catch (err: any) {
      console.warn("Notice loading billing info:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  /** Super administrateur : bascule d'offre immédiate, quotas et tokens recalculés dans la foulée. */
  const handleChoosePlan = async (planId: string) => {
    setPlanBusy(planId);
    setPlanError(null);
    try {
      const res = await apiRequest<any>("/settings/billing/plan", { method: "PUT", body: { plan: planId } });
      if (!res.success) throw new Error(res.error || "Changement d'offre impossible.");
      await fetchBilling();
    } catch (err: any) {
      setPlanError(err.message || "Changement d'offre impossible.");
    } finally {
      setPlanBusy(null);
    }
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    const token = localStorage.getItem("bleadin_token") || localStorage.getItem("bime_token");
    const url = `/api/settings/billing/invoices/${invoiceId}/pdf`;

    // Ouverture directe avec jeton d'authentification
    const win = window.open("", "_blank");
    if (!win) return;

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.text())
      .then((html) => {
        win.document.open();
        win.document.write(html);
        win.document.close();
      })
      .catch(() => {
        win.close();
        toast.error("Impossible de générer le document de facture.");
      });
  };

  if (loading || !billing) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-ink" />
        <span className="text-xs text-muted font-medium">Chargement des données de facturation...</span>
      </div>
    );
  }

  const prospectsPercent = Math.min(
    Math.round((billing.usage.prospectsCount / billing.limits.maxProspects) * 100),
    100
  );
  const isCampaignsUnlimited =
    billing.limits.maxCampaigns === -1 ||
    billing.limits.maxCampaigns === "Illimité" ||
    typeof billing.limits.maxCampaigns === "string";
  const campaignsPercent = isCampaignsUnlimited
    ? 100
    : Math.min(
        Math.round((billing.usage.campaignsCount / Number(billing.limits.maxCampaigns || 1)) * 100),
        100
      );
  const teamPercent = Math.min(
    Math.round((billing.usage.teamCount / billing.limits.maxTeamSeats) * 100),
    100
  );

  return (
    <div className="space-y-10 max-w-5xl">
      {/* 1. Carte Abonnement Actuel & Consommation */}
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-7 bg-white rounded-2xl border border-line/80 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#f0f0f4] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-surface-2 flex items-center justify-center text-ink">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-ink">Formule Actuelle</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-accent text-white font-semibold text-xs">
                  {planLabel(billing.plan)}
                </span>
              </div>
              <p className="text-xs text-muted">Accès complet aux campagnes séquentielles et à l'Inbox</p>
            </div>
          </div>

          <div className="text-right">
            {billing.billingExempt ? (
              <>
                <p className="text-2xl font-semibold text-ink">Offert</p>
                <p className="text-xs text-muted-2 mt-0.5">Compte interne — aucune facturation</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold text-ink">
                  {billing.pricePerMonth} {currencySymbol(billing.currency)} <span className="text-xs font-semibold text-muted-2">/ mois</span>
                </p>
                {billing.renewalDate && (
                  <p className="text-xs text-muted-2 mt-0.5">
                    Prochain prélèvement le {new Date(billing.renewalDate).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Jauges d'utilisation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Prospects */}
          <div className="p-4 rounded-2xl bg-surface-2 border border-line/60 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted">Prospects gérés</span>
              <span className="font-medium text-ink">
                {billing.usage.prospectsCount} / {billing.limits.maxProspects.toLocaleString("fr-FR")}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-line/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${prospectsPercent}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-2 text-right font-medium">{prospectsPercent}% utilisé</p>
          </div>

          {/* Campagnes */}
          <div className="p-4 rounded-2xl bg-surface-2 border border-line/60 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted">Campagnes actives</span>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-ink">
                  {billing.usage.campaignsCount} active{billing.usage.campaignsCount > 1 ? "s" : ""}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-ink border border-ink">
                  Illimité
                </span>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-line/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-ok transition-all duration-500"
                style={{ width: `${campaignsPercent}%` }}
              ></div>
            </div>
            <p className="text-xs text-ok text-right font-semibold">Campagnes illimitées</p>
          </div>

          {/* Équipe */}
          <div className="p-4 rounded-2xl bg-surface-2 border border-line/60 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-muted">Collaborateurs</span>
              <span className="font-medium text-ink">
                {billing.usage.teamCount} / {billing.limits.maxTeamSeats}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-line/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0077b5] transition-all duration-500"
                style={{ width: `${teamPercent}%` }}
              ></div>
            </div>
            <p className="text-xs text-muted-2 text-right font-medium">{teamPercent}% utilisé</p>
          </div>
        </div>

        {/* Actions LinkedIn du mois (par compte) */}
        {billing.quotas && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-ink">Actions LinkedIn ce mois-ci</p>
              <p className="text-xs text-muted-2">
                Réparties automatiquement chaque jour de travail
                {billing.quotas.warmup?.active &&
                  ` · montée en charge jour ${billing.quotas.warmup.dayIndex + 1}/${billing.quotas.warmup.totalDays}`}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {QUOTA_KINDS.map((kind) => {
                const q = billing.quotas!.actions[kind];
                const monthPercent = q.limitMonth > 0 ? Math.min(Math.round((q.usedMonth / q.limitMonth) * 100), 100) : 0;
                return (
                  <div key={kind} className="p-4 rounded-2xl bg-surface-2 border border-line/60 space-y-2">
                    <div className="flex justify-between text-xs gap-2">
                      <span className="font-semibold text-muted">{ACTION_LABELS[kind]}</span>
                      <span className="font-medium text-ink whitespace-nowrap">
                        {q.usedMonth.toLocaleString("fr-FR")} / {q.limitMonth.toLocaleString("fr-FR")}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-line/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${monthPercent}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-2 text-right font-medium">
                      Cette semaine {q.usedWeek} / {q.limitWeek}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Moyen de paiement actif */}
        {billing.paymentMethod && (
        <div className="p-4 rounded-2xl bg-surface-2 border border-line/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-line flex items-center justify-center text-ink font-medium">
              <CreditCard className="w-4 h-4 text-ink" />
            </div>
            <div>
              <p className="font-medium text-ink">
                {billing.paymentMethod.brand} terminant par •••• {billing.paymentMethod.last4}
              </p>
              <p className="text-xs text-muted-2">Expire en {billing.paymentMethod.expiry}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toast.info("Pour modifier votre moyen de paiement, contactez le support.")}
            className="text-xs font-medium text-ink hover:underline cursor-pointer"
          >
            Mettre à jour la carte
          </button>
        </div>
        )}
      </div>

      {/* 2. Tokens d'enrichissement — section plate, tableau natif */}
      {billing.enrichment && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="max-w-[65ch]">
              <h3 className="text-base font-medium text-ink">Tokens d'enrichissement</h3>
              <p className="text-xs text-muted">
                1 token par e-mail trouvé, 5 par téléphone trouvé. Les coordonnées introuvables ne coûtent rien : les tokens
                réservés sont restitués. Dotation renouvelée le{" "}
                {new Date(billing.enrichment.periodEnd).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}, partagée
                par toute l'équipe.
              </p>
            </div>
            <p className="text-2xl font-semibold text-ink shrink-0 leading-none">
              {billing.enrichment.remaining}
              <span className="text-xs font-semibold text-muted-2">
                {" "}
                / {billing.enrichment.allowance + billing.enrichment.granted} restants
              </span>
            </p>
          </div>

          <div className="w-full h-2 rounded-full bg-line/60 overflow-hidden flex">
            <div
              className="h-full bg-ink transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round((billing.enrichment.debited / Math.max(1, billing.enrichment.allowance + billing.enrichment.granted)) * 100))}%`,
              }}
              title={`${billing.enrichment.debited} débités`}
            />
            <div
              className="h-full bg-accent/40 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round((billing.enrichment.pending / Math.max(1, billing.enrichment.allowance + billing.enrichment.granted)) * 100))}%`,
              }}
              title={`${billing.enrichment.pending} en cours`}
            />
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
            <div className="flex gap-1.5">
              <dt>Débités</dt>
              <dd className="font-medium text-ink">{billing.enrichment.debited}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Restitués</dt>
              <dd className="font-medium text-ink">{billing.enrichment.refunded}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Recherches</dt>
              <dd className="font-medium text-ink">{billing.enrichment.lookups}</dd>
            </div>
            {billing.enrichment.granted > 0 && (
              <div className="flex gap-1.5">
                <dt>Dotation supplémentaire</dt>
                <dd className="font-medium text-ink">+{billing.enrichment.granted}</dd>
              </div>
            )}
          </dl>

          <EnrichmentHistoryTable />
        </section>
      )}

      {/* 3. Comparatif des Plans */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-medium text-ink">Formules & Évolution</h3>
          <p className="text-xs text-muted">
            {billing.canChangePlan
              ? "Compte interne : basculez d'une offre à l'autre à tout moment, sans facturation."
              : "Adaptez vos volumes de prospection selon votre croissance commerciale"}
          </p>
        </div>
        {planError && <p className="text-xs font-semibold text-danger">{planError}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isCurrent = normalizePlanId(billing.plan) === plan.id;
            return (
              <div
                key={plan.id}
                className={`p-5 rounded-2xl border bg-white space-y-4 ${isCurrent ? "border-ink " : "border-line"}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-sm text-ink">{plan.name}</h4>
                    <p className="text-xs text-muted-2">{plan.audience}</p>
                  </div>
                  <p className="text-lg font-semibold text-ink">
                    {plan.monthly} $<span className="text-xs font-normal text-muted-2">/m</span>
                  </p>
                </div>
                <ul className="space-y-2 text-xs text-muted">
                  {plan.pitch.slice(0, 3).map((line) => (
                    <li key={line} className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-ink" /> {line}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-2">{plan.annual} $/m en engagement annuel</p>
                <button
                  type="button"
                  disabled={isCurrent || planBusy !== null || !billing.canChangePlan}
                  onClick={billing.canChangePlan ? () => handleChoosePlan(plan.id) : undefined}
                  className={`w-full py-2 rounded-xl text-xs font-medium transition-all ${
                    isCurrent
                      ? "bg-[#f0edf9] text-ink cursor-default"
                      : !billing.canChangePlan
                      ? "bg-[#f0f0f4] text-muted-2 cursor-default"
                      : plan.highlighted
                      ? "bg-accent hover:bg-accent-hover text-white cursor-pointer"
                      : "bg-[#f0f0f4] hover:bg-[#e4e4e9] text-ink cursor-pointer"
                  }`}
                >
                  {isCurrent ? "Formule active" : planBusy === plan.id ? "Activation…" : `Choisir ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Historique & Téléchargement des Factures — masqué pour un compte non facturé */}
      {!billing.billingExempt && (
      <div className="rounded-2xl border border-line bg-surface bg-white rounded-2xl border border-line/80 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#f0f0f4] flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-ink">Historique des Factures</h3>
            <p className="text-xs text-muted">Consultez et téléchargez vos reçus et factures certifiées</p>
          </div>
        </div>

        {billing.invoices.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-2 italic">
            Aucune facture disponible pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 text-xs font-medium text-muted-2 border-b border-line/60">
                  <th className="py-3 px-4 sm:px-6">Date</th>
                  <th className="py-3 px-4">Référence</th>
                  <th className="py-3 px-4">Formule</th>
                  <th className="py-3 px-4 text-right">Montant TTC</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Téléchargement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f4] text-xs">
                {billing.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-2/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-ink whitespace-nowrap">
                      {new Date(inv.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-ink">
                      {inv.number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-muted">
                      Abonnement {planLabel(inv.plan)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-ink">
                      {inv.amount.toFixed(2)} {currencySymbol(inv.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-2 text-ok font-medium text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        Payée
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(inv.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f0edf9] hover:bg-accent text-ink hover:text-white font-medium text-xs transition-all cursor-pointer"
                        title="Ouvrir et imprimer le PDF officiel"
                      >
                        <Download className="w-3 h-3" />
                        <span>Télécharger PDF</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
