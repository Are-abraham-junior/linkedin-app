import React from "react";
import { Plus } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

/** Accordéon natif `<details>` : accessible au clavier sans JavaScript. */
export const FaqList: React.FC<{ items: FaqItem[] }> = ({ items }) => (
  <div className="divide-y divide-[#e0e0db] border-y border-[#e0e0db]">
    {items.map((item) => (
      <details key={item.q} className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left text-[17px] font-medium text-[#21164c] [&::-webkit-details-marker]:hidden">
          <span>{item.q}</span>
          <Plus
            className="mt-1 h-5 w-5 shrink-0 text-[#5f5f69] transition-transform duration-300 group-open:rotate-45"
            strokeWidth={1.5}
            aria-hidden
          />
        </summary>
        <div className="site-faq-body">
          <div>
            <p className="max-w-prose pb-6 text-[16px] leading-[1.65] text-[#5f5f69]">{item.a}</p>
          </div>
        </div>
      </details>
    ))}
  </div>
);
