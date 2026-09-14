import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { SectionHeading } from "../ui/SectionHeading";
import { AUDIENCES } from "../content/audiences";
import { getPlan, CURRENCY_SYMBOL } from "../content/plans";
import { useDocumentTitle } from "../useDocumentTitle";

const WASHES = ["bg-[#bcf2ff]", "bg-[#dfff9d]", "bg-[#ffaae6]", "bg-[var(--site-surface-deep)]"];

export const AudiencesPage: React.FC = () => {
  useDocumentTitle(
    "Fait pour — Bleadin",
    "Commerciaux, fondateurs, agences, recruteurs : comment Bleadin s'adapte à chaque façon de prospecter sur LinkedIn."
  );

  return (
    <>
      <Container as="section" className="pb-12 pt-16 sm:pt-24">
        <SectionHeading
          as="h1"
          size="lg"
          eyebrow="Fait pour"
          title="Quatre métiers, quatre manières de prospecter."
          lead="Le moteur est le même. Ce qui change, c'est la séquence, le volume et la façon de traiter les réponses."
        />
        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
          {AUDIENCES.map((a) => (
            <li key={a.id}>
              <a href={`#${a.id}`} className="text-[15px] font-medium text-[#5f5f69] underline-offset-4 hover:text-[#21164c] hover:underline">
                {a.short}
              </a>
            </li>
          ))}
        </ul>
      </Container>

      <Container className="flex flex-col gap-20 pb-20 lg:gap-28 lg:pb-28">
        {AUDIENCES.map((a, i) => {
          const plan = getPlan(a.plan);
          const reversed = i % 2 === 1;
          return (
            <article key={a.id} id={a.id} className="grid scroll-mt-24 gap-10 lg:grid-cols-12 lg:gap-12">
              <div className={clsx("min-w-0 lg:col-span-6", reversed && "lg:order-2")}>
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#5f5f69]">{a.short}</p>
                <h2 className="display mt-4 text-[30px] leading-[1.08] sm:text-[38px]">{a.title}</h2>
                <p className="mt-6 max-w-prose text-[17px] leading-[1.6] text-[#353241]">{a.pain}</p>

                <p className="mt-10 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#5f5f69]">Ce que Bleadin change</p>
                <ol className="mt-4 flex flex-col gap-4">
                  {a.change.map((c, j) => (
                    <li key={c} className="grid grid-cols-[28px_1fr] gap-3">
                      <span className="display pt-0.5 text-[15px] text-[#592eff]">{j + 1}</span>
                      <p className="max-w-prose text-[16px] leading-[1.6] text-[#5f5f69]">{c}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className={clsx("min-w-0 lg:col-span-6", reversed && "lg:order-1")}>
                <div className={clsx("rounded-card p-4 sm:p-6", WASHES[i % WASHES.length])}>
                  <div className="overflow-hidden rounded-shot border border-[#e0e0db] bg-white">
                    <img
                      src={`/campagnes_images/${a.sequence.file}`}
                      alt={`Séquence recommandée : ${a.sequence.name}`}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover object-top"
                    />
                  </div>
                </div>
                <dl className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-[13px] text-[#5f5f69]">Séquence recommandée</dt>
                    <dd className="mt-1">
                      <Link
                        to="/fonctionnalites#campagnes"
                        className="inline-flex items-center gap-1.5 text-[16px] font-semibold text-[#21164c] hover:text-[#592eff]"
                      >
                        {a.sequence.name}
                        <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-[#5f5f69]">Offre conseillée</dt>
                    <dd className="mt-1">
                      <Link to="/tarifs" className="inline-flex items-center gap-1.5 text-[16px] font-semibold text-[#21164c] hover:text-[#592eff]">
                        {plan.name}, {plan.monthly} {CURRENCY_SYMBOL} / mois
                        <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </Link>
                    </dd>
                  </div>
                </dl>
              </div>
            </article>
          );
        })}
      </Container>

      <section className="bg-[var(--site-ink-dark)] py-20 text-white lg:py-28">
        <Container className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="display !text-white max-w-[20ch] text-[32px] leading-[1.05] sm:text-[44px]">
            Vous ne vous reconnaissez dans aucun de ces quatre ? Écrivez-nous.
          </h2>
          <div className="flex flex-wrap gap-4">
            <Button href="mailto:contact@bleadin.com" variant="inverse" size="lg">
              contact@bleadin.com
            </Button>
            <Button to="/connexion" variant="link" className="!text-white/80 hover:!text-white" arrow>
              Commencer
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
};
