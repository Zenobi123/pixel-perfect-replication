import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useEntreprises } from "@/hooks/use-entreprises";
import { useAuth } from "@/hooks/use-auth";
import { useMouvements } from "@/hooks/use-mouvements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, Wallet, TrendingUp } from "lucide-react";
import { formatXAF } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Tableau de bord — Kompta" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { current } = useEntreprises();
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "";

  const trialEnd = current ? new Date(current.trial_ends_at) : null;
  const daysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000))
    : null;

  // Indicateurs calculés à partir des seules écritures validées (cahier v1.1,
  // module 15 — tableau de bord dirigeant). Les montants restent en numeric et
  // sont agrégés ici uniquement pour l'affichage.
  const { data: mouvements } = useMouvements(current?.id, {});

  const stats = useMemo(() => {
    const m = mouvements ?? [];
    let tresorerie = 0; // classe 5 : solde débiteur
    let creances = 0; // comptes 41x : solde débiteur (créances clients)
    let produits = 0; // classe 7
    let charges = 0; // classe 6
    const ecritureIds = new Set<string>();
    for (const l of m) {
      ecritureIds.add(l.ecriture.id);
      if (l.compte.classe === 5) tresorerie += l.debit - l.credit;
      if (l.compte.numero.startsWith("41")) creances += l.debit - l.credit;
      if (l.compte.classe === 7) produits += l.credit - l.debit;
      if (l.compte.classe === 6) charges += l.debit - l.credit;
    }
    const resultat = produits - charges;
    return [
      {
        label: "Chiffre d'affaires",
        value: formatXAF(produits),
        icon: TrendingUp,
        hint: produits ? "Produits (classe 7) validés" : "Aucun produit comptabilisé",
      },
      {
        label: "Trésorerie",
        value: formatXAF(tresorerie),
        icon: Wallet,
        hint: "Soldes des comptes de classe 5",
      },
      {
        label: "Créances clients",
        value: formatXAF(Math.max(0, creances)),
        icon: FileText,
        hint: "Soldes débiteurs des comptes 41",
      },
      {
        label: "Résultat estimatif",
        value: formatXAF(resultat),
        icon: BookOpen,
        hint: `${ecritureIds.size} écriture${ecritureIds.size > 1 ? "s" : ""} validée${ecritureIds.size > 1 ? "s" : ""}`,
      },
    ];
  }, [mouvements]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bonjour {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {current ? (
              <>
                Dossier <strong>{current.raison_sociale}</strong>
              </>
            ) : (
              "Aucune entreprise sélectionnée"
            )}
          </p>
        </div>
        {current && (
          <Badge variant={current.subscription_status === "trial" ? "secondary" : "default"}>
            {current.subscription_status === "trial"
              ? `Essai — ${daysLeft} jour${daysLeft && daysLeft > 1 ? "s" : ""} restant${daysLeft && daysLeft > 1 ? "s" : ""}`
              : current.subscription_status}
          </Badge>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Restitutions comptables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Consultez et exportez vos états sur les écritures validées :</p>
          <div className="flex flex-wrap gap-2">
            <Link
              to={"/app/comptabilite/journal" as never}
              className="rounded-md border px-3 py-1.5 text-foreground hover:bg-accent"
            >
              Journal général
            </Link>
            <Link
              to={"/app/comptabilite/grand-livre" as never}
              className="rounded-md border px-3 py-1.5 text-foreground hover:bg-accent"
            >
              Grand livre
            </Link>
            <Link
              to={"/app/comptabilite/balance" as never}
              className="rounded-md border px-3 py-1.5 text-foreground hover:bg-accent"
            >
              Balance générale
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
