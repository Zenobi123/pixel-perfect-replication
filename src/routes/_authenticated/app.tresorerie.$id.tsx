import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatXAF, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/tresorerie/$id")({
  head: () => ({ meta: [{ title: "Journal de trésorerie — Kompta" }] }),
  component: TresorerieDetail,
});

type MouvType = "encaissement" | "decaissement" | "transfert";
type Mouvement = {
  id: string;
  type: MouvType;
  date_mouvement: string;
  libelle: string;
  montant: number;
  compte_tresorerie_id: string;
  compte_tresorerie_dest_id: string | null;
};

function TresorerieDetail() {
  const { id } = Route.useParams();
  const { current } = useEntreprises();

  const { data: compte } = useQuery({
    queryKey: ["compte-tresorerie", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comptes_tresorerie")
        .select("id, libelle, type, solde_initial")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: mouvements } = useQuery({
    queryKey: ["mouvements-tresorerie", id],
    queryFn: async (): Promise<Mouvement[]> => {
      const { data, error } = await supabase
        .from("mouvements_tresorerie")
        .select(
          "id, type, date_mouvement, libelle, montant, compte_tresorerie_id, compte_tresorerie_dest_id",
        )
        .or(`compte_tresorerie_id.eq.${id},compte_tresorerie_dest_id.eq.${id}`)
        .order("date_mouvement")
        .order("created_at");
      if (error) throw error;
      return data as Mouvement[];
    },
  });

  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;

  // Signe du mouvement pour CE compte : entrée (+) ou sortie (−).
  function signedMontant(m: Mouvement): number {
    if (m.type === "encaissement") return m.montant;
    if (m.type === "decaissement") return -m.montant;
    // transfert : crédité si destination, débité si source
    return m.compte_tresorerie_dest_id === id ? m.montant : -m.montant;
  }

  let solde = Number(compte?.solde_initial ?? 0);

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-4xl">
      <Link
        to={"/app/tresorerie" as never}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" /> Trésorerie
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{compte?.libelle ?? "Compte"}</h1>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Libellé</th>
                <th className="px-4 py-2 text-right">Entrée</th>
                <th className="px-4 py-2 text-right">Sortie</th>
                <th className="px-4 py-2 text-right">Solde</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t bg-muted/20">
                <td className="px-4 py-2 text-muted-foreground" colSpan={5}>
                  Solde initial
                </td>
                <td className="px-4 py-2 text-right font-mono">{formatXAF(solde)}</td>
              </tr>
              {mouvements?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Aucun mouvement.
                  </td>
                </tr>
              ) : (
                mouvements?.map((m) => {
                  const signed = signedMontant(m);
                  solde += signed;
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="px-4 py-2">{formatDate(m.date_mouvement)}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{m.type}</Badge>
                      </td>
                      <td className="px-4 py-2">{m.libelle}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {signed > 0 ? formatXAF(signed) : ""}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {signed < 0 ? formatXAF(-signed) : ""}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatXAF(solde)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
