import React from "react";

const MEMBERS = [
  { name: "Élise Moreau", role: "Propriétaire", account: "Connecté", quota: "30 / 70", hours: "9 h – 18 h · Paris" },
  { name: "Karim Haddad", role: "Administrateur", account: "Connecté", quota: "25 / 60", hours: "8 h – 17 h · Paris" },
  { name: "Léa Nguyen", role: "Membre", account: "Connecté", quota: "20 / 50", hours: "9 h – 17 h · Montréal" },
  { name: "Marc Dubois", role: "Membre", account: "À connecter", quota: "—", hours: "—" },
];

/** Vue équipe : un compte LinkedIn, des quotas et des horaires par personne. */
export const TeamMock: React.FC = () => (
  <div className="font-sans text-[#353241]">
    <div className="flex items-center justify-between border-b border-[#e0e0db] px-5 py-4 sm:px-6">
      <div>
        <p className="text-[14px] font-medium text-[#21164c]">Agence Nord — Espace de travail</p>
        <p className="text-[13px] text-[#5f5f69]">4 membres · 3 comptes LinkedIn connectés</p>
      </div>
      <span className="rounded-lg border border-[#d6d6d0] px-3 py-1.5 text-[13px] font-medium text-[#21164c]">Inviter</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead>
          <tr className="text-left text-[12px] uppercase tracking-[0.08em] text-[#5f5f69]">
            <th className="px-5 py-2.5 font-medium sm:px-6">Membre</th>
            <th className="px-3 py-2.5 font-medium">Rôle</th>
            <th className="px-3 py-2.5 font-medium">LinkedIn</th>
            <th className="px-3 py-2.5 font-medium">Quotas inv. / msg</th>
            <th className="px-5 py-2.5 font-medium sm:px-6">Horaires</th>
          </tr>
        </thead>
        <tbody>
          {MEMBERS.map((m) => (
            <tr key={m.name} className="border-t border-[#f0f0ec]">
              <td className="px-5 py-2.5 font-medium text-[#21164c] sm:px-6">{m.name}</td>
              <td className="px-3 py-2.5">{m.role}</td>
              <td className="px-3 py-2.5">{m.account}</td>
              <td className="px-3 py-2.5 tabular-nums">{m.quota}</td>
              <td className="px-5 py-2.5 sm:px-6">{m.hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
