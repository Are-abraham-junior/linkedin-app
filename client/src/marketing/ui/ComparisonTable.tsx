import React from "react";
import { Check, Minus } from "lucide-react";
import { COMPARISON, PLANS } from "../content/plans";

const Cell: React.FC<{ value: string | boolean }> = ({ value }) => {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-[#21164c]" strokeWidth={2} aria-label="Inclus" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-[#c7c7c0]" strokeWidth={1.5} aria-label="Non inclus" />;
  return <span className="text-[15px] text-[#353241]">{value}</span>;
};

export const ComparisonTable: React.FC = () => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[640px] border-collapse text-left">
      <thead>
        <tr className="border-b border-[#21164c]">
          <th scope="col" className="w-[40%] py-4 pr-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#5f5f69]">
            Comparatif
          </th>
          {PLANS.map((p) => (
            <th key={p.id} scope="col" className="display py-4 text-center text-[17px]">
              {p.name}
            </th>
          ))}
        </tr>
      </thead>
      {COMPARISON.map((group) => (
        <tbody key={group.title}>
          <tr>
            <th
              scope="rowgroup"
              colSpan={PLANS.length + 1}
              className="pb-2 pt-8 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#5f5f69]"
            >
              {group.title}
            </th>
          </tr>
          {group.rows.map((row) => (
            <tr key={row.label} className="border-t border-[#e0e0db]">
              <th scope="row" className="py-3.5 pr-4 text-[15px] font-normal text-[#353241]">
                {row.label}
              </th>
              {PLANS.map((p) => (
                <td key={p.id} className="py-3.5 text-center">
                  <Cell value={row.values[p.id]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  </div>
);
