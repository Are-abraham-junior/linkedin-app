import React, { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Nav } from "./ui/Nav";
import { Footer } from "./ui/Footer";

/** Coquille du site vitrine : navigation, contenu, pied de page. */
export const MarketingLayout: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ block: "start" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="site flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
