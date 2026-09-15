import React from "react";
import clsx from "clsx";

const ROWS = [
  { name: "Claire Fontaine", company: "Nexa Finance", url: "linkedin.com/in/clairefontaine", dup: false },
  { name: "Mehdi Belkacem", company: "Groupe Ardent", url: "linkedin.com/in/mbelkacem", dup: false },
  { name: "Anna Kowalski", company: "Orsay Capital", url: "linkedin.com/in/annakowalski", dup: true },
  { name: "Julien Rey", company: "Halden", url: "linkedin.com/in/julien-rey", dup: false },
  { name: "Sofia Marchetti", company: "Vireo", url: "linkedin.com/in/sofiamarchetti", dup: false },
];

/** Aperçu d'import CSV : colonnes reconnues, doublons écartés. */
export const ImportMock: React.FC = () => (
  <div className="font-sans text-[#353241]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e0db] px-5 py-4 sm:px-6">
      <div>
        <p className="text-[14px] font-medium text-[#21164c]">dirigeants-idf.xlsx</p>
        <p className="text-[13px] text-[#5f5f69]">212 lignes · 209 nouveaux prospects · 3 doublons ignorés</p>
      </div>
      <span className="text-[13px] text-[#5f5f69]">Liste : Directeurs financiers</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead>
          <tr className="text-left text-[12px] uppercase tracking-[0.08em] text-[#5f5f69]">
            <th className="px-5 py-2.5 font-medium sm:px-6">Nom</th>
            <th className="px-3 py-2.5 font-medium">Entreprise</th>
            <th className="px-3 py-2.5 font-medium">URL LinkedIn</th>
            <th className="px-5 py-2.5 text-right font-medium sm:px-6">État</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.url} className={clsx("border-t border-[#f0f0ec]", r.dup && "text-[#9a9aa3]")}>
              <td className={clsx("px-5 py-2.5 sm:px-6", !r.dup && "font-medium text-[#21164c]")}>{r.name}</td>
              <td className="px-3 py-2.5">{r.company}</td>
              <td className="px-3 py-2.5 font-mono text-[12px]">{r.url}</td>
              <td className="px-5 py-2.5 text-right sm:px-6">{r.dup ? "Doublon" : "Nouveau"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
