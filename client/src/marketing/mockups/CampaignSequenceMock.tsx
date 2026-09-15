import React from "react";
import { UserPlus, MessageSquare, Eye, Clock, Pause } from "lucide-react";
import clsx from "clsx";

interface Step {
  kind: "VISIT" | "INVITATION" | "MESSAGE" | "DELAY" | "WAIT";
  label: string;
  meta?: string;
  body?: string;
}

const STEPS: Step[] = [
  { kind: "VISIT", label: "Visite de profil", meta: "Jour 0" },
  { kind: "DELAY", label: "Attendre 2 jours" },
  {
    kind: "INVITATION",
    label: "Invitation",
    meta: "Jour 2",
    body: "Bonjour {{firstName}}, je suis ravi de voir votre parcours chez {{company}}. Au plaisir d'échanger.",
  },
  { kind: "WAIT", label: "Jusqu'à l'acceptation" },
  {
    kind: "MESSAGE",
    label: "Message",
    meta: "Acceptation + 1 jour",
    body: "Merci d'avoir accepté, {{firstName}}. Je travaille avec des équipes comme {{company}} sur…",
  },
];

const icons = {
  VISIT: Eye,
  INVITATION: UserPlus,
  MESSAGE: MessageSquare,
  DELAY: Clock,
  WAIT: Pause,
};

const Avatar: React.FC<{ tone: string }> = ({ tone }) => (
  <span className={clsx("h-6 w-6 rounded-full border-2 border-white", tone)} />
);

/** Reproduction statique de l'éditeur de séquence, dans le style de l'application. */
export const CampaignSequenceMock: React.FC = () => (
  <div className="font-sans text-[#353241]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e0db] px-5 py-4 sm:px-6">
      <div>
        <p className="text-[15px] font-semibold text-[#21164c]">Directeurs financiers — Île-de-France</p>
        <p className="mt-0.5 text-[13px] text-[#5f5f69]">148 prospects · 41 acceptations · 12 réponses</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-1.5">
          <Avatar tone="bg-[#bcf2ff]" />
          <Avatar tone="bg-[#dfff9d]" />
          <Avatar tone="bg-[#ffaae6]" />
        </div>
        <span className="rounded-md border border-[#21164c] px-2 py-0.5 text-[12px] font-semibold text-[#21164c]">
          Active
        </span>
      </div>
    </div>

    <div className="grid gap-0 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <ol className="border-b border-[#e0e0db] p-5 sm:p-6 md:border-b-0 md:border-r">
        {STEPS.map((step, i) => {
          const Icon = icons[step.kind];
          const isPassive = step.kind === "DELAY" || step.kind === "WAIT";
          return (
            <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
              {i < STEPS.length - 1 && (
                <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-[#e0e0db]" aria-hidden />
              )}
              <span
                className={clsx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                  isPassive ? "border-dashed border-[#c7c7c0] text-[#5f5f69]" : "border-[#e0e0db] bg-white text-[#21164c]",
                  i === 2 && "border-[#592eff] text-[#592eff]"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 pt-1">
                <p className={clsx("text-[14px] font-medium", isPassive ? "text-[#5f5f69]" : "text-[#21164c]")}>
                  {step.label}
                </p>
                {step.meta && <p className="text-[12px] text-[#5f5f69]">{step.meta}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="p-5 sm:p-6">
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5f5f69]">Étape 3 · Invitation</p>
        <div className="mt-3 rounded-xl border border-[#e0e0db] bg-[#fafaf9] p-4 text-[14px] leading-[1.6] text-[#353241]">
          {STEPS[2].body}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["{{firstName}}", "{{lastName}}", "{{company}}", "{{headline}}"].map((v) => (
            <span key={v} className="rounded-md border border-[#e0e0db] bg-white px-2 py-1 font-mono text-[12px] text-[#5f5f69]">
              {v}
            </span>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[#e0e0db] pt-5">
          {[
            ["Envoyées", "96"],
            ["Acceptées", "41"],
            ["Taux", "43 %"],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[12px] text-[#5f5f69]">{k}</p>
              <p className="display text-[22px] tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
