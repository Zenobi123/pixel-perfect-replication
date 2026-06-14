import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-elevated">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-grad">
                <span className="font-display text-base font-bold text-primary">K</span>
              </span>
              <span className="font-display text-lg font-semibold tracking-tight text-ink">
                Kompta<span className="text-accent">.</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              La comptabilité OHADA pensée pour les entreprises camerounaises. Multi-sociétés,
              fiscalité paramétrable, DSF, le tout dans un seul espace.
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              Conforme SYSCOHADA révisé · Acte uniforme OHADA · Fiscalité DGI Cameroun
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-ink">Produit</h4>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <Link to="/fonctionnalites" className="hover:text-accent">
                  Fonctionnalités
                </Link>
              </li>
              <li>
                <Link to="/tarifs" className="hover:text-accent">
                  Tarifs
                </Link>
              </li>
              <li>
                <Link to="/cabinets" className="hover:text-accent">
                  Pour les cabinets
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-ink">Société</h4>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <Link to="/contact" className="hover:text-accent">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/legal" className="hover:text-accent">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 md:flex-row md:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Kompta. Tous droits réservés · Yaoundé, Cameroun
          </p>
          <p className="text-xs text-muted-foreground">XAF · Français · OHADA</p>
        </div>
      </div>
    </footer>
  );
}
