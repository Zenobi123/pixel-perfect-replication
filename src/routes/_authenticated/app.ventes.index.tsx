import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatXAF, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/ventes/")({
  head: () => ({ meta: [{ title: "Ventes — Kompta" }] }),
  component: VentesPage,
});

type FactureStatut =
  | "brouillon"
  | "validee"
  | "envoyee"
  | "partiellement_payee"
  | "payee"
  | "annulee";

type Facture = {
  id: string;
  type: "devis" | "facture" | "avoir";
  numero: number | null;
  date_facture: string;
  objet: string | null;
  statut: FactureStatut;
  total_ttc: number;
  montant_paye: number;
  tiers: { code: string; raison_sociale: string } | null;
};

const TYPE_LABEL: Record<Facture["type"], string> = {
  devis: "Devis",
  facture: "Facture",
  avoir: "Avoir",
};

function statutBadge(s: FactureStatut) {
  const map: Record<
    FactureStatut,
    { label: string; variant?: "secondary" | "outline" | "destructive" }
  > = {
    brouillon: { label: "Brouillon", variant: "secondary" },
    validee: { label: "Validée" },
    envoyee: { label: "Envoyée" },
    partiellement_payee: { label: "Part. payée", variant: "outline" },
    payee: { label: "Payée" },
    annulee: { label: "Annulée", variant: "destructive" },
  };
  const c = map[s];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function VentesPage() {
  const { current } = useEntreprises();
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: factures, isLoading } = useQuery({
    queryKey: ["factures", current?.id, typeFilter],
    enabled: !!current?.id,
    queryFn: async (): Promise<Facture[]> => {
      let q = supabase
        .from("factures")
        .select(
          "id, type, numero, date_facture, objet, statut, total_ttc, montant_paye, tiers(code, raison_sociale)",
        )
        .eq("entreprise_id", current!.id)
        .order("date_facture", { ascending: false })
        .limit(200);
      if (typeFilter !== "all") q = q.eq("type", typeFilter as Facture["type"]);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Facture[];
    },
  });

  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-5xl">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ventes</h1>
          <p className="text-sm text-muted-foreground">Devis, factures et avoirs clients.</p>
        </div>
        <Button asChild>
          <Link to={"/app/ventes/nouvelle" as never}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau document
          </Link>
        </Button>
      </header>

      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les types</SelectItem>
          <SelectItem value="devis">Devis</SelectItem>
          <SelectItem value="facture">Factures</SelectItem>
          <SelectItem value="avoir">Avoirs</SelectItem>
        </SelectContent>
      </Select>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Client</th>
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
              ) : factures?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Aucun document. Créez le premier !
                  </td>
                </tr>
              ) : (
                factures?.map((f) => (
                  <tr key={f.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2">{formatDate(f.date_facture)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">{TYPE_LABEL[f.type]}</Badge>
                    </td>
                    <td className="px-4 py-2 font-mono">{f.numero ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Link
                        to={"/app/ventes/$id" as never}
                        params={{ id: f.id } as never}
                        className="hover:underline"
                      >
                        {f.tiers?.raison_sociale ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{f.objet ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatXAF(f.total_ttc)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatXAF(f.montant_paye)}</td>
                    <td className="px-4 py-2">{statutBadge(f.statut)}</td>
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
