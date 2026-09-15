import React from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";

interface LogoProps {
  inverse?: boolean;
  className?: string;
}

export const LogoMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="#ffffff"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={clsx("h-7 w-7", className)}
    aria-hidden
  >
    <rect width="24" height="24" rx="6" fill="#592eff" stroke="none" />
    <path d="M12 2a10 10 0 1 0 10 10" />
    <path d="M12 6a6 6 0 1 0 6 6" />
    <path d="M12 10a2 2 0 1 0 2 2" />
  </svg>
);

export const Logo: React.FC<LogoProps> = ({ inverse, className }) => (
  <Link to="/" className={clsx("inline-flex items-center gap-2.5", className)} aria-label="Bleadin, accueil">
    <LogoMark />
    <span className={clsx("display text-[19px] font-semibold", inverse ? "!text-white" : "text-[#21164c]")}>
      Bleadin
    </span>
  </Link>
);
