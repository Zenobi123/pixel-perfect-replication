import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { RestitutionFilters, type RestitutionState } from "@/components/app/RestitutionFilters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatXAF, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/app/comptabilite/balance-auxiliaire")({
  head: () => ({ meta: [{ title: "Balance auxiliaire — Kompta" }] }),
  component: BalanceAuxiliairePage,
});

type Row = {
  tiersId: string;
  code: string;
  raison_sociale: string;
  type: string;
  debit: number;
  credit: number;
};

type RawRow = {
  debit: number | string;
  credit: number | string;
  tiers: { id: string; code: string; raison_sociale: string; type: string } | null;
};

function BalanceAuxiliairePage() {
  const { current } = useEntreprises();
  const [filters, setFilters] = useState<RestitutionState>({ from: "", to: "", journalId: "all" });
  const [typeFilter, setTypeFilter] = useState<"client" | "fournisseur">("client");

  const { data: mouvements, isLoading } = useQuery({
    queryKey: ["balance-aux", current?.id, filters.from, filters.to, typeFilter],
    enabled: !!current?.id,
    queryFn: async (): Promise<Row[]> => {
      let q = supabase
        .from("lignes_ecriture")
        .select(
          "debit, credit, tiers!inner(id, code, raison_sociale, type), ecritures!inner(date_piece, statut)",
        )
        .eq("entreprise_id", current!.id)
        .eq("ecritures.statut", "validee")
        .eq("tiers.type", typeFilter);
      if (filters.from) q = q.gte("ecritures.date_piece", filters.from);
      if (filters.to) q = q.lte("ecritures.date_piece", filters.to);
      const { data, error } = await q;
      if (error) throw error;
      const map = new Map<string, Row>();
      for (const r of (data ?? []) as unknown as RawRow[]) {
        if (!r.tiers) continue;
        const cur = map.get(r.tiers.id) ?? {
          tiersId: r.tiers.id,
          code: r.tiers.code,
          raison_sociale: r.tiers.raison_sociale,
          type: r.tiers.type,
          debit: 0,
          credit: 0,
        };
        cur.debit += Number(r.debit) || 0;
        cur.credit += Number(r.credit) || 0;
        map.set(r.tiers.id, cur);
      }
      return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
    },
  });

  const totaux = useMemo(
    () =>
      (mouvements ?? []).reduce(
        (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
        { debit: 0, credit: 0 },
      ),
    [mouvements],
  );

  function exportCsv() {
    downloadCsv(
      `balance_auxiliaire_${typeFilter}_${filters.from}_${filters.to}`,
      ["Code", "Tiers", "Débit", "Crédit", "Solde"],
      (mouvements ?? []).map((r) => [
        r.code,
        r.raison_sociale,
        r.debit,
        r.credit,
        r.debit - r.credit,
      ]),
    );
  }

  if (!current) return <p className="text-muted-foreground">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold">Balance auxiliaire</h2>
        <p className="text-sm text-muted-foreground">
          Soldes par tiers sur les écritures validées du {formatDate(filters.from)} au{" "}
          {formatDate(filters.to)}.
        </p>
      </div>

      <RestitutionFilters
        entrepriseId={current.id}
        value={filters}
        onChange={setFilters}
        actions={
          <>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as "client" | "fournisseur")}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Clients</SelectItem>
                <SelectItem value="fournisseur">Fournisseurs</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={(mouvements?.length ?? 0) === 0}
            >
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Tiers</th>
                <th className="px-4 py-2 text-right">Débit</th>
                <th className="px-4 py-2 text-right">Crédit</th>
                <th className="px-4 py-2 text-right">Solde</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : (mouvements?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Aucun mouvement sur la période.
                  </td>
                </tr>
              ) : (
                mouvements?.map((r) => (
                  <tr key={r.tiersId} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono">{r.code}</td>
                    <td className="px-4 py-2">{r.raison_sociale}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatXAF(r.debit)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatXAF(r.credit)}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatXAF(r.debit - r.credit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {(mouvements?.length ?? 0) > 0 && (
              <tfoot className="bg-muted/30 font-semibold">
                <tr className="border-t">
                  <td className="px-4 py-2" colSpan={2}>
                    Totaux
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{formatXAF(totaux.debit)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatXAF(totaux.credit)}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatXAF(totaux.debit - totaux.credit)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
