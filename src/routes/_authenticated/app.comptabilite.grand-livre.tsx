import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useEntreprises } from "@/hooks/use-entreprises";
import { useMouvements, type Mouvement } from "@/hooks/use-mouvements";
import { RestitutionFilters, type RestitutionState } from "@/components/app/RestitutionFilters";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatXAF, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/app/comptabilite/grand-livre")({
  head: () => ({ meta: [{ title: "Grand livre — Kompta" }] }),
  component: GrandLivrePage,
});

type CompteGroup = {
  numero: string;
  libelle: string;
  mouvements: Mouvement[];
  totalDebit: number;
  totalCredit: number;
};

function GrandLivrePage() {
  const { current } = useEntreprises();
  const [filters, setFilters] = useState<RestitutionState>({ from: "", to: "", journalId: "all" });
  const [search, setSearch] = useState("");
  const { data: mouvements, isLoading } = useMouvements(current?.id, filters);

  const groups = useMemo(() => {
    const map = new Map<string, CompteGroup>();
    for (const m of mouvements ?? []) {
      const g = map.get(m.compte.numero) ?? {
        numero: m.compte.numero,
        libelle: m.compte.libelle,
        mouvements: [],
        totalDebit: 0,
        totalCredit: 0,
      };
      g.mouvements.push(m);
      g.totalDebit += m.debit;
      g.totalCredit += m.credit;
      map.set(m.compte.numero, g);
    }
    const arr = Array.from(map.values()).sort((a, b) => a.numero.localeCompare(b.numero));
    for (const g of arr) {
      g.mouvements.sort(
        (a, b) =>
          a.ecriture.date_piece.localeCompare(b.ecriture.date_piece) ||
          (a.ecriture.numero ?? 0) - (b.ecriture.numero ?? 0),
      );
    }
    const q = search.trim().toLowerCase();
    if (!q) return arr;
    return arr.filter(
      (g) => g.numero.toLowerCase().includes(q) || g.libelle.toLowerCase().includes(q),
    );
  }, [mouvements, search]);

  function exportCsv() {
    const rows: (string | number)[][] = [];
    for (const g of groups) {
      let solde = 0;
      for (const m of g.mouvements) {
        solde += m.debit - m.credit;
        rows.push([
          `${g.numero} ${g.libelle}`,
          formatDate(m.ecriture.date_piece),
          m.ecriture.journal_code,
          m.ecriture.numero ?? "",
          m.ecriture.libelle,
          m.debit,
          m.credit,
          solde,
        ]);
      }
    }
    downloadCsv(
      `grand_livre_${filters.from}_${filters.to}`,
      ["Compte", "Date", "Journal", "N°", "Libellé", "Débit", "Crédit", "Solde"],
      rows,
    );
  }

  if (!current) return <p className="text-muted-foreground">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold">Grand livre</h2>
        <p className="text-sm text-muted-foreground">
          Détail des mouvements par compte (écritures validées) du {formatDate(filters.from)} au{" "}
          {formatDate(filters.to)}.
        </p>
      </div>

      <RestitutionFilters
        entrepriseId={current.id}
        value={filters}
        onChange={setFilters}
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={groups.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        }
      />

      <Input
        placeholder="Filtrer par numéro ou libellé de compte…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">Aucune écriture validée sur la période.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            let solde = 0;
            return (
              <Card key={g.numero} className="overflow-hidden">
                <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
                  <span className="font-medium">
                    <span className="font-mono">{g.numero}</span> — {g.libelle}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Débit {formatXAF(g.totalDebit)} · Crédit {formatXAF(g.totalCredit)} · Solde{" "}
                    {formatXAF(g.totalDebit - g.totalCredit)}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-1">Date</th>
                      <th className="px-4 py-1">Journal</th>
                      <th className="px-4 py-1">N°</th>
                      <th className="px-4 py-1">Libellé</th>
                      <th className="px-4 py-1 text-right">Débit</th>
                      <th className="px-4 py-1 text-right">Crédit</th>
                      <th className="px-4 py-1 text-right">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.mouvements.map((m) => {
                      solde += m.debit - m.credit;
                      return (
                        <tr key={m.id} className="border-t">
                          <td className="px-4 py-1">{formatDate(m.ecriture.date_piece)}</td>
                          <td className="px-4 py-1 font-mono text-xs">{m.ecriture.journal_code}</td>
                          <td className="px-4 py-1 font-mono">{m.ecriture.numero ?? "—"}</td>
                          <td className="px-4 py-1">{m.ecriture.libelle}</td>
                          <td className="px-4 py-1 text-right font-mono">
                            {m.debit ? formatXAF(m.debit) : ""}
                          </td>
                          <td className="px-4 py-1 text-right font-mono">
                            {m.credit ? formatXAF(m.credit) : ""}
                          </td>
                          <td className="px-4 py-1 text-right font-mono">{formatXAF(solde)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
