import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useEntreprises } from "@/hooks/use-entreprises";
import { useMouvements, type Mouvement } from "@/hooks/use-mouvements";
import { RestitutionFilters, type RestitutionState } from "@/components/app/RestitutionFilters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatXAF, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/app/comptabilite/journal")({
  head: () => ({ meta: [{ title: "Journal général — Kompta" }] }),
  component: JournalPage,
});

type EcritureGroup = {
  id: string;
  numero: number | null;
  date_piece: string;
  journal_code: string;
  libelle: string;
  reference: string | null;
  lignes: Mouvement[];
  totalDebit: number;
  totalCredit: number;
};

function JournalPage() {
  const { current } = useEntreprises();
  const [filters, setFilters] = useState<RestitutionState>({ from: "", to: "", journalId: "all" });
  const { data: mouvements, isLoading } = useMouvements(current?.id, filters);

  const { groups, totaux } = useMemo(() => {
    const map = new Map<string, EcritureGroup>();
    for (const m of mouvements ?? []) {
      const g = map.get(m.ecriture.id) ?? {
        id: m.ecriture.id,
        numero: m.ecriture.numero,
        date_piece: m.ecriture.date_piece,
        journal_code: m.ecriture.journal_code,
        libelle: m.ecriture.libelle,
        reference: m.ecriture.reference,
        lignes: [],
        totalDebit: 0,
        totalCredit: 0,
      };
      g.lignes.push(m);
      g.totalDebit += m.debit;
      g.totalCredit += m.credit;
      map.set(m.ecriture.id, g);
    }
    const arr = Array.from(map.values()).sort(
      (a, b) => a.date_piece.localeCompare(b.date_piece) || (a.numero ?? 0) - (b.numero ?? 0),
    );
    const t = arr.reduce(
      (acc, g) => ({ debit: acc.debit + g.totalDebit, credit: acc.credit + g.totalCredit }),
      { debit: 0, credit: 0 },
    );
    return { groups: arr, totaux: t };
  }, [mouvements]);

  function exportCsv() {
    const rows: (string | number)[][] = [];
    for (const g of groups) {
      for (const m of g.lignes) {
        rows.push([
          g.journal_code,
          g.numero ?? "",
          formatDate(g.date_piece),
          m.compte.numero,
          m.compte.libelle,
          m.ecriture.libelle,
          m.debit,
          m.credit,
        ]);
      }
    }
    downloadCsv(
      `journal_${filters.from}_${filters.to}`,
      ["Journal", "N°", "Date", "Compte", "Libellé compte", "Libellé", "Débit", "Crédit"],
      rows,
    );
  }

  if (!current) return <p className="text-muted-foreground">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold">Journal général</h2>
        <p className="text-sm text-muted-foreground">
          Écritures validées du {formatDate(filters.from)} au {formatDate(filters.to)}.
        </p>
      </div>

      <RestitutionFilters
        entrepriseId={current.id}
        value={filters}
        onChange={setFilters}
        showJournal
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={groups.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">Aucune écriture validée sur la période.</p>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Journal</th>
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Compte</th>
                <th className="px-4 py-2">Libellé</th>
                <th className="px-4 py-2 text-right">Débit</th>
                <th className="px-4 py-2 text-right">Crédit</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.id}>
                  {g.lignes.map((m, idx) => (
                    <tr
                      key={m.id}
                      className={
                        idx === 0 ? "border-t-2 border-border" : "border-t border-border/40"
                      }
                    >
                      <td className="px-4 py-1">{idx === 0 ? formatDate(g.date_piece) : ""}</td>
                      <td className="px-4 py-1 font-mono text-xs">
                        {idx === 0 ? g.journal_code : ""}
                      </td>
                      <td className="px-4 py-1 font-mono">{idx === 0 ? (g.numero ?? "—") : ""}</td>
                      <td className="px-4 py-1 font-mono">{m.compte.numero}</td>
                      <td className="px-4 py-1">
                        {m.ecriture.libelle}
                        {m.compte.libelle ? ` · ${m.compte.libelle}` : ""}
                      </td>
                      <td className="px-4 py-1 text-right font-mono">
                        {m.debit ? formatXAF(m.debit) : ""}
                      </td>
                      <td className="px-4 py-1 text-right font-mono">
                        {m.credit ? formatXAF(m.credit) : ""}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot className="bg-muted/30 font-semibold">
              <tr className="border-t-2">
                <td className="px-4 py-2" colSpan={5}>
                  Totaux
                </td>
                <td className="px-4 py-2 text-right font-mono">{formatXAF(totaux.debit)}</td>
                <td className="px-4 py-2 text-right font-mono">{formatXAF(totaux.credit)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}
