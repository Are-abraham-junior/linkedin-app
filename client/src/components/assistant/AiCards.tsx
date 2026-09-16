import React, { useState } from "react";
import { Check, ExternalLink, Users, Rocket, ListChecks, ShieldCheck, AlertTriangle, Pencil, Loader2, Eye, UserPlus, Send, MessageSquare, Clock } from "lucide-react";
import type { AiCard, AiDraftStep, AiProfile } from "../../services/aiStream";

const STEP_META: Record<AiDraftStep["actionType"], { label: string; icon: React.FC<{ className?: string }> }> = {
  VISIT_PROFILE: { label: "Visite de profil", icon: Eye },
  FOLLOW: { label: "Suivre le profil", icon: UserPlus },
  INVITATION: { label: "Invitation", icon: Send },
  MESSAGE: { label: "Message", icon: MessageSquare },
  DELAY: { label: "Attente", icon: Clock },
};

const cardShell = "rounded-3xl border border-[#e0e0db] bg-white shadow-xs overflow-hidden";
const cardHeader = "flex items-center gap-2.5 px-4 py-3 border-b border-[#e0e0db]/70 bg-[#fafafd]";

export const ProfilesCard: React.FC<{
  card: Extract<AiCard, { type: "profiles" }>;
  onAddSelected?: (indexes: number[] | "all") => void;
  disabled?: boolean;
}> = ({ card, onAddSelected, disabled }) => {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(card.profiles.map((_, i) => i + 1)));
  const allSelected = selected.size === card.profiles.length;

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className={cardShell}>
      <div className={cardHeader}>
        <Users className="w-4 h-4 text-[#592eff]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#21164c] truncate">{card.profiles.length} profil(s) trouvé(s)</p>
          <p className="text-[11px] text-[#5f5f69] truncate">
            {card.query}
            {card.totalCount > card.profiles.length ? ` · ${card.totalCount.toLocaleString("fr-FR")} sur LinkedIn` : ""}
            {card.excludedCount > 0 ? ` · ${card.excludedCount} déjà dans vos prospects` : ""}
          </p>
        </div>
        {card.profiles.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected(allSelected ? new Set() : new Set(card.profiles.map((_, i) => i + 1)))}
            className="text-[11px] font-semibold text-[#592eff] hover:underline"
          >
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        )}
      </div>
      {card.profiles.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-[#5f5f69]">Aucun profil ne correspond. Essayez d'élargir les critères.</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-[#e0e0db]/60">
          {card.profiles.map((p: AiProfile, idx) => {
            const i = idx + 1;
            const checked = selected.has(i);
            return (
              <li key={p.providerProfileId || i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafafd]">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    checked ? "bg-[#592eff] border-[#592eff] text-white" : "border-[#c9c9c4] bg-white"
                  }`}
                  aria-label={checked ? "Désélectionner" : "Sélectionner"}
                >
                  {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                </button>
                <span className="w-5 text-[11px] text-[#5f5f69] tabular-nums shrink-0">{i}.</span>
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#bcf2ff] text-[#21164c] text-[11px] font-bold flex items-center justify-center shrink-0">
                    {(p.firstName?.[0] || "?").toUpperCase()}
                    {(p.lastName?.[0] || "").toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#21164c] truncate">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-[11px] text-[#5f5f69] truncate">
                    {p.headline}
                    {p.company ? ` · ${p.company}` : ""}
                    {p.location ? ` · ${p.location}` : ""}
                  </p>
                </div>
                {p.linkedinUrl && (
                  <a href={p.linkedinUrl} target="_blank" rel="noreferrer" className="text-[#5f5f69] hover:text-[#592eff] shrink-0" title="Voir sur LinkedIn">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {card.profiles.length > 0 && onAddSelected && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#e0e0db]/70">
          <span className="text-[11px] text-[#5f5f69]">{selected.size} sélectionné(s)</span>
          <button
            type="button"
            disabled={disabled || selected.size === 0}
            onClick={() => onAddSelected(allSelected ? "all" : Array.from(selected).sort((a, b) => a - b))}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#592eff] text-white text-[12px] font-semibold hover:bg-[#4a22e0] disabled:opacity-50"
          >
            <ListChecks className="w-3.5 h-3.5" />
            Ajouter à une liste
          </button>
        </div>
      )}
    </div>
  );
};

export const ListCard: React.FC<{ card: Extract<AiCard, { type: "list" }> }> = ({ card }) => (
  <div className={`${cardShell} px-4 py-3 flex items-center gap-3`}>
    <div className="w-9 h-9 rounded-2xl bg-[#dfff9d] flex items-center justify-center shrink-0">
      <ListChecks className="w-4 h-4 text-[#21164c]" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-bold text-[#21164c] truncate">Liste « {card.list.name} »</p>
      <p className="text-[11px] text-[#5f5f69]">
        {card.imported !== undefined
          ? `${card.imported} prospect(s) ajouté(s)${card.duplicates ? ` · ${card.duplicates} doublon(s) ignoré(s)` : ""} · ${card.list.prospectsCount} au total`
          : `${card.list.prospectsCount} prospect(s)`}
      </p>
    </div>
  </div>
);

const StepEditor: React.FC<{
  steps: AiDraftStep[];
  editable: boolean;
  onChange?: (steps: AiDraftStep[]) => void;
}> = ({ steps, editable, onChange }) => (
  <ol className="space-y-2">
    {steps.map((s, idx) => {
      const meta = STEP_META[s.actionType] || STEP_META.DELAY;
      const Icon = meta.icon;
      const limit = s.actionType === "INVITATION" ? 300 : 1900;
      const len = (s.messageText || "").length;
      const over = len > limit;
      return (
        <li key={idx} className="rounded-2xl border border-[#e0e0db]/80 bg-[#fafafd] p-3">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="w-5 h-5 rounded-full bg-[#21164c] text-white text-[10px] font-bold flex items-center justify-center">{s.stepOrder}</span>
            <Icon className="w-3.5 h-3.5 text-[#592eff]" />
            <span className="font-semibold text-[#21164c]">{meta.label}</span>
            <span className="text-[#5f5f69]">· J+{s.delayDays}</span>
          </div>
          {(s.actionType === "INVITATION" || s.actionType === "MESSAGE") &&
            (editable ? (
              <div className="mt-2">
                <textarea
                  value={s.messageText || ""}
                  onChange={(e) => onChange?.(steps.map((x, j) => (j === idx ? { ...x, messageText: e.target.value } : x)))}
                  rows={3}
                  placeholder={s.actionType === "INVITATION" ? "Note d'invitation (optionnelle, ≤ 300 caractères)" : "Texte du message"}
                  className={`w-full text-[12px] rounded-xl border bg-white px-3 py-2 focus:outline-none focus:border-[#592eff] resize-y ${over ? "border-red-400" : "border-[#e0e0db]"}`}
                />
                <p className={`mt-1 text-[10px] text-right ${over ? "text-red-600 font-semibold" : "text-[#5f5f69]"}`}>
                  {len}/{limit}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-[#353241] whitespace-pre-wrap">{s.messageText || <span className="italic text-[#5f5f69]">Sans note</span>}</p>
            ))}
        </li>
      );
    })}
  </ol>
);

export const CampaignProposalCard: React.FC<{
  card: Extract<AiCard, { type: "campaign_proposal" }>;
  onSaveSteps?: (steps: AiDraftStep[]) => Promise<boolean>;
  onLaunch?: () => void;
  disabled?: boolean;
}> = ({ card, onSaveSteps, onLaunch, disabled }) => {
  const [editing, setEditing] = useState(false);
  const [steps, setSteps] = useState<AiDraftStep[]>(card.campaign.steps);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!onSaveSteps) return;
    setSaving(true);
    const ok = await onSaveSteps(steps);
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <div className={cardShell}>
      <div className={cardHeader}>
        <Rocket className="w-4 h-4 text-[#592eff]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#21164c] truncate">Brouillon · {card.campaign.name}</p>
          <p className="text-[11px] text-[#5f5f69] truncate">
            {card.campaign.listName ? `Liste « ${card.campaign.listName} » · ${card.campaign.prospectsCount} prospect(s)` : "Aucune liste"} · {steps.length} étape(s)
          </p>
        </div>
        {onSaveSteps && !editing && (
          <button type="button" onClick={() => setEditing(true)} disabled={disabled} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#592eff] hover:underline disabled:opacity-50">
            <Pencil className="w-3 h-3" /> Modifier
          </button>
        )}
      </div>
      <div className="p-4">
        <StepEditor steps={steps} editable={editing} onChange={setSteps} />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-[#e0e0db]/70">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => {
                setSteps(card.campaign.steps);
                setEditing(false);
              }}
              className="h-8 px-3 rounded-lg border border-[#e0e0db] text-[12px] font-semibold text-[#353241] hover:bg-[#f5f5f7]"
            >
              Annuler
            </button>
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#21164c] text-white text-[12px] font-semibold disabled:opacity-60">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Enregistrer le brouillon
            </button>
          </>
        ) : (
          onLaunch && (
            <button type="button" onClick={onLaunch} disabled={disabled} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#592eff] text-white text-[12px] font-semibold hover:bg-[#4a22e0] disabled:opacity-50">
              <Rocket className="w-3.5 h-3.5" />
              Lancer la campagne
            </button>
          )
        )}
      </div>
    </div>
  );
};

export const ConfirmLaunchCard: React.FC<{
  card: Extract<AiCard, { type: "confirm_launch" }>;
  onConfirm?: (token: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  consumed?: boolean;
}> = ({ card, onConfirm, onCancel, disabled, consumed }) => (
  <div className={`${cardShell} border-[#592eff]/40`}>
    <div className={cardHeader}>
      <ShieldCheck className="w-4 h-4 text-[#592eff]" />
      <p className="text-[13px] font-bold text-[#21164c]">Confirmer le lancement</p>
    </div>
    <div className="p-4 space-y-2 text-[12px] text-[#353241]">
      <p>
        <span className="font-semibold">{card.summary.name}</span> · liste « {card.summary.listName || "—"} » · <span className="font-semibold">{card.summary.prospectsCount}</span> prospect(s)
      </p>
      <p className="text-[#5f5f69]">{card.summary.steps.map((s) => `${STEP_META[s.actionType]?.label || s.actionType} (J+${s.delayDays})`).join(" → ")}</p>
      <p className="text-[11px] text-[#5f5f69]">Les actions seront exécutées pendant vos heures de travail, dans la limite de vos quotas. Aucune action n'est envoyée avant votre confirmation.</p>
    </div>
    {!consumed && (
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#e0e0db]/70">
        <button type="button" onClick={onCancel} disabled={disabled} className="h-8 px-3 rounded-lg border border-[#e0e0db] text-[12px] font-semibold text-[#353241] hover:bg-[#f5f5f7] disabled:opacity-50">
          Annuler
        </button>
        <button type="button" onClick={() => onConfirm?.(card.token)} disabled={disabled} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#592eff] text-white text-[12px] font-semibold hover:bg-[#4a22e0] disabled:opacity-50">
          <Rocket className="w-3.5 h-3.5" />
          Confirmer le lancement
        </button>
      </div>
    )}
  </div>
);

export const LaunchResultCard: React.FC<{ card: Extract<AiCard, { type: "launch_result" }> }> = ({ card }) => (
  <div className={`${cardShell} px-4 py-3 flex items-center gap-3`}>
    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${card.prospectsEnrolled > 0 ? "bg-[#dfff9d]" : "bg-[#ffaae6]"}`}>
      {card.prospectsEnrolled > 0 ? <Rocket className="w-4 h-4 text-[#21164c]" /> : <AlertTriangle className="w-4 h-4 text-[#21164c]" />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-bold text-[#21164c] truncate">Campagne « {card.name} » lancée</p>
      <p className="text-[11px] text-[#5f5f69]">{card.prospectsEnrolled} prospect(s) enrôlé(s)</p>
    </div>
  </div>
);

export const AccountStatusCard: React.FC<{ card: Extract<AiCard, { type: "account_status" }> }> = ({ card }) => (
  <div className={cardShell}>
    <div className={cardHeader}>
      <ShieldCheck className={`w-4 h-4 ${card.connected ? "text-[#592eff]" : "text-red-500"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-[#21164c] truncate">{card.connected ? `LinkedIn connecté${card.accountName ? ` · ${card.accountName}` : ""}` : "LinkedIn non connecté"}</p>
        <p className="text-[11px] text-[#5f5f69]">
          Offre {card.plan}
          {card.accountType ? ` · compte ${card.accountType}` : ""}
          {card.warmup?.active ? ` · montée en charge ${card.warmup.dayIndex + 1}/${card.warmup.totalDays}` : ""}
        </p>
      </div>
    </div>
    {card.quotas.length > 0 && (
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        {card.quotas.map((q) => (
          <div key={q.kind} className="rounded-2xl bg-[#fafafd] border border-[#e0e0db]/70 p-3">
            <p className="text-[11px] font-semibold text-[#5f5f69]">{q.label}</p>
            <p className="text-[15px] font-bold text-[#21164c] tabular-nums">
              {q.usedToday}
              <span className="text-[11px] font-semibold text-[#5f5f69]"> / {q.target} auj.</span>
            </p>
            <p className="text-[10px] text-[#5f5f69] tabular-nums">
              sem. {q.usedWeek}/{q.limitWeek} · mois {q.usedMonth}/{q.limitMonth}
            </p>
          </div>
        ))}
      </div>
    )}
  </div>
);
