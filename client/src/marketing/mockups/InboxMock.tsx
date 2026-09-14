import React from "react";
import clsx from "clsx";

const THREADS = [
  { name: "Claire Fontaine", preview: "Oui, un créneau jeudi me convient.", time: "10:42", active: true },
  { name: "Mehdi Belkacem", preview: "Merci pour l'invitation.", time: "09:15" },
  { name: "Anna Kowalski", preview: "Pouvez-vous m'en dire plus ?", time: "Hier" },
  { name: "Julien Rey", preview: "Je transmets à ma collègue.", time: "Hier" },
];

const MESSAGES = [
  { me: true, text: "Merci d'avoir accepté, Claire. Je travaille avec des directions financières sur le suivi de trésorerie. Un échange de 20 minutes cette semaine ?" },
  { me: false, text: "Bonjour, oui pourquoi pas. Jeudi en fin de matinée ?" },
  { me: true, text: "Jeudi 11 h, je vous envoie l'invitation." },
  { me: false, text: "Oui, un créneau jeudi me convient." },
];

/** Inbox : liste de conversations + fil, avec le contexte de campagne. */
export const InboxMock: React.FC = () => (
  <div className="grid font-sans text-[#353241] sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
    <ul className="hidden border-r border-[#e0e0db] sm:block">
      {THREADS.map((t) => (
        <li
          key={t.name}
          className={clsx("border-b border-[#f0f0ec] px-5 py-3.5 last:border-b-0", t.active && "bg-[#f5f5f7]")}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[14px] font-medium text-[#21164c]">{t.name}</p>
            <span className="shrink-0 text-[12px] text-[#5f5f69]">{t.time}</span>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-[#5f5f69]">{t.preview}</p>
        </li>
      ))}
    </ul>

    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-[#e0e0db] px-5 py-3.5">
        <div>
          <p className="text-[14px] font-medium text-[#21164c]">Claire Fontaine</p>
          <p className="text-[12px] text-[#5f5f69]">Directrice financière · Campagne « Directeurs financiers »</p>
        </div>
        <span className="text-[12px] text-[#5f5f69]">Séquence arrêtée</span>
      </div>
      <div className="flex flex-col gap-2.5 p-5">
        {MESSAGES.map((m, i) => (
          <p
            key={i}
            className={clsx(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.5]",
              m.me ? "self-end bg-[#21164c] text-white" : "self-start bg-[#f5f5f7] text-[#353241]"
            )}
          >
            {m.text}
          </p>
        ))}
      </div>
      <div className="mt-auto border-t border-[#e0e0db] p-4">
        <div className="flex h-10 items-center rounded-lg border border-[#e0e0db] px-3 text-[14px] text-[#5f5f69]">
          Répondre à Claire…
        </div>
      </div>
    </div>
  </div>
);
