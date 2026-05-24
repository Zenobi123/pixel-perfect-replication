import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/app/comptabilite/journaux")({
  component: JournauxPage,
});

type Journal = {
  id: string;
  code: string;
  libelle: string;
  type: string;
  actif: boolean;
};

function JournauxPage() {
  const { current } = useEntreprises();

  const { data, isLoading } = useQuery({
    queryKey: ["journaux", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Journal[]> => {
      const { data, error } = await supabase
        .from("journaux")
        .select("id, code, libelle, type, actif")
        .eq("entreprise_id", current!.id)
        .order("code");
      if (error) throw error;
      return data as Journal[];
    },
  });

  if (!current) return <p className="text-muted-foreground">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold">Journaux comptables</h2>
        <p className="text-sm text-muted-foreground">
          6 journaux standards créés automatiquement. La création de journaux personnalisés arrive bientôt.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <div className="grid gap-3">
          {data?.map((j) => (
            <Card key={j.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="font-mono text-lg font-bold w-12">{j.code}</div>
                <div>
                  <div className="font-medium">{j.libelle}</div>
                  <div className="text-xs text-muted-foreground uppercase">{j.type}</div>
                </div>
              </div>
              <Badge variant={j.actif ? "default" : "outline"}>{j.actif ? "Actif" : "Inactif"}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
