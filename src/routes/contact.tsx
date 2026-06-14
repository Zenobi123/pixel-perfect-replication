import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Kompta, parlons de votre comptabilité OHADA" },
      {
        name: "description",
        content:
          "Contactez l'équipe Kompta pour une démo, une migration depuis Sage/Ciel/Excel ou une question sur la fiscalité camerounaise.",
      },
      { property: "og:title", content: "Contact Kompta" },
      {
        property: "og:description",
        content: "Démo, migration, questions : nous vous répondons en 24h ouvrées.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <SiteLayout>
      <section className="border-b border-border bg-surface-elevated">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">Contact</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl text-balance">
            Une question, une démo, une migration ? Écrivez-nous.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Nous répondons en moins de 24 heures ouvrées, en français, depuis Yaoundé.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.2fr_1fr]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="rounded-2xl border border-border bg-card p-8 shadow-card"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom complet" name="name" required />
            <Field label="Entreprise" name="company" />
            <Field label="Email" name="email" type="email" required />
            <Field label="Téléphone" name="phone" type="tel" />
          </div>
          <div className="mt-4">
            <label htmlFor="msg" className="text-sm font-medium">
              Message
            </label>
            <textarea
              id="msg"
              name="message"
              required
              rows={5}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Parlez-nous de votre activité, votre volumétrie d'écritures, vos besoins…"
            />
          </div>
          <button
            type="submit"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Envoyer <Send className="h-4 w-4" />
          </button>
          {sent && (
            <p className="mt-4 text-sm text-success">
              Merci, nous revenons vers vous très vite. (Maquette — la prochaine phase branchera
              l'envoi réel.)
            </p>
          )}
        </form>

        <aside className="space-y-6">
          <InfoCard icon={Mail} title="Email" content="hello@kompta.cm" />
          <InfoCard icon={Phone} title="Téléphone" content="+237 6 00 00 00 00" />
          <InfoCard icon={MapPin} title="Adresse" content="Bastos, Yaoundé — Cameroun" />
          <div className="rounded-2xl bg-surface-elevated p-6">
            <h3 className="font-display text-base font-semibold">
              Migration depuis votre outil actuel
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Excel, Sage, Ciel, Saari — nous reprenons votre plan comptable et vos balances pour
              vous faire démarrer sans rupture.
            </p>
          </div>
        </aside>
      </section>
    </SiteLayout>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  content,
}: {
  icon: typeof Mail;
  title: string;
  content: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="mt-0.5 text-sm font-medium">{content}</p>
      </div>
    </div>
  );
}
