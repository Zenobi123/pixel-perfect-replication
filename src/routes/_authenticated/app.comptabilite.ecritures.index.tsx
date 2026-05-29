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

export const Route = createFileRoute("/_authenticated/app/comptabilite/ecritures/")({
  component: EcrituresPage,
});

type Ecriture = {
  id: string;
  numero: number | null;
  date_piece: string;
  reference: string | null;
  libelle: string;
  statut: "brouillon" | "validee" | "contrepassee";
  journal_id: string;
  journaux: { code: string; libelle: string } | null;
  lignes_ecriture: { debit: number; credit: number }[];
};

function statutBadge(s: Ecriture["statut"]) {
  if (s === "validee") return <Badge>Validée</Badge>;
  if (s === "contrepassee") return <Badge variant="outline">Contre-passée</Badge>;
  return <Badge variant="secondary">Brouillon</Badge>;
}

function EcrituresPage() {
  const { current } = useEntreprises();
  const [journalFilter, setJournalFilter] = useState<string>("all");

  const { data: journaux } = useQuery({
    queryKey: ["journaux", current?.id],
    enabled: !!current?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journaux")
        .select("id, code, libelle")
        .eq("entreprise_id", current!.id)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: ecritures, isLoading } = useQuery({
    queryKey: ["ecritures", current?.id, journalFilter],
    enabled: !!current?.id,
    queryFn: async (): Promise<Ecriture[]> => {
      let q = supabase
        .from("ecritures")
        .select(
          "id, numero, date_piece, reference, libelle, statut, journal_id, journaux(code, libelle), lignes_ecriture(debit, credit)",
        )
        .eq("entreprise_id", current!.id)
        .order("date_piece", { ascending: false })
        .order("numero", { ascending: false })
        .limit(200);
      if (journalFilter !== "all") q = q.eq("journal_id", journalFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as Ecriture[];
    },
  });

  if (!current) return <p className="text-muted-foreground">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Écritures</h2>
          <p className="text-sm text-muted-foreground">
            {ecritures?.length ?? 0} dernières écritures
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={journalFilter} onValueChange={setJournalFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les journaux</SelectItem>
              {journaux?.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.code} — {j.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild>
            <Link to={"/app/comptabilite/ecritures/nouvelle" as never}>
              <Plus className="h-4 w-4 mr-1" /> Nouvelle écriture
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Journal</th>
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Libellé</th>
                <th className="px-4 py-2 text-right">Débit</th>
                <th className="px-4 py-2 text-right">Crédit</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : ecritures?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune écriture. Créez la première !
                  </td>
                </tr>
              ) : (
                ecritures?.map((e) => {
                  const tot = e.lignes_ecriture.reduce(
                    (acc, l) => ({ d: acc.d + Number(l.debit), c: acc.c + Number(l.credit) }),
                    { d: 0, c: 0 },
                  );
                  return (
                    <tr key={e.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2">{formatDate(e.date_piece)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{e.journaux?.code}</td>
                      <td className="px-4 py-2 font-mono">{e.numero ?? "—"}</td>
                      <td className="px-4 py-2">
                        <Link
                          to={"/app/comptabilite/ecritures/$id" as never}
                          params={{ id: e.id } as never}
                          className="hover:underline"
                        >
                          {e.libelle}
                        </Link>
                        {e.reference && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({e.reference})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatXAF(tot.d)}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatXAF(tot.c)}</td>
                      <td className="px-4 py-2">{statutBadge(e.statut)}</td>
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
