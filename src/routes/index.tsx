import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  BookOpenCheck,
  Layers,
  Banknote,
  FileSpreadsheet,
  Building2,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import heroImg from "@/assets/hero-dashboard.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kompta — Comptabilité OHADA pour PME et cabinets au Cameroun" },
      {
        name: "description",
        content:
          "Tenez votre comptabilité OHADA en ligne : plan SYSCOHADA, journaux, balance, fiscalité camerounaise paramétrable, DSF. Multi-entreprises. Essai 14 jours.",
      },
      { property: "og:title", content: "Kompta — Comptabilité OHADA en ligne" },
      {
        property: "og:description",
        content:
          "SaaS comptable OHADA pensé pour le Cameroun : multi-entreprises, fiscalité paramétrable, DSF, états SYSCOHADA.",
      },
    ],
  }),
  component: HomePage,
});

const stats = [
  { value: "9", label: "Classes du plan OHADA pré-paramétrées" },
  { value: "20+", label: "Modules métier conçus pour la conformité" },
  { value: "100%", label: "Fiscalité camerounaise paramétrable" },
];

const features = [
  {
    icon: BookOpenCheck,
    title: "Plan comptable OHADA prêt",
    desc: "SYSCOHADA révisé livré avec les 9 classes, comptes auxiliaires et personnalisation par entreprise.",
  },
  {
    icon: Layers,
    title: "Multi-entreprises natif",
    desc: "Gérez plusieurs dossiers depuis un même compte. Idéal pour cabinets et groupes.",
  },
  {
    icon: Banknote,
    title: "Trésorerie unifiée",
    desc: "Banques, caisses et Mobile Money réconciliés au même endroit, avec rapprochement assisté.",
  },
  {
    icon: FileSpreadsheet,
    title: "DSF & états SYSCOHADA",
    desc: "Préparez bilan, compte de résultat et DSF directement depuis vos écritures validées.",
  },
  {
    icon: ShieldCheck,
    title: "Sécurité multi-tenant",
    desc: "Isolation stricte des données par entreprise, audit trail immuable, sauvegardes chiffrées.",
  },
  {
    icon: Building2,
    title: "Pensé pour le Cameroun",
    desc: "TVA, IS, IRPP, droits d'accises : moteur fiscal versionné, mis à jour avec la loi de finances.",
  },
];

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

function HomePage() {
  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative overflow-hidden bg-hero text-primary-foreground">
        <div className="absolute inset-0 bg-mesh opacity-80" />
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-28">
          <motion.div initial="hidden" animate="show" variants={fade}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              SYSCOHADA · Cameroun · Multi-entreprises
            </span>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              La comptabilité OHADA,{" "}
              <span className="bg-gradient-to-r from-accent to-[oklch(0.78_0.13_180)] bg-clip-text text-transparent">
                enfin sans friction
              </span>
              .
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              Kompta réunit plan comptable OHADA, journaux, fiscalité camerounaise et DSF dans un
              espace unique. Multi-entreprises, conforme, prêt en quelques minutes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/tarifs"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-primary shadow-glow transition-transform hover:-translate-y-0.5"
              >
                Démarrer l'essai 14 jours <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/fonctionnalites"
                className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/10"
              >
                Voir les fonctionnalités
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/60">
              <li className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" /> Sans carte bancaire</li>
              <li className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" /> Données hébergées</li>
              <li className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" /> Support en français</li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-3xl bg-accent/10 blur-3xl" />
            <img
              src={heroImg}
              alt="Tableau de bord comptable Kompta"
              width={1600}
              height={1200}
              className="relative rounded-2xl border border-white/10 shadow-elegant"
            />
          </motion.div>
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-white/10 bg-black/20 backdrop-blur">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-display text-3xl font-semibold text-white">{s.value}</div>
                <div className="mt-1 text-sm text-white/60">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">Le produit</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Tout ce qu'il faut pour tenir une comptabilité conforme — rien de superflu.
          </h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-elegant"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/5 text-primary transition-colors group-hover:bg-accent/15 group-hover:text-accent">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-hero p-10 text-primary-foreground sm:p-14">
          <div className="absolute inset-0 bg-mesh opacity-70" />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl text-balance">
                Prêt à passer à une comptabilité moderne ?
              </h2>
              <p className="mt-4 max-w-xl text-white/70">
                14 jours d'essai sur l'offre Professionnel, sans engagement. Migration assistée
                depuis Excel, Sage ou Ciel sur demande.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link
                to="/tarifs"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-primary shadow-glow"
              >
                Voir les tarifs <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Demander une démo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
