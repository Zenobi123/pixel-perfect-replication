import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const nav = [
  { to: "/fonctionnalites", label: "Fonctionnalités" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/cabinets", label: "Cabinets" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Kompta OHADA — accueil">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-grad shadow-glow">
            <span className="font-display text-base font-bold text-primary">K</span>
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            Kompta<span className="text-accent">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/contact"
            className="rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:text-accent"
          >
            Se connecter
          </Link>
          <Link
            to="/tarifs"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-card transition-all hover:opacity-90 hover:shadow-elegant"
          >
            Essai gratuit
          </Link>
        </div>

        <button
          type="button"
          aria-label="Menu"
          className="grid h-10 w-10 place-items-center rounded-md md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="space-y-1 px-6 py-4">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/tarifs"
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
            >
              Essai gratuit
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
