import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Lock, Unlock, CheckCircle2, Eye, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
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
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/comptabilite/periodes")({
  head: () => ({ meta: [{ title: "Périodes — Kompta" }] }),
  component: PeriodesPage,
});

type Exercice = { id: string; libelle: string };
type PeriodeStatut = "ouverte" | "en_revue" | "verrouillee" | "cloturee";
type Periode = {
  id: string;
  libelle: string;
  date_debut: string;
  date_fin: string;
  statut: PeriodeStatut;
};

function statutBadge(s: PeriodeStatut) {
  if (s === "ouverte") return <Badge variant="secondary">Ouverte</Badge>;
  if (s === "en_revue") return <Badge variant="outline">En revue</Badge>;
  if (s === "verrouillee") return <Badge>Verrouillée</Badge>;
  return <Badge variant="destructive">Clôturée</Badge>;
}

function PeriodesPage() {
  const { current } = useEntreprises();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [exerciceId, setExerciceId] = useState<string>("");

  const { data: exercices } = useQuery({
    queryKey: ["exercices", current?.id],
    enabled: !!current?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices")
        .select("id, libelle")
        .eq("entreprise_id", current!.id)
        .order("date_debut", { ascending: false });
      if (error) throw error;
      return data as Exercice[];
    },
  });

  useEffect(() => {
    if (!exerciceId && exercices?.[0]) setExerciceId(exercices[0].id);
  }, [exercices, exerciceId]);

  const { data: periodes, isLoading } = useQuery({
    queryKey: ["periodes", exerciceId],
    enabled: !!exerciceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("periodes")
        .select("id, libelle, date_debut, date_fin, statut")
        .eq("exercice_id", exerciceId)
        .order("date_debut");
      if (error) throw error;
      return data as Periode[];
    },
  });

  async function run(action: () => Promise<{ error: { message: string } | null }>, ok: string) {
    const { error } = await action();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["periodes", exerciceId] });
  }

  async function generer() {
    if (!exerciceId) return;
    await run(
      async () => await supabase.rpc("generer_periodes", { _exercice_id: exerciceId }),
      "Périodes générées",
    );
  }

  async function rouvrir(id: string) {
    const motif = window.prompt("Motif de réouverture (obligatoire) :")?.trim();
    if (!motif || motif.length < 3) {
      toast.error("Un motif d'au moins 3 caractères est requis");
      return;
    }
    await run(
      async () => await supabase.rpc("rouvrir_periode", { _periode_id: id, _motif: motif }),
      "Période rouverte — saisie de nouveau autorisée",
    );
  }

  async function verrouiller(p: Periode) {
    const { error } = await supabase.rpc("verrouiller_periode", { _periode_id: p.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Période ${p.libelle} verrouillée — saisie comptable bloquée`);
    qc.invalidateQueries({ queryKey: ["periodes", exerciceId] });
  }

  async function cloturer(p: Periode) {
    const { error } = await supabase.rpc("cloturer_periode", { _periode_id: p.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `Période ${p.libelle} clôturée — saisie verrouillée. Génération de la balance…`,
    );
    qc.invalidateQueries({ queryKey: ["periodes", exerciceId] });
    navigate({
      to: "/app/comptabilite/balance",
      search: { from: p.date_debut, to: p.date_fin },
    });
  }

  if (!current) return <p className="text-muted-foreground">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Périodes</h2>
          <p className="text-sm text-muted-foreground">
            Verrouillez ou clôturez les périodes pour figer la saisie comptable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={exerciceId} onValueChange={setExerciceId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Exercice…" />
            </SelectTrigger>
            <SelectContent>
              {exercices?.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {periodes && periodes.length === 0 && (
            <Button onClick={generer}>
              <CalendarPlus className="h-4 w-4 mr-1" /> Générer les périodes
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Période</th>
                <th className="px-4 py-2">Du</th>
                <th className="px-4 py-2">Au</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : periodes?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune période. Générez-les pour cet exercice.
                  </td>
                </tr>
              ) : (
                periodes?.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{p.libelle}</td>
                    <td className="px-4 py-2">{formatDate(p.date_debut)}</td>
                    <td className="px-4 py-2">{formatDate(p.date_fin)}</td>
                    <td className="px-4 py-2">{statutBadge(p.statut)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {(p.statut === "ouverte" || p.statut === "en_revue") && (
                          <>
                            {p.statut === "ouverte" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  run(
                                    async () =>
                                      await supabase.rpc("mettre_en_revue_periode", {
                                        _periode_id: p.id,
                                      }),
                                    "Période passée en revue",
                                  )
                                }
                              >
                                <Eye className="h-4 w-4 mr-1" /> En revue
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => verrouiller(p)}>
                              <Lock className="h-4 w-4 mr-1" /> Verrouiller
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => cloturer(p)}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Clôturer
                            </Button>
                          </>
                        )}
                        {p.statut === "verrouillee" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => rouvrir(p.id)}>
                              <Unlock className="h-4 w-4 mr-1" /> Rouvrir
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => cloturer(p)}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Clôturer
                            </Button>
                          </>
                        )}
                        {p.statut === "cloturee" && (
                          <Button variant="ghost" size="sm" onClick={() => rouvrir(p.id)}>
                            <Unlock className="h-4 w-4 mr-1" /> Rouvrir
                          </Button>
                        )}
                      </div>
                    </td>
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
