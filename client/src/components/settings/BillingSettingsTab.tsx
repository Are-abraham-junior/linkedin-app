import React, { useState, useEffect } from "react";
import { apiRequest } from "../../services/api";
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
  renewalDate: string;
  paymentMethod: {
    brand: string;
    last4: string;
    expiry: string;
  };
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
  invoices: InvoiceRecord[];
}

export const BillingSettingsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingData | null>(null);

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

  const handleDownloadInvoice = (invoiceId: string) => {
    const token = localStorage.getItem("bime_token");
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
        alert("Impossible de générer le document de facture.");
      });
  };

  if (loading || !billing) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#592eff]" />
        <span className="text-xs text-[#5f5f69] font-medium">Chargement des données de facturation...</span>
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
      <div className="adora-card p-6 sm:p-7 bg-white rounded-3xl border border-[#e0e0db]/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#f0f0f4] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#592eff]/10 flex items-center justify-center text-[#592eff]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#21164c]">Formule Actuelle</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#592eff] text-white font-extrabold text-[10px] tracking-wide uppercase">
                  {billing.plan}
                </span>
              </div>
              <p className="text-xs text-[#5f5f69]">Accès complet aux campagnes séquentielles et à l'Inbox</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-2xl font-black text-[#21164c]">
              {billing.pricePerMonth} € <span className="text-xs font-semibold text-[#7c7c88]">/ mois</span>
            </p>
            <p className="text-[11px] text-[#7c7c88] mt-0.5">
              Prochain prélèvement le {new Date(billing.renewalDate).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>

        {/* Jauges d'utilisation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Prospects */}
          <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/60 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-[#5f5f69]">Prospects gérés</span>
              <span className="font-bold text-[#21164c]">
                {billing.usage.prospectsCount} / {billing.limits.maxProspects.toLocaleString("fr-FR")}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#e0e0db]/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#592eff] transition-all duration-500"
                style={{ width: `${prospectsPercent}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-[#7c7c88] text-right font-medium">{prospectsPercent}% utilisé</p>
          </div>

          {/* Campagnes */}
          <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/60 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-[#5f5f69]">Campagnes actives</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#21164c]">
                  {billing.usage.campaignsCount} active{billing.usage.campaignsCount > 1 ? "s" : ""}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#592eff]/10 text-[#592eff] border border-[#592eff]/20">
                  Illimité
                </span>
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-[#e0e0db]/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${campaignsPercent}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-emerald-600 text-right font-semibold">Campagnes illimitées</p>
          </div>

          {/* Équipe */}
          <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/60 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-[#5f5f69]">Collaborateurs</span>
              <span className="font-bold text-[#21164c]">
                {billing.usage.teamCount} / {billing.limits.maxTeamSeats}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#e0e0db]/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0077b5] transition-all duration-500"
                style={{ width: `${teamPercent}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-[#7c7c88] text-right font-medium">{teamPercent}% utilisé</p>
          </div>
        </div>

        {/* Moyen de paiement actif */}
        <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#e0e0db]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-[#e0e0db] flex items-center justify-center text-[#21164c] font-bold">
              <CreditCard className="w-4 h-4 text-[#592eff]" />
            </div>
            <div>
              <p className="font-bold text-[#21164c]">
                {billing.paymentMethod.brand} terminant par •••• {billing.paymentMethod.last4}
              </p>
              <p className="text-[11px] text-[#7c7c88]">Expire en {billing.paymentMethod.expiry}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => alert("Pour modifier votre moyen de paiement, contactez le support ou demandez une mise à jour.")}
            className="text-xs font-bold text-[#592eff] hover:underline cursor-pointer"
          >
            Mettre à jour la carte
          </button>
        </div>
      </div>

      {/* 2. Comparatif des Plans */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-[#21164c]">Formules & Évolution</h3>
          <p className="text-xs text-[#5f5f69]">Adaptez vos volumes de prospection selon votre croissance commerciale</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* STARTER */}
          <div className={`p-5 rounded-3xl border bg-white space-y-4 ${billing.plan === "STARTER" ? "border-[#592eff] ring-2 ring-[#592eff]/20" : "border-[#e0e0db]"}`}>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm text-[#21164c]">Starter</h4>
                <p className="text-xs text-[#7c7c88]">Indépendants</p>
              </div>
              <p className="text-lg font-black text-[#21164c]">39 €<span className="text-[10px] font-normal text-[#7c7c88]">/m</span></p>
            </div>
            <ul className="space-y-2 text-xs text-[#5f5f69]">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Jusqu'à 3 000 leads</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Campagnes illimitées</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> 1 compte LinkedIn</li>
            </ul>
            <button
              disabled={billing.plan === "STARTER"}
              className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                billing.plan === "STARTER" ? "bg-[#f0edf9] text-[#592eff] cursor-default" : "bg-[#f0f0f4] hover:bg-[#e4e4e9] text-[#21164c] cursor-pointer"
              }`}
            >
              {billing.plan === "STARTER" ? "Formule Active" : "Choisir Starter"}
            </button>
          </div>

          {/* PRO */}
          <div className={`p-5 rounded-3xl border bg-white space-y-4 ${billing.plan === "PRO" ? "border-[#592eff] ring-2 ring-[#592eff]/20" : "border-[#e0e0db]"}`}>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm text-[#21164c]">Professionnel</h4>
                <p className="text-xs text-[#7c7c88]">PME & Agences</p>
              </div>
              <p className="text-lg font-black text-[#21164c]">79 €<span className="text-[10px] font-normal text-[#7c7c88]">/m</span></p>
            </div>
            <ul className="space-y-2 text-xs text-[#5f5f69]">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Jusqu'à 15 000 leads</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Campagnes illimitées</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> 5 sièges d'équipe</li>
            </ul>
            <button
              disabled={billing.plan === "PRO"}
              className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                billing.plan === "PRO" ? "bg-[#f0edf9] text-[#592eff] cursor-default" : "bg-[#f0f0f4] hover:bg-[#e4e4e9] text-[#21164c] cursor-pointer"
              }`}
            >
              {billing.plan === "PRO" ? "Formule Active" : "Choisir Professionnel"}
            </button>
          </div>

          {/* ENTERPRISE */}
          <div className={`p-5 rounded-3xl border bg-white space-y-4 relative overflow-hidden ${billing.plan === "ENTERPRISE" ? "border-[#592eff] ring-2 ring-[#592eff]/20 shadow-md" : "border-[#e0e0db]"}`}>
            <div className="absolute -right-6 top-3 rotate-45 bg-[#592eff] text-white text-[9px] font-extrabold px-6 py-0.5 uppercase tracking-wider">
              Optimal
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm text-[#21164c]">Enterprise</h4>
                <p className="text-xs text-[#7c7c88]">Grand Volume</p>
              </div>
              <p className="text-lg font-black text-[#592eff]">149 €<span className="text-[10px] font-normal text-[#7c7c88]">/m</span></p>
            </div>
            <ul className="space-y-2 text-xs text-[#5f5f69]">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> 50 000 prospects qualifiés</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Campagnes illimitées</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> 20 collaborateurs & Campagnes partagées</li>
            </ul>
            <button
              disabled={billing.plan === "ENTERPRISE"}
              className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                billing.plan === "ENTERPRISE" ? "bg-[#592eff] text-white cursor-default" : "bg-[#592eff] hover:bg-[#4922db] text-white cursor-pointer shadow-md"
              }`}
            >
              {billing.plan === "ENTERPRISE" ? "Formule Active" : "Passer à Enterprise"}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Historique & Téléchargement des Factures */}
      <div className="adora-card bg-white rounded-3xl border border-[#e0e0db]/80 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#f0f0f4] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#21164c]">Historique des Factures</h3>
            <p className="text-xs text-[#5f5f69]">Consultez et téléchargez vos reçus et factures certifiées</p>
          </div>
        </div>

        {billing.invoices.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#7c7c88] italic">
            Aucune facture disponible pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8f9fc] text-[11px] font-bold text-[#7c7c88] border-b border-[#e0e0db]/60 uppercase tracking-wider">
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
                  <tr key={inv.id} className="hover:bg-[#f8f9fc]/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-[#21164c] whitespace-nowrap">
                      {new Date(inv.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#21164c]">
                      {inv.number}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#5f5f69]">
                      Abonnement {inv.plan}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-[#21164c]">
                      {inv.amount.toFixed(2)} €
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Payée
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(inv.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f0edf9] hover:bg-[#592eff] text-[#592eff] hover:text-white font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
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
    </div>
  );
};
