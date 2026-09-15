import React from "react";
import clsx from "clsx";

interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  size?: "lg" | "md" | "sm";
  align?: "left" | "center";
  className?: string;
}

const sizes = {
  lg: "text-[40px] leading-[1.05] sm:text-[52px] lg:text-[60px]",
  md: "text-[30px] leading-[1.08] sm:text-[38px] lg:text-[44px]",
  sm: "text-[24px] leading-[1.15] sm:text-[28px] lg:text-[32px]",
};

/** Eyebrow en texte (petites capitales), jamais en pastille. */
export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  title,
  lead,
  as = "h2",
  size = "md",
  align = "left",
  className,
}) => {
  const Tag = as;
  return (
    <div className={clsx("max-w-[720px]", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#5f5f69]">
          {eyebrow}
        </p>
      )}
      <Tag className={clsx("display text-balance", sizes[size])}>{title}</Tag>
      {lead && (
        <p className="mt-5 max-w-prose text-[17px] leading-[1.6] text-[#5f5f69] sm:text-[18px]">
          {lead}
        </p>
      )}
    </div>
  );
};
