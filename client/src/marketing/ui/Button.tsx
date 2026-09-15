import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "link" | "inverse";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  to?: string;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  className?: string;
  children: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#592eff] focus-visible:ring-offset-2";

const variants: Record<Variant, string> = {
  primary: "bg-[#592eff] text-white hover:bg-[#4a22e0] active:bg-[#3f1cc4]",
  secondary:
    "bg-white text-[#21164c] border border-[#d6d6d0] hover:border-[#21164c] active:bg-[#f5f5f7]",
  link: "text-[#21164c] hover:text-[#592eff] px-0 rounded-none",
  inverse: "bg-white text-[#21164c] hover:bg-[#f0eefb]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[14px]",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-[16px]",
};

export const Button: React.FC<ButtonProps> = ({
  to,
  href,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  arrow,
  className,
  children,
}) => {
  const cls = clsx(base, variants[variant], variant !== "link" && sizes[size], className);
  const content = (
    <>
      {children}
      {arrow && <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden />}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls}>
      {content}
    </button>
  );
};
