import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { SectionHeading } from "../ui/SectionHeading";
import { ProductFrame } from "../ui/ProductFrame";
import { PricingCards } from "../ui/PricingCards";
import { FaqList } from "../ui/FaqList";
import { CampaignSequenceMock } from "../mockups/CampaignSequenceMock";
import { ImportMock } from "../mockups/ImportMock";
import { QueueMock } from "../mockups/QueueMock";
import { InboxMock } from "../mockups/InboxMock";
import { AUDIENCES } from "../content/audiences";
import { HOME_FAQ } from "../content/features";
import { useDocumentTitle } from "../useDocumentTitle";

const STEPS = [
  {
    n: "01",
    title: "Importez vos prospects",
    text: "Un fichier CSV ou XLSX avec les URL LinkedIn suffit. Bleadin écarte les doublons, range les profils dans une liste et garde l'historique de chaque import.",
    link: { to: "/fonctionnalites#prospects", label: "Prospects et imports" },
    visual: <ImportMock />,
    wash: "sky" as const,
  },
  {
    n: "02",
    title: "Composez la séquence",
    text: "Visite, invitation, message, suivi : vous choisissez l'ordre et les délais. Chaque action est planifiée dans vos horaires, dans vos quotas, et attend l'acceptation avant de poursuivre.",
    link: { to: "/fonctionnalites#campagnes", label: "Campagnes" },
    visual: <QueueMock />,
    wash: "lime" as const,
  },
  {
    n: "03",
    title: "Répondez à ceux qui répondent",
    text: "Dès qu'un prospect répond, sa séquence s'arrête et la conversation arrive dans l'inbox avec la campagne d'origine. Vous reprenez la main, sans changer d'outil.",
    link: { to: "/fonctionnalites#inbox", label: "Inbox" },
    visual: <InboxMock />,
    wash: "candy" as const,
  },
];

const SAFETY = [
  ["Quotas journaliers", "30 invitations et 70 messages par jour par défaut, ajustables par utilisateur. Comptés en temps réel, pas estimés."],
  ["Horaires et jours de travail", "Rien ne part le week-end ni la nuit. Le fuseau horaire est celui de chaque membre de l'équipe."],
  ["Pause automatique", "Vérification LinkedIn ou session expirée : toutes les campagnes s'arrêtent, l'action est reprogrammée deux heures plus tard."],
  ["Limitation temporaire", "Si LinkedIn ralentit, l'action est décalée de quinze minutes au lieu d'insister."],
  ["Un échec n'en entraîne pas un autre", "Un profil introuvable marque cette action en échec et la file continue. Une anomalie de compte interrompt la file entière."],
  ["Arrêt à la réponse", "Un prospect qui répond sort de la séquence. Aucun message automatique ne lui est envoyé ensuite."],
];

export const HomePage: React.FC = () => {
  useDocumentTitle(
    "Bleadin — Prospection LinkedIn automatisée, à vos horaires",
    "Séquences d'invitations et de messages LinkedIn, inbox unifiée, quotas et horaires respectés. Bleadin prospecte pour vous sans mettre votre compte en danger."
  );

  return (
    <>
      {/* Hero */}
      <Container as="section" className="pb-16 pt-16 sm:pt-24 lg:pb-20 lg:pt-28">
        <div className="max-w-[820px]">
          <h1 className="display site-rise text-[40px] leading-[1.02] sm:text-[56px] lg:text-[68px]" style={{ "--rise-index": 0 } as React.CSSProperties}>
            La prospection LinkedIn qui tourne pendant que vous vendez.
          </h1>
          <p
            className="site-rise mt-6 max-w-[58ch] text-[18px] leading-[1.55] text-[#5f5f69] sm:text-[20px]"
            style={{ "--rise-index": 1 } as React.CSSProperties}
          >
            Bleadin envoie vos invitations et vos messages à vos heures, dans vos limites, et vous remet les réponses. Vous gardez le compte, le contrôle et les conversations.
          </p>
          <div className="site-rise mt-9 flex flex-wrap items-center gap-4" style={{ "--rise-index": 2 } as React.CSSProperties}>
            <Button to="/connexion" size="lg">
              Commencer
            </Button>
            <Button to="/fonctionnalites" variant="link" arrow className="text-[16px]">
              Voir les fonctionnalités
            </Button>
          </div>
        </div>

        <div className="site-rise mt-14 sm:mt-20" style={{ "--rise-index": 3 } as React.CSSProperties}>
          <ProductFrame wash="surface" inset>
            <CampaignSequenceMock />
          </ProductFrame>
        </div>
      </Container>

      {/* Trois étapes */}
      <Container as="section" className="py-20 lg:py-28">
        <SectionHeading
          eyebrow="Comment ça marche"
          title="Trois étapes, puis Bleadin s'occupe du reste."
        />
        <div className="mt-16 flex flex-col gap-20 lg:mt-24 lg:gap-28">
          {STEPS.map((step, i) => (
            <div key={step.n} className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
              <div className={clsx("min-w-0 lg:col-span-5", i % 2 === 1 && "lg:order-2 lg:col-start-8")}>
                <p className="display text-[15px] text-[#592eff]">{step.n}</p>
                <h3 className="display mt-3 text-[28px] leading-[1.1] sm:text-[34px]">{step.title}</h3>
                <p className="mt-4 max-w-prose text-[17px] leading-[1.6] text-[#5f5f69]">{step.text}</p>
                <Link
                  to={step.link.to}
                  className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-[#21164c] hover:text-[#592eff]"
                >
                  {step.link.label}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </Link>
              </div>
              <div className={clsx("min-w-0 lg:col-span-7", i % 2 === 1 && "lg:order-1 lg:col-start-1")}>
                <ProductFrame wash={step.wash}>{step.visual}</ProductFrame>
              </div>
            </div>
          ))}
        </div>
      </Container>

      {/* Sécurité du compte */}
      <section className="bg-[var(--site-surface)] py-20 lg:py-28">
        <Container className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading
              eyebrow="Sécurité du compte"
              title="Votre compte passe avant vos campagnes."
              lead="Bleadin se comporte comme une personne prudente le ferait, et s'arrête au premier signe d'anomalie."
            />
            <Button to="/fonctionnalites#securite" variant="link" arrow className="mt-8 text-[15px]">
              Comment nous protégeons le compte
            </Button>
          </div>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-8 lg:col-start-5">
            {SAFETY.map(([term, desc]) => (
              <div key={term}>
                <dt className="text-[16px] font-semibold text-[#21164c]">{term}</dt>
                <dd className="mt-1.5 text-[15px] leading-[1.6] text-[#5f5f69]">{desc}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Fait pour */}
      <Container as="section" className="py-20 lg:py-28">
        <SectionHeading eyebrow="Fait pour" title="Le même moteur, quatre façons de s'en servir." />
        <ul className="mt-12 divide-y divide-[#e0e0db] border-y border-[#e0e0db]">
          {AUDIENCES.map((a) => (
            <li key={a.id}>
              <Link
                to={`/fait-pour#${a.id}`}
                className="group grid items-baseline gap-2 py-6 sm:grid-cols-12 sm:gap-6"
              >
                <span className="display text-[22px] sm:col-span-4 sm:text-[24px]">{a.short}</span>
                <span className="text-[16px] leading-[1.55] text-[#5f5f69] sm:col-span-7">{a.pain}</span>
                <ArrowRight
                  className="hidden h-5 w-5 justify-self-end text-[#c7c7c0] transition-colors group-hover:text-[#592eff] sm:block"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </Container>

      {/* Tarifs */}
      <section className="bg-[var(--site-surface)] py-20 lg:py-28">
        <Container>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading eyebrow="Tarifs" title="Un prix par taille d'équipe. Rien de caché." />
            <Button to="/tarifs" variant="link" arrow className="text-[15px]">
              Comparer les offres
            </Button>
          </div>
          <div className="mt-12">
            <PricingCards cycle="monthly" compact />
          </div>
          <p className="mt-5 text-[14px] text-[#5f5f69]">Prix mensuels. 20 % de remise avec un engagement annuel.</p>
        </Container>
      </section>

      {/* FAQ */}
      <Container as="section" className="grid gap-10 py-20 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow="Questions fréquentes" title="Ce qu'on nous demande avant de commencer." />
        </div>
        <div className="lg:col-span-8">
          <FaqList items={HOME_FAQ} />
        </div>
      </Container>

      {/* CTA final */}
      <section className="bg-[var(--site-ink-dark)] py-20 text-white lg:py-28">
        <Container className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-8">
            <h2 className="display !text-white text-[34px] leading-[1.05] sm:text-[44px] lg:text-[52px]">
              Connectez votre compte. La première séquence part demain matin.
            </h2>
          </div>
          <div className="flex flex-wrap gap-4 lg:col-span-4 lg:justify-end">
            <Button to="/connexion" variant="inverse" size="lg">
              Commencer
            </Button>
            <Button to="/tarifs" variant="link" arrow className="!text-white/80 hover:!text-white">
              Voir les tarifs
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
};
