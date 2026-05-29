import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useEntreprises } from "@/hooks/use-entreprises";
import { useMouvements } from "@/hooks/use-mouvements";
import { RestitutionFilters, type RestitutionState } from "@/components/app/RestitutionFilters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatXAF, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/app/comptabilite/balance")({
  head: () => ({ meta: [{ title: "Balance générale — Kompta" }] }),
  component: BalancePage,
});

type LigneBalance = {
  numero: string;
  libelle: string;
  classe: number;
  debit: number;
  credit: number;
  soldeDebit: number;
  soldeCredit: number;
};

function BalancePage() {
  const { current } = useEntreprises();
  const [filters, setFilters] = useState<RestitutionState>({ from: "", to: "", journalId: "all" });
  const { data: mouvements, isLoading } = useMouvements(current?.id, filters);

  const { lignes, totaux } = useMemo(() => {
    const map = new Map<string, LigneBalance>();
    for (const m of mouvements ?? []) {
      const key = m.compte.numero;
      const cur = map.get(key) ?? {
        numero: m.compte.numero,
        libelle: m.compte.libelle,
        classe: m.compte.classe,
        debit: 0,
        credit: 0,
        soldeDebit: 0,
        soldeCredit: 0,
      };
      cur.debit += m.debit;
      cur.credit += m.credit;
      map.set(key, cur);
    }
    const arr = Array.from(map.values()).sort((a, b) => a.numero.localeCompare(b.numero));
    for (const l of arr) {
      const solde = l.debit - l.credit;
      l.soldeDebit = solde > 0 ? solde : 0;
      l.soldeCredit = solde < 0 ? -solde : 0;
    }
    const t = arr.reduce(
      (acc, l) => ({
        debit: acc.debit + l.debit,
        credit: acc.credit + l.credit,
        soldeDebit: acc.soldeDebit + l.soldeDebit,
        soldeCredit: acc.soldeCredit + l.soldeCredit,
      }),
      { debit: 0, credit: 0, soldeDebit: 0, soldeCredit: 0 },
    );
    return { lignes: arr, totaux: t };
  }, [mouvements]);

  const equilibre = Math.round((totaux.debit - totaux.credit) * 100) === 0;

  function exportCsv() {
    downloadCsv(
      `balance_${filters.from}_${filters.to}`,
      ["Compte", "Libellé", "Débit", "Crédit", "Solde débiteur", "Solde créditeur"],
      lignes.map((l) => [l.numero, l.libelle, l.debit, l.credit, l.soldeDebit, l.soldeCredit]),
    );
  }

  if (!current) return <p className="text-muted-foreground">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold">Balance générale</h2>
        <p className="text-sm text-muted-foreground">
          Soldes par compte sur les écritures validées du {formatDate(filters.from)} au{" "}
          {formatDate(filters.to)}.
        </p>
      </div>

      <RestitutionFilters
        entrepriseId={current.id}
        value={filters}
        onChange={setFilters}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={lignes.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        }
      />

      {!equilibre && lignes.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          Balance déséquilibrée : total débit ({formatXAF(totaux.debit)}) ≠ total crédit (
          {formatXAF(totaux.credit)}).
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Compte</th>
                <th className="px-4 py-2">Libellé</th>
                <th className="px-4 py-2 text-right">Débit</th>
                <th className="px-4 py-2 text-right">Crédit</th>
                <th className="px-4 py-2 text-right">Solde débiteur</th>
                <th className="px-4 py-2 text-right">Solde créditeur</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : lignes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune écriture validée sur la période.
                  </td>
                </tr>
              ) : (
                lignes.map((l) => (
                  <tr key={l.numero} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono">{l.numero}</td>
                    <td className="px-4 py-2">{l.libelle}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatXAF(l.debit)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatXAF(l.credit)}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {l.soldeDebit ? formatXAF(l.soldeDebit) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {l.soldeCredit ? formatXAF(l.soldeCredit) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {lignes.length > 0 && (
              <tfoot className="bg-muted/30 font-semibold">
                <tr className="border-t">
                  <td className="px-4 py-2" colSpan={2}>
                    Totaux
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{formatXAF(totaux.debit)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatXAF(totaux.credit)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatXAF(totaux.soldeDebit)}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatXAF(totaux.soldeCredit)}
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
