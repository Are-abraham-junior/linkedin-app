import React from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { Container } from "./Container";
import { FEATURES } from "../content/features";

const columns = [
  {
    title: "Produit",
    links: [
      { to: "/fonctionnalites", label: "Fonctionnalités" },
      { to: "/fait-pour", label: "Fait pour" },
      { to: "/tarifs", label: "Tarifs" },
      { to: "/connexion", label: "Se connecter" },
    ],
  },
  {
    title: "Fonctionnalités",
    links: FEATURES.map((f) => ({ to: `/fonctionnalites#${f.id}`, label: f.short })),
  },
  {
    title: "Contact",
    links: [
      { href: "mailto:contact@bleadin.com", label: "contact@bleadin.com" },
      { href: "mailto:billing@bleadin.com", label: "Facturation" },
    ],
  },
];

export const Footer: React.FC = () => (
  <footer className="border-t border-[#e0e0db]">
    <Container className="grid gap-12 py-16 md:grid-cols-12">
      <div className="md:col-span-5">
        <Logo />
        <p className="mt-5 max-w-[34ch] text-[15px] leading-[1.6] text-[#5f5f69]">
          Prospection LinkedIn automatisée, à vos horaires et dans vos limites.
        </p>
      </div>
      {columns.map((col) => (
        <div key={col.title} className="md:col-span-2">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#21164c]">{col.title}</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {col.links.map((l) =>
              "to" in l ? (
                <li key={l.label}>
                  <Link to={l.to} className="text-[15px] text-[#5f5f69] hover:text-[#21164c]">
                    {l.label}
                  </Link>
                </li>
              ) : (
                <li key={l.label}>
                  <a href={l.href} className="text-[15px] text-[#5f5f69] hover:text-[#21164c]">
                    {l.label}
                  </a>
                </li>
              )
            )}
          </ul>
        </div>
      ))}
    </Container>
    <Container className="flex flex-col gap-2 border-t border-[#e0e0db] py-6 text-[13px] text-[#5f5f69] sm:flex-row sm:items-center sm:justify-between">
      <p>© {new Date().getFullYear()} Bleadin. Tous droits réservés.</p>
      <p>Bleadin n'est pas affilié à LinkedIn Corporation.</p>
    </Container>
  </footer>
);
