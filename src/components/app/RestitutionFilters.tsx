import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type RestitutionState = {
  from: string;
  to: string;
  journalId: string;
};

type Exercice = { id: string; libelle: string; date_debut: string; date_fin: string };
type Journal = { id: string; code: string; libelle: string };

// Filtres communs aux restitutions OHADA (période + journal). Le choix d'un
// exercice cale automatiquement la période sur ses bornes, conformément à
// l'ergonomie attendue (cahier v1.1, §Ergonomie comptable).
export function RestitutionFilters({
  entrepriseId,
  value,
  onChange,
  showJournal = false,
  actions,
}: {
  entrepriseId: string;
  value: RestitutionState;
  onChange: (next: RestitutionState) => void;
  showJournal?: boolean;
  actions?: ReactNode;
}) {
  const { data: exercices } = useQuery({
    queryKey: ["exercices", entrepriseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices")
        .select("id, libelle, date_debut, date_fin")
        .eq("entreprise_id", entrepriseId)
        .order("date_debut", { ascending: false });
      if (error) throw error;
      return data as Exercice[];
    },
  });

  const { data: journaux } = useQuery({
    queryKey: ["journaux", entrepriseId],
    enabled: showJournal,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journaux")
        .select("id, code, libelle")
        .eq("entreprise_id", entrepriseId)
        .order("code");
      if (error) throw error;
      return data as Journal[];
    },
  });

  // Cale la période sur l'exercice le plus récent au premier chargement.
  useEffect(() => {
    if (!value.from && !value.to && exercices?.[0]) {
      onChange({ ...value, from: exercices[0].date_debut, to: exercices[0].date_fin });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercices]);

  function applyExercice(id: string) {
    const ex = exercices?.find((e) => e.id === id);
    if (ex) onChange({ ...value, from: ex.date_debut, to: ex.date_fin });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="w-[200px]">
        <Label className="text-xs">Exercice</Label>
        <Select onValueChange={applyExercice}>
          <SelectTrigger>
            <SelectValue placeholder="Choisir…" />
          </SelectTrigger>
          <SelectContent>
            {exercices?.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Du</Label>
        <Input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Au</Label>
        <Input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </div>
      {showJournal && (
        <div className="w-[200px]">
          <Label className="text-xs">Journal</Label>
          <Select
            value={value.journalId}
            onValueChange={(v) => onChange({ ...value, journalId: v })}
          >
            <SelectTrigger>
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
        </div>
      )}
      {actions && <div className="ml-auto flex items-end gap-2">{actions}</div>}
    </div>
  );
}
