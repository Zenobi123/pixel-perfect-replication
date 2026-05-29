import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatXAF, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/achats/")({
  head: () => ({ meta: [{ title: "Achats — Kompta" }] }),
  component: AchatsPage,
});

type AchatStatut = "brouillon" | "validee" | "partiellement_payee" | "payee" | "annulee";
type Achat = {
  id: string;
  numero: number | null;
  reference_fournisseur: string | null;
  date_facture: string;
  objet: string | null;
  statut: AchatStatut;
  total_ttc: number;
  montant_paye: number;
  tiers: { code: string; raison_sociale: string } | null;
};

function statutBadge(s: AchatStatut) {
  const map: Record<
    AchatStatut,
    { label: string; variant?: "secondary" | "outline" | "destructive" }
  > = {
    brouillon: { label: "Brouillon", variant: "secondary" },
    validee: { label: "Validée" },
    partiellement_payee: { label: "Part. payée", variant: "outline" },
    payee: { label: "Payée" },
    annulee: { label: "Annulée", variant: "destructive" },
  };
  const c = map[s];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function AchatsPage() {
  const { current } = useEntreprises();

  const { data: achats, isLoading } = useQuery({
    queryKey: ["achats", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Achat[]> => {
      const { data, error } = await supabase
        .from("achats")
        .select(
          "id, numero, reference_fournisseur, date_facture, objet, statut, total_ttc, montant_paye, tiers(code, raison_sociale)",
        )
        .eq("entreprise_id", current!.id)
        .order("date_facture", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as Achat[];
    },
  });

  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-5xl">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Achats</h1>
          <p className="text-sm text-muted-foreground">Factures fournisseurs et dépenses.</p>
        </div>
        <Button asChild>
          <Link to={"/app/achats/nouvelle" as never}>
            <Plus className="h-4 w-4 mr-1" /> Nouvelle facture
          </Link>
        </Button>
      </header>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Réf. fournisseur</th>
                <th className="px-4 py-2">Fournisseur</th>
                <th className="px-4 py-2">Objet</th>
                <th className="px-4 py-2 text-right">TTC</th>
                <th className="px-4 py-2 text-right">Payé</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : achats?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune facture fournisseur. Créez la première !
                  </td>
                </tr>
              ) : (
                achats?.map((a) => (
                  <tr key={a.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2">{formatDate(a.date_facture)}</td>
                    <td className="px-4 py-2 font-mono">{a.numero ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {a.reference_fournisseur ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to={"/app/achats/$id" as never}
                        params={{ id: a.id } as never}
                        className="hover:underline"
                      >
                        {a.tiers?.raison_sociale ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{a.objet ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatXAF(a.total_ttc)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatXAF(a.montant_paye)}</td>
                    <td className="px-4 py-2">{statutBadge(a.statut)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
