import React from "react";
import clsx from "clsx";

const ROWS = [
  { time: "09:12", who: "Claire Fontaine", action: "Invitation", status: "Envoyée" },
  { time: "09:31", who: "Mehdi Belkacem", action: "Message", status: "Envoyé" },
  { time: "09:58", who: "Anna Kowalski", action: "Visite de profil", status: "Effectuée" },
  { time: "10:24", who: "Julien Rey", action: "Invitation", status: "Envoyée" },
  { time: "10:47", who: "Sofia Marchetti", action: "Message", status: "Planifié" },
  { time: "11:15", who: "Thomas Lemaire", action: "Invitation", status: "Planifié" },
];

const Quota: React.FC<{ label: string; used: number; max: number }> = ({ label, used, max }) => (
  <div>
    <div className="flex items-baseline justify-between">
      <p className="text-[13px] text-[#5f5f69]">{label}</p>
      <p className="text-[13px] tabular-nums text-[#21164c]">
        <span className="font-semibold">{used}</span> / {max}
      </p>
    </div>
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#eeeeee]">
      <div className="h-full rounded-full bg-[#21164c]" style={{ width: `${(used / max) * 100}%` }} />
    </div>
  </div>
);

/** File d'actions du jour avec les quotas — vue « ce qui part, et quand ». */
export const QueueMock: React.FC = () => (
  <div className="font-sans text-[#353241]">
    <div className="grid gap-5 border-b border-[#e0e0db] px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:px-6">
      <Quota label="Invitations aujourd'hui" used={12} max={30} />
      <Quota label="Messages aujourd'hui" used={27} max={70} />
      <div className="text-[13px] text-[#5f5f69] sm:text-right">
        <p>Lun.–ven. · 9 h – 18 h</p>
        <p>Europe/Paris</p>
      </div>
    </div>
    <ul>
      {ROWS.map((r) => {
        const planned = r.status === "Planifié";
        return (
          <li
            key={r.time}
            className="grid grid-cols-[52px_1fr_auto] items-center gap-3 border-b border-[#f0f0ec] px-5 py-3 text-[14px] last:border-b-0 sm:grid-cols-[56px_1fr_140px_100px] sm:px-6"
          >
            <span className="tabular-nums text-[#5f5f69]">{r.time}</span>
            <span className={clsx("truncate font-medium", planned ? "text-[#5f5f69]" : "text-[#21164c]")}>{r.who}</span>
            <span className="hidden text-[#5f5f69] sm:block">{r.action}</span>
            <span className={clsx("text-right text-[13px]", planned ? "text-[#5f5f69]" : "text-[#21164c]")}>
              {r.status}
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);
