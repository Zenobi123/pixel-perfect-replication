import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import {
  BookOpenCheck, Layers, Banknote, FileSpreadsheet, ShieldCheck, Building2,
  Receipt, Wallet, Boxes, Calculator, Users, FileCheck2, History, Bell,
} from "lucide-react";

export const Route = createFileRoute("/fonctionnalites")({
  head: () => ({
    meta: [
      { title: "Fonctionnalités — Kompta, comptabilité OHADA SaaS" },
      {
        name: "description",
        content:
          "Plan comptable OHADA, journaux, fiscalité paramétrable, DSF, multi-entreprises, audit trail. Découvrez tous les modules de Kompta.",
      },
      { property: "og:title", content: "Fonctionnalités Kompta" },
      { property: "og:description", content: "20+ modules pour une comptabilité OHADA conforme et moderne." },
    ],
  }),
  component: FeaturesPage,
});

const groups = [
  {
    title: "Comptabilité OHADA",
    items: [
      { icon: BookOpenCheck, t: "Plan comptable SYSCOHADA", d: "Classes 1 à 9 pré-paramétrées, personnalisables." },
      { icon: Receipt, t: "Journaux & écritures", d: "Achats, ventes, banque, caisse, OD. Contrôle débit = crédit." },
      { icon: FileCheck2, t: "Balance & grand livre", d: "Export PDF/Excel, filtres par exercice et période." },
      { icon: History, t: "Audit trail", d: "Journal immuable de toutes les actions sensibles." },
    ],
  },
  {
    title: "Gestion commerciale",
    items: [
      { icon: Users, t: "Tiers clients & fournisseurs", d: "Comptes auxiliaires, encours, relances." },
      { icon: Receipt, t: "Facturation ventes", d: "Devis, factures, avoirs, numérotation légale." },
      { icon: Wallet, t: "Achats & dépenses", d: "Saisie facture fournisseur, ventilation analytique." },
      { icon: Boxes, t: "Stocks (option)", d: "Entrées/sorties, inventaire, CMUP / PEPS." },
    ],
  },
  {
    title: "Trésorerie & fiscalité",
    items: [
      { icon: Banknote, t: "Banques, caisses, Mobile Money", d: "Multi-comptes, rapprochement assisté." },
      { icon: Calculator, t: "Fiscalité camerounaise", d: "TVA, IS, IRPP : règles versionnées, jamais codées en dur." },
      { icon: FileSpreadsheet, t: "DSF & états financiers", d: "Bilan, compte de résultat, TAFIRE, contrôles de cohérence." },
      { icon: Bell, t: "Échéancier fiscal", d: "Rappels automatiques avant chaque échéance DGI." },
    ],
  },
  {
    title: "Plateforme SaaS",
    items: [
      { icon: Layers, t: "Multi-entreprises", d: "Gérez N dossiers depuis un même compte." },
      { icon: ShieldCheck, t: "Sécurité multi-tenant", d: "Isolation stricte par entreprise (RLS Postgres)." },
      { icon: Building2, t: "Portail cabinet", d: "Vue consolidée et workflow de révision dédié." },
      { icon: Users, t: "Rôles fins", d: "Admin, comptable, dirigeant, opérateur, auditeur." },
    ],
  },
];

function FeaturesPage() {
  return (
    <SiteLayout>
      <section className="border-b border-border bg-surface-elevated">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">Fonctionnalités</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl text-balance">
            Un produit pensé pour la conformité OHADA et le contexte camerounais.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Plus de 20 modules métier conçus avec des comptables, livrés progressivement. Voici les
            grands ensembles.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-20 px-6 py-20">
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="font-display text-2xl font-semibold tracking-tight">{g.title}</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {g.items.map((it) => (
                <div
                  key={it.t}
                  className="rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/5 text-primary">
                    <it.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold">{it.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{it.d}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </SiteLayout>
  );
}
