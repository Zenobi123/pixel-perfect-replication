import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Kompta" },
      {
        name: "description",
        content: "Mentions légales et informations éditeur de Kompta, SaaS comptable OHADA.",
      },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  return (
    <SiteLayout>
      <article className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Mentions légales</h1>
        <div className="prose prose-slate mt-8 space-y-6 text-sm leading-relaxed text-foreground/80">
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Éditeur</h2>
            <p>Kompta — SaaS de comptabilité OHADA. Yaoundé, Cameroun.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Hébergement</h2>
            <p>
              Plateforme hébergée sur infrastructure cloud sécurisée. Données chiffrées au repos et
              en transit.
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Données personnelles</h2>
            <p>
              Conformément à la loi camerounaise sur la cybersécurité et la protection des données,
              vous disposez d'un droit d'accès, de rectification et de suppression de vos données.
              Contact :{" "}
              <a href="mailto:privacy@kompta.cm" className="text-accent hover:underline">
                privacy@kompta.cm
              </a>
              .
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Conformité comptable</h2>
            <p>
              Kompta est conçu pour respecter l'Acte uniforme OHADA relatif au droit comptable et à
              l'information financière (SYSCOHADA révisé). Les règles fiscales camerounaises sont
              paramétrables et mises à jour selon la loi de finances en vigueur.
            </p>
          </section>
          <section>
            <h2 className="font-display text-lg font-semibold text-ink">
              Propriété intellectuelle
            </h2>
            <p>
              L'ensemble du site et du logiciel est protégé par le droit d'auteur. Toute
              reproduction sans autorisation est interdite.
            </p>
          </section>
        </div>
      </article>
    </SiteLayout>
  );
}
