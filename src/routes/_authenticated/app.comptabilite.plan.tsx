import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/app/comptabilite/plan")({
  component: PlanPage,
});

type Compte = {
  id: string;
  numero: string;
  libelle: string;
  classe: number;
  sens: string;
  actif: boolean;
};

function PlanPage() {
  const { current } = useEntreprises();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["comptes", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Compte[]> => {
      const { data, error } = await supabase
        .from("comptes")
        .select("id, numero, libelle, classe, sens, actif")
        .eq("entreprise_id", current!.id)
        .order("numero");
      if (error) throw error;
      return data as Compte[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (c) => c.numero.toLowerCase().includes(q) || c.libelle.toLowerCase().includes(q),
    );
  }, [data, search]);

  const byClasse = useMemo(() => {
    const map = new Map<number, Compte[]>();
    filtered.forEach((c) => {
      const arr = map.get(c.classe) ?? [];
      arr.push(c);
      map.set(c.classe, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  if (!current) return <p className="text-muted-foreground">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Plan comptable OHADA</h2>
          <p className="text-sm text-muted-foreground">
            {data?.length ?? 0} comptes — classes 1 à 8
          </p>
        </div>
        <Input
          placeholder="Rechercher un numéro ou libellé…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-6">
          {byClasse.map(([classe, items]) => (
            <Card key={classe} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary">Classe {classe}</Badge>
                <span className="text-sm text-muted-foreground">{items.length} comptes</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                {items.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-baseline gap-3 py-1 border-b border-border/40 text-sm"
                  >
                    <span className="font-mono font-medium w-16 shrink-0">{c.numero}</span>
                    <span className="flex-1 truncate">{c.libelle}</span>
                    <span className="text-xs text-muted-foreground">{c.sens}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
