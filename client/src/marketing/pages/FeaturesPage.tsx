import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { SectionHeading } from "../ui/SectionHeading";
import { ProductFrame } from "../ui/ProductFrame";
import { FEATURES, SEQUENCE_TEMPLATES, type FeatureId } from "../content/features";
import { CampaignSequenceMock } from "../mockups/CampaignSequenceMock";
import { ImportMock } from "../mockups/ImportMock";
import { InboxMock } from "../mockups/InboxMock";
import { QueueMock } from "../mockups/QueueMock";
import { TeamMock } from "../mockups/TeamMock";
import { ReportsMock } from "../mockups/ReportsMock";
import { useDocumentTitle } from "../useDocumentTitle";

const VISUALS: Record<FeatureId, { node: React.ReactNode; wash: "sky" | "lime" | "candy" | "surface" }> = {
  campagnes: { node: <CampaignSequenceMock />, wash: "surface" },
  prospects: { node: <ImportMock />, wash: "sky" },
  inbox: { node: <InboxMock />, wash: "candy" },
  securite: { node: <QueueMock />, wash: "lime" },
  equipe: { node: <TeamMock />, wash: "surface" },
  rapports: { node: <ReportsMock />, wash: "sky" },
};

/** Sommaire collant qui suit la section visible. */
const useActiveSection = (ids: string[]) => {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
};

const IDS = FEATURES.map((f) => f.id);

export const FeaturesPage: React.FC = () => {
  useDocumentTitle(
    "Fonctionnalités — Bleadin",
    "Campagnes multi-étapes, imports sans doublons, inbox unifiée, quotas et horaires, équipe et rapports : tout ce que fait Bleadin pour votre prospection LinkedIn."
  );
  const active = useActiveSection(IDS);

  return (
    <>
      <Container as="section" className="pb-12 pt-16 sm:pt-24">
        <SectionHeading
          as="h1"
          size="lg"
          eyebrow="Fonctionnalités"
          title="Tout ce qu'il faut pour prospecter. Rien de plus."
          lead="Six domaines, un seul moteur : chaque action est planifiée, exécutée à vos horaires, et rapportée."
        />
      </Container>

      <Container className="grid gap-12 pb-20 lg:grid-cols-12 lg:pb-28">
        <aside className="hidden lg:col-span-3 lg:block">
          <nav aria-label="Sommaire" className="sticky top-24 flex flex-col gap-1">
            {FEATURES.map((f) => (
              <a
                key={f.id}
                href={`#${f.id}`}
                className={clsx(
                  "rounded-md px-3 py-2 text-[15px] transition-colors",
                  active === f.id ? "bg-white font-semibold text-[#21164c] shadow-[0_0_0_1px_#e0e0db]" : "text-[#5f5f69] hover:text-[#21164c]"
                )}
              >
                {f.short}
              </a>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-24 lg:col-span-9 lg:gap-32">
          {FEATURES.map((f, i) => {
            const v = VISUALS[f.id];
            return (
              <article key={f.id} id={f.id} className="scroll-mt-24">
                <p className="display text-[15px] text-[#592eff]">{String(i + 1).padStart(2, "0")}</p>
                <h2 className="display mt-3 max-w-[22ch] text-[30px] leading-[1.08] sm:text-[38px]">{f.title}</h2>
                <p className="mt-5 max-w-prose text-[18px] leading-[1.55] text-[#353241]">{f.lead}</p>

                <div className="mt-10 min-w-0">
                  <ProductFrame wash={v.wash}>{v.node}</ProductFrame>
                </div>

                <div className="mt-10 grid gap-8 md:grid-cols-12">
                  <div className="flex flex-col gap-4 md:col-span-7">
                    {f.paragraphs.map((p) => (
                      <p key={p} className="max-w-prose text-[16px] leading-[1.65] text-[#5f5f69]">
                        {p}
                      </p>
                    ))}
                  </div>
                  <ul className="flex flex-col divide-y divide-[#e0e0db] border-y border-[#e0e0db] md:col-span-5">
                    {f.points.map((pt) => (
                      <li key={pt} className="py-3 text-[15px] leading-[1.5] text-[#21164c]">
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </Container>

      {/* Modèles de séquences : images existantes, la seule grille régulière du site */}
      <section className="bg-[var(--site-surface)] py-20 lg:py-28">
        <Container>
          <SectionHeading
            eyebrow="Modèles"
            title="Six séquences prêtes à l'emploi."
            lead="Partez d'un modèle, ajustez les délais et les messages, lancez. Vous pouvez aussi composer la vôtre étape par étape."
          />
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SEQUENCE_TEMPLATES.map((t) => (
              <li key={t.file}>
                <div className="overflow-hidden rounded-shot border border-[#e0e0db] bg-white">
                  <img
                    src={`/campagnes_images/${t.file}`}
                    alt={`Modèle de séquence : ${t.name}`}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover object-top"
                  />
                </div>
                <p className="mt-4 text-[16px] font-semibold text-[#21164c]">{t.name}</p>
                <p className="mt-1 text-[14px] text-[#5f5f69]">{t.desc}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container as="section" className="flex flex-col gap-6 py-20 sm:flex-row sm:items-center sm:justify-between lg:py-28">
        <h2 className="display max-w-[24ch] text-[28px] leading-[1.1] sm:text-[34px]">
          Voyez comment ces fonctionnalités s'appliquent à votre métier.
        </h2>
        <div className="flex flex-wrap gap-4">
          <Button to="/fait-pour" variant="secondary" size="lg">
            Fait pour
          </Button>
          <Button to="/connexion" size="lg">
            Commencer
          </Button>
        </div>
      </Container>
    </>
  );
};
