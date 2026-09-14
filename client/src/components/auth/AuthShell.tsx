import React from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import clsx from "clsx";
import { Logo } from "../../marketing/ui/Logo";

/**
 * Coquille commune des pages d'authentification (connexion, inscription,
 * invitation, mot de passe, première installation). Même langage que le site
 * vitrine : fond clair, hairlines, un seul CTA violet, pas de décor.
 */
export const AuthShell: React.FC<{
  title: string;
  lead?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md";
}> = ({ title, lead, children, footer, width = "sm" }) => (
  <div className="site flex min-h-screen flex-col">
    <header className="border-b border-[#e0e0db]">
      <div className="mx-auto flex h-16 w-full max-w-site items-center justify-between px-5 sm:px-8">
        <Logo />
        <Link to="/" className="text-[14px] font-medium text-[#5f5f69] hover:text-[#21164c]">
          Retour au site
        </Link>
      </div>
    </header>

    <main className="flex flex-1 items-start justify-center px-5 py-12 sm:px-8 sm:py-20">
      <div className={clsx("w-full", width === "sm" ? "max-w-[420px]" : "max-w-[560px]")}>
        <h1 className="display text-[30px] leading-[1.1] sm:text-[36px]">{title}</h1>
        {lead && <p className="mt-3 text-[15px] leading-[1.6] text-[#5f5f69]">{lead}</p>}
        <div className="mt-8 rounded-card border border-[#e0e0db] bg-white p-6 sm:p-8">{children}</div>
        {footer && <div className="mt-6 text-[14px] text-[#5f5f69]">{footer}</div>}
      </div>
    </main>
  </div>
);

export const authInputClass =
  "h-11 w-full rounded-lg border border-[#d6d6d0] bg-white px-3.5 text-[15px] text-[#21164c] placeholder:text-[#9a9aa3] focus:border-[#21164c] focus:outline-none focus:ring-2 focus:ring-[#592eff]/20 disabled:bg-[#f5f5f7] read-only:bg-[#f5f5f7] read-only:text-[#5f5f69]";

export const AuthField: React.FC<{
  label: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, hint, action, children }) => (
  <div>
    <div className="mb-1.5 flex items-baseline justify-between">
      <label className="text-[14px] font-medium text-[#21164c]">{label}</label>
      {action}
    </div>
    {children}
    {hint && <p className="mt-1.5 text-[13px] text-[#5f5f69]">{hint}</p>}
  </div>
);

export const PasswordInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  minLength?: number;
}> = ({ value, onChange, placeholder, autoComplete = "current-password", autoFocus, minLength }) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={clsx(authInputClass, "pr-11")}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5f69] hover:text-[#21164c]"
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {show ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
      </button>
    </div>
  );
};

export const AuthError: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="alert" className="rounded-lg border border-[#e6b8b8] bg-[#fdf4f4] px-3.5 py-3 text-[14px] text-[#8a2a2a]">
    {children}
  </div>
);

export const AuthSubmit: React.FC<{
  loading?: boolean;
  disabled?: boolean;
  loadingLabel?: string;
  children: React.ReactNode;
}> = ({ loading, disabled, loadingLabel, children }) => (
  <button
    type="submit"
    disabled={loading || disabled}
    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#592eff] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#4a22e0] disabled:cursor-not-allowed disabled:opacity-60"
  >
    {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
    {loading && loadingLabel ? loadingLabel : children}
  </button>
);

export const AuthSecondary: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-[#d6d6d0] bg-white px-5 text-[15px] font-semibold text-[#21164c] transition-colors hover:border-[#21164c]"
  >
    {children}
  </Link>
);
