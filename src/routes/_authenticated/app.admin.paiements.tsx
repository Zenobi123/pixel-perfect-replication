import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEstAdmin } from "@/hooks/use-abonnement";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatXAF, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/admin/paiements")({
  head: () => ({ meta: [{ title: "Validation des paiements — Kompta" }] }),
  component: AdminPaiementsPage,
});

type PaiementEnAttente = {
  id: string;
  owner_id: string;
  plan_code: string;
  cycle: string;
  montant: number;
  methode: string;
  reference: string | null;
  note: string | null;
  declared_at: string;
};

function AdminPaiementsPage() {
  const qc = useQueryClient();
  const { data: estAdmin, isLoading: chargementRole } = useEstAdmin();
  const [traite, setTraite] = useState<string | null>(null);

  const { data: paiements } = useQuery({
    queryKey: ["paiements-en-attente"],
    enabled: estAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_abonnement")
        .select("id, owner_id, plan_code, cycle, montant, methode, reference, note, declared_at")
        .eq("statut", "en_attente")
        .order("declared_at", { ascending: true });
      if (error) throw error;
      return data as PaiementEnAttente[];
    },
  });

  // Enrichissement best-effort de l'email du propriétaire (selon la RLS profiles).
  const { data: emails } = useQuery({
    queryKey: ["paiements-owners", (paiements ?? []).map((p) => p.owner_id).join(",")],
    enabled: (paiements?.length ?? 0) > 0,
    queryFn: async () => {
      const ids = [...new Set((paiements ?? []).map((p) => p.owner_id))];
      const { data } = await supabase.from("profiles").select("id, email").in("id", ids);
      const map: Record<string, string> = {};
      for (const row of (data ?? []) as { id: string; email: string | null }[]) {
        if (row.email) map[row.id] = row.email;
      }
      return map;
    },
  });

  async function agir(action: "valider" | "rejeter", id: string) {
    setTraite(id);
    try {
      const { error } =
        action === "valider"
          ? await supabase.rpc("valider_paiement", { _paiement_id: id })
          : await supabase.rpc("rejeter_paiement", { _paiement_id: id });
      if (error) throw error;
      toast.success(
        action === "valider" ? "Paiement validé, abonnement activé." : "Paiement rejeté.",
      );
      qc.invalidateQueries({ queryKey: ["paiements-en-attente"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTraite(null);
    }
  }

  if (chargementRole) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }

  if (!estAdmin) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accès réservé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Cette page est réservée aux administrateurs de la plateforme.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Validation des paiements</h1>
        <p className="text-sm text-muted-foreground">
          Vérifiez chaque règlement déclaré, puis validez pour activer l'abonnement du client.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Paiements en attente {paiements ? `(${paiements.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {paiements && paiements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Déclaré le</th>
                    <th className="px-3 py-2">Compte</th>
                    <th className="px-3 py-2">Offre</th>
                    <th className="px-3 py-2">Cycle</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2">Moyen</th>
                    <th className="px-3 py-2">Référence</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {paiements.map((p) => (
                    <tr key={p.id} className="border-t align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.declared_at)}</td>
                      <td className="px-3 py-2">
                        {emails?.[p.owner_id] ?? (
                          <span className="font-mono text-xs text-muted-foreground">
                            {p.owner_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{p.plan_code}</td>
                      <td className="px-3 py-2">{p.cycle}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatXAF(p.montant)}</td>
                      <td className="px-3 py-2">{p.methode}</td>
                      <td className="px-3 py-2">
                        <div className="text-muted-foreground">{p.reference ?? "—"}</div>
                        {p.note && <div className="text-xs text-muted-foreground/80">{p.note}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => agir("valider", p.id)}
                            disabled={traite === p.id}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => agir("rejeter", p.id)}
                            disabled={traite === p.id}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">Aucun paiement en attente.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
