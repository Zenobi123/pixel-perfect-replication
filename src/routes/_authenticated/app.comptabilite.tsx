import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/comptabilite")({
  component: ComptabiliteLayout,
});

const TABS = [
  { to: "/app/comptabilite/ecritures", label: "Écritures" },
  { to: "/app/comptabilite/journal", label: "Journal général" },
  { to: "/app/comptabilite/grand-livre", label: "Grand livre" },
  { to: "/app/comptabilite/balance", label: "Balance" },
  { to: "/app/comptabilite/balance-auxiliaire", label: "Balance auxiliaire" },
  { to: "/app/comptabilite/periodes", label: "Périodes" },
  { to: "/app/comptabilite/journaux", label: "Journaux" },
  { to: "/app/comptabilite/plan", label: "Plan comptable" },
];

function ComptabiliteLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b bg-card px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">Comptabilité</h1>
        <nav className="mt-3 flex gap-1">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to as never}
              className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-accent hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
}
