import React, { useState } from "react";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { SectionHeading } from "../ui/SectionHeading";
import { BillingToggle, type BillingCycle } from "../ui/BillingToggle";
import { PricingCards } from "../ui/PricingCards";
import { ComparisonTable } from "../ui/ComparisonTable";
import { FaqList } from "../ui/FaqList";
import { PRICING_FAQ } from "../content/plans";
import { useDocumentTitle } from "../useDocumentTitle";

export const PricingPage: React.FC = () => {
  useDocumentTitle(
    "Tarifs — Bleadin",
    "Starter 19 $, Pro 40 $, Business 70 $ par mois. 20 % de remise en annuel. Comparez les offres Bleadin."
  );
  const [cycle, setCycle] = useState<BillingCycle>("annual");

  return (
    <>
      <Container as="section" className="pb-12 pt-16 sm:pt-24">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            as="h1"
            size="lg"
            eyebrow="Tarifs"
            title="Un prix par taille d'équipe."
            lead="Toutes les offres incluent les séquences, l'inbox, les imports et la protection du compte. Ce qui change : les volumes, les sièges et les outils d'équipe."
          />
          <BillingToggle value={cycle} onChange={setCycle} />
        </div>
      </Container>

      <Container as="section" className="pb-20 lg:pb-28">
        <PricingCards cycle={cycle} />
        <p className="mt-6 text-[14px] text-[#5f5f69]">
          Prix hors taxes, en dollars américains. Un compte LinkedIn standard suffit ; Premium, Sales Navigator et Recruiter sont pris en charge.
        </p>
      </Container>

      <section className="bg-[var(--site-surface)] py-20 lg:py-28">
        <Container>
          <SectionHeading eyebrow="Comparatif" title="Le détail de chaque offre." />
          <div className="mt-12">
            <ComparisonTable />
          </div>
        </Container>
      </section>

      <Container as="section" className="grid gap-10 py-20 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow="Questions" title="Avant de choisir." />
        </div>
        <div className="lg:col-span-8">
          <FaqList items={PRICING_FAQ} />
        </div>
      </Container>

      <section className="bg-[var(--site-ink-dark)] py-20 text-white lg:py-28">
        <Container className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="display !text-white max-w-[22ch] text-[32px] leading-[1.05] sm:text-[44px]">
            Commencez avec Starter, changez d'offre quand le volume suit.
          </h2>
          <Button to="/connexion" variant="inverse" size="lg">
            Commencer
          </Button>
        </Container>
      </section>
    </>
  );
};
