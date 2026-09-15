import React from "react";
import clsx from "clsx";

type Wash = "none" | "sky" | "lime" | "candy" | "surface";

interface ProductFrameProps {
  children: React.ReactNode;
  wash?: Wash;
  className?: string;
  /** Padding autour du cadre lorsque posé sur un aplat. */
  inset?: boolean;
}

const washes: Record<Wash, string> = {
  none: "",
  sky: "bg-[#bcf2ff]",
  lime: "bg-[#dfff9d]",
  candy: "bg-[#ffaae6]",
  surface: "bg-[var(--site-surface-deep)]",
};

/**
 * Cadre produit : hairline, rayon 24 px, fond blanc. Optionnellement posé sur
 * un aplat pastel Adora (jamais un dégradé).
 */
export const ProductFrame: React.FC<ProductFrameProps> = ({ children, wash = "none", className, inset }) => {
  const frame = (
    <div
      className={clsx(
        "min-w-0 max-w-full overflow-hidden rounded-shot border border-[#e0e0db] bg-white shadow-[0_1px_2px_rgba(33,22,76,0.04)]",
        wash === "none" && className
      )}
    >
      {children}
    </div>
  );
  if (wash === "none") return frame;
  return (
    <div className={clsx("min-w-0 max-w-full rounded-card", washes[wash], inset ? "p-4 sm:p-8 lg:p-12" : "p-3 sm:p-5", className)}>
      {frame}
    </div>
  );
};
