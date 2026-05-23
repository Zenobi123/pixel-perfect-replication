import { createFileRoute } from "@tanstack/react-router";
import { useEntreprises } from "@/hooks/use-entreprises";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, Wallet, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Tableau de bord — Kompta" }] }),
  component: Dashboard,
});

const STATS = [
  { label: "Chiffre d'affaires", value: "0 XAF", icon: TrendingUp, hint: "Aucune écriture sur la période" },
  { label: "Trésorerie", value: "0 XAF", icon: Wallet, hint: "Banque + caisse" },
  { label: "Créances clients", value: "0 XAF", icon: FileText, hint: "Aucune facture émise" },
  { label: "Écritures saisies", value: "0", icon: BookOpen, hint: "Exercice en cours" },
];

function Dashboard() {
  const { user } = useAuth();
  const { current } = useEntreprises();
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "";

  const trialEnd = current ? new Date(current.trial_ends_at) : null;
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000)) : null;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bonjour {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {current ? <>Dossier <strong>{current.raison_sociale}</strong></> : "Aucune entreprise sélectionnée"}
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
        {STATS.map((s) => (
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
          <CardTitle>Prochaines étapes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Votre socle multi-entreprises est en place. Les modules suivants arrivent :</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Plan comptable OHADA & saisie d'écritures (Phase 3)</li>
            <li>Facturation ventes/achats & trésorerie (Phase 4)</li>
            <li>Moteur fiscal paramétrable & DSF (Phase 5)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
