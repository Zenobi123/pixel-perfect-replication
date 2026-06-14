import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/tarifs")({
  head: () => ({
    meta: [
      { title: "Tarifs — Kompta, abonnement mensuel & annuel en XAF" },
      {
        name: "description",
        content:
          "Choisissez votre offre Kompta : Essentiel, Standard, Professionnel ou Cabinet. Tarifs en FCFA, économisez 2 mois en annuel. Essai 14 jours.",
      },
      { property: "og:title", content: "Tarifs Kompta" },
      {
        property: "og:description",
        content: "Abonnements mensuels et annuels pour la comptabilité OHADA.",
      },
    ],
  }),
  component: PricingPage,
});

type Plan = {
  name: string;
  tagline: string;
  monthly: number;
  highlight?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    name: "Essentiel",
    tagline: "Pour démarrer en règle",
    monthly: 9_900,
    features: [
      "1 entreprise · 1 utilisateur",
      "Plan comptable OHADA",
      "Journaux & écritures",
      "Balance & grand livre",
      "Facturation limitée",
      "Pièces jointes",
    ],
  },
  {
    name: "Standard",
    tagline: "La comptabilité courante",
    monthly: 19_900,
    highlight: true,
    features: [
      "1 entreprise · 3 utilisateurs",
      "Tout Essentiel inclus",
      "Facturation & achats complets",
      "Trésorerie multi-comptes",
      "Fiscalité paramétrable",
      "DSF basique",
    ],
  },
  {
    name: "Professionnel",
    tagline: "Pour PME structurées",
    monthly: 39_900,
    features: [
      "1 entreprise · 10 utilisateurs",
      "Tout Standard inclus",
      "Immobilisations & stocks",
      "DSF complète",
      "Rapprochement bancaire avancé",
      "Support prioritaire",
    ],
  },
  {
    name: "Cabinet",
    tagline: "Pour expert-comptables",
    monthly: 59_900,
    features: [
      "Dossiers illimités",
      "Portail cabinet dédié",
      "Workflow de révision",
      "Vue consolidée multi-clients",
      "Délégation par dossier",
      "Support prioritaire",
    ],
  },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\u202f/g, " ");

function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <SiteLayout>
      <section className="border-b border-border bg-surface-elevated">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">Tarifs</p>
          <h1 className="mx-auto mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl text-balance">
            Des offres claires, en francs CFA, sans surprise.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            14 jours d'essai sans carte. Engagement mensuel ou annuel — vous économisez 2 mois en
            choisissant l'annuel.
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center rounded-full border border-border bg-card p-1 shadow-card">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                !annual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                annual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Annuel{" "}
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-primary">
                −17%
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => {
            const price = annual ? Math.round((p.monthly * 10) / 12) : p.monthly;
            return (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-2xl border p-7 shadow-card transition-all ${
                  p.highlight
                    ? "border-accent/40 bg-gradient-to-b from-accent/5 to-transparent shadow-elegant"
                    : "border-border bg-card hover:-translate-y-1 hover:shadow-elegant"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                    <Sparkles className="h-3 w-3" /> Le plus choisi
                  </span>
                )}
                <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>

                <div className="mt-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-semibold tracking-tight">
                      {fmt(price)}
                    </span>
                    <span className="text-sm text-muted-foreground">FCFA / mois</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {annual ? `Facturé ${fmt(price * 12)} FCFA / an` : "Sans engagement"}
                  </p>
                </div>

                <Link
                  to="/contact"
                  className={`mt-6 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
                    p.highlight
                      ? "bg-accent text-primary shadow-glow"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  Démarrer l'essai
                </Link>

                <ul className="mt-7 space-y-3 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <span className="text-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-12 max-w-2xl text-center text-sm text-muted-foreground">
          Besoin d'une offre Entreprise (groupe, API, SSO, hébergement dédié) ?
          <Link to="/contact" className="ml-1 font-medium text-accent hover:underline">
            Parlons-en.
          </Link>
        </p>
      </section>
    </SiteLayout>
  );
}
