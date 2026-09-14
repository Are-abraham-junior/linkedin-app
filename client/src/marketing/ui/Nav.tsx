import React, { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";
import { Logo } from "./Logo";
import { Button } from "./Button";
import { Container } from "./Container";

const LINKS = [
  { to: "/fonctionnalites", label: "Fonctionnalités" },
  { to: "/fait-pour", label: "Fait pour" },
  { to: "/tarifs", label: "Tarifs" },
];

export const Nav: React.FC = () => {
  const { user, impersonatedOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const appPath = user?.role === "SUPER_ADMIN" && !impersonatedOrg ? "/admin" : "/dashboard";

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "text-[15px] font-medium transition-colors",
      isActive ? "text-[#21164c]" : "text-[#5f5f69] hover:text-[#21164c]"
    );

  return (
    <header className="sticky top-0 z-40 border-b border-[#e0e0db] bg-[var(--site-bg)]/95 backdrop-blur-sm">
      <Container as="nav" className="flex h-16 items-center justify-between">
        <Logo />

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Button to={appPath} size="sm">
              Ouvrir l'app
            </Button>
          ) : (
            <>
              <Button to="/connexion" variant="link" className="text-[15px] font-medium">
                Se connecter
              </Button>
              <Button to="/connexion" size="sm">
                Commencer
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#21164c] md:hidden"
          aria-expanded={open}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {open ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Menu className="h-5 w-5" strokeWidth={1.75} />}
        </button>
      </Container>

      {open && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 bg-[var(--site-bg)] md:hidden">
          <Container className="flex h-full flex-col justify-between py-8">
            <div className="flex flex-col">
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    clsx(
                      "display border-b border-[#e0e0db] py-5 text-[28px]",
                      isActive ? "" : "!text-[#353241]"
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {user ? (
                <Button to={appPath} size="lg">
                  Ouvrir l'app
                </Button>
              ) : (
                <>
                  <Button to="/connexion" size="lg">
                    Commencer
                  </Button>
                  <Button to="/connexion" variant="secondary" size="lg">
                    Se connecter
                  </Button>
                </>
              )}
            </div>
          </Container>
        </div>
      )}
    </header>
  );
};
