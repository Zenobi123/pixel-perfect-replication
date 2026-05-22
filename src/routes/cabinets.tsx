import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, FolderKanban, Workflow, BarChart3, ShieldCheck, ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/cabinets")({
  head: () => ({
    meta: [
      { title: "Cabinets comptables — Kompta multi-dossiers OHADA" },
      {
        name: "description",
        content:
          "Kompta pour cabinets : portail dédié, dossiers illimités, vue consolidée, workflow de révision. Pensé pour les expert-comptables au Cameroun.",
      },
      { property: "og:title", content: "Kompta pour cabinets comptables" },
      { property: "og:description", content: "Gérez tous vos dossiers clients OHADA depuis un seul espace." },
    ],
  }),
  component: CabinetsPage,
});

const benefits = [
  { icon: FolderKanban, t: "Dossiers illimités", d: "Ajoutez autant de clients que nécessaire, sans coût additionnel par dossier." },
  { icon: Workflow, t: "Workflow de révision", d: "Statuts dédiés : à saisir, à réviser, validé. Affectez les dossiers à vos collaborateurs." },
  { icon: BarChart3, t: "Vue consolidée", d: "Suivez en un coup d'œil les échéances, soldes et alertes de tous vos clients." },
  { icon: ShieldCheck, t: "Conformité & traçabilité", d: "Audit trail complet par dossier, exports normalisés, sauvegardes chiffrées." },
];

const checklist = [
  "Délégation fine par collaborateur et par dossier",
  "Import depuis Excel, Sage, Ciel — accompagnement inclus",
  "Préparation DSF coordonnée sur tous vos dossiers",
  "Support prioritaire en français",
];

function CabinetsPage() {
  return (
    <SiteLayout>
      <section className="bg-hero text-primary-foreground">
        <div className="absolute inset-0 bg-mesh opacity-70" />
        <div className="relative mx-auto max-w-7xl px-6 py-24">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">Cabinets comptables</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl text-balance">
            Tous vos dossiers clients dans un seul espace, sans compromis sur la conformité.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/70">
            Kompta vous donne un portail cabinet dédié pour piloter votre activité d'expertise-comptable
            au Cameroun, avec la rigueur du SYSCOHADA et la fluidité d'un outil moderne.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/contact" className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-primary shadow-glow">
              Demander une démo <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/tarifs" className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Voir l'offre Cabinet
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          {benefits.map((b) => (
            <div key={b.t} className="rounded-2xl border border-border bg-card p-7 shadow-card">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent">
                <b.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">{b.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-10 rounded-3xl bg-surface-elevated p-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-balance">
              Conçu avec des cabinets camerounais
            </h2>
            <p className="mt-4 text-muted-foreground">
              Onboarding accompagné, migration de vos dossiers existants et formation de votre équipe :
              vous êtes opérationnel en quelques jours.
            </p>
          </div>
          <ul className="space-y-3">
            {checklist.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </SiteLayout>
  );
}
