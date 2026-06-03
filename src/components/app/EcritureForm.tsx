import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Trash2, Check, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatXAF } from "@/lib/format";

type Compte = { id: string; numero: string; libelle: string };
type Journal = { id: string; code: string; libelle: string };
type Exercice = { id: string; libelle: string; date_debut: string; date_fin: string };

type Ligne = {
  id?: string;
  compte_id: string;
  libelle: string;
  debit: number;
  credit: number;
};

export type EcritureHeader = {
  id?: string;
  journal_id: string;
  exercice_id: string;
  date_piece: string;
  reference: string;
  libelle: string;
  statut?: "brouillon" | "validee" | "contrepassee";
};

export function EcritureForm({
  entrepriseId,
  initial,
  initialLignes,
  mode,
}: {
  entrepriseId: string;
  initial?: EcritureHeader;
  initialLignes?: Ligne[];
  mode: "create" | "edit";
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const readOnly = initial?.statut && initial.statut !== "brouillon";

  const [header, setHeader] = useState<EcritureHeader>(
    initial ?? {
      journal_id: "",
      exercice_id: "",
      date_piece: new Date().toISOString().slice(0, 10),
      reference: "",
      libelle: "",
    },
  );
  const [lignes, setLignes] = useState<Ligne[]>(
    initialLignes ?? [
      { compte_id: "", libelle: "", debit: 0, credit: 0 },
      { compte_id: "", libelle: "", debit: 0, credit: 0 },
    ],
  );
  const [saving, setSaving] = useState(false);

  const { data: journaux } = useQuery({
    queryKey: ["journaux", entrepriseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journaux")
        .select("id, code, libelle")
        .eq("entreprise_id", entrepriseId)
        .eq("actif", true)
        .order("code");
      if (error) throw error;
      return data as Journal[];
    },
  });

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

  const { data: comptes } = useQuery({
    queryKey: ["comptes-all", entrepriseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comptes")
        .select("id, numero, libelle")
        .eq("entreprise_id", entrepriseId)
        .eq("actif", true)
        .order("numero");
      if (error) throw error;
      return data as Compte[];
    },
  });

  // Default journal/exercice
  useEffect(() => {
    if (!header.journal_id && journaux?.[0])
      setHeader((h) => ({ ...h, journal_id: journaux[0].id }));
    if (!header.exercice_id && exercices?.[0])
      setHeader((h) => ({ ...h, exercice_id: exercices[0].id }));
  }, [journaux, exercices, header.journal_id, header.exercice_id]);

  const totals = useMemo(() => {
    const d = lignes.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = lignes.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { d, c, diff: d - c, balanced: d === c && d > 0 };
  }, [lignes]);

  function updateLigne(i: number, patch: Partial<Ligne>) {
    setLignes((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLigne() {
    setLignes((arr) => [...arr, { compte_id: "", libelle: "", debit: 0, credit: 0 }]);
  }
  function removeLigne(i: number) {
    setLignes((arr) => (arr.length <= 2 ? arr : arr.filter((_, idx) => idx !== i)));
  }

  async function save(validate: boolean) {
    if (!header.journal_id || !header.exercice_id) {
      toast.error("Journal et exercice requis");
      return;
    }
    const cleanLignes = lignes.filter(
      (l) => l.compte_id && (Number(l.debit) > 0 || Number(l.credit) > 0),
    );
    if (cleanLignes.length < 2) {
      toast.error("Au moins 2 lignes avec un compte et un montant");
      return;
    }
    if (validate && !totals.balanced) {
      toast.error(`Écriture non équilibrée (écart: ${formatXAF(totals.diff)})`);
      return;
    }

    setSaving(true);
    try {
      let ecritureId = header.id;

      if (mode === "create") {
        // Le numéro définitif est attribué atomiquement côté base lors de la
        // validation (fonction validate_ecriture). Un brouillon reste donc
        // sans numéro pour ne pas « consommer » de numéro inutilement.
        const { data, error } = await supabase
          .from("ecritures")
          .insert({
            entreprise_id: entrepriseId,
            exercice_id: header.exercice_id,
            journal_id: header.journal_id,
            date_piece: header.date_piece,
            reference: header.reference || null,
            libelle: header.libelle,
          })
          .select("id")
          .single();
        if (error) throw error;
        ecritureId = data.id;
      } else if (ecritureId) {
        const { error } = await supabase
          .from("ecritures")
          .update({
            date_piece: header.date_piece,
            reference: header.reference || null,
            libelle: header.libelle,
          })
          .eq("id", ecritureId);
        if (error) throw error;
        await supabase.from("lignes_ecriture").delete().eq("ecriture_id", ecritureId);
      }

      const { error: errL } = await supabase.from("lignes_ecriture").insert(
        cleanLignes.map((l, idx) => ({
          ecriture_id: ecritureId!,
          entreprise_id: entrepriseId,
          ordre: idx + 1,
          compte_id: l.compte_id,
          libelle: l.libelle || null,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      );
      if (errL) throw errL;

      if (validate) {
        const { error: errV } = await supabase.rpc("validate_ecriture", {
          _ecriture_id: ecritureId!,
        });
        if (errV) throw errV;
      }

      toast.success(validate ? "Écriture validée" : "Brouillon enregistré");
      qc.invalidateQueries({ queryKey: ["ecritures"] });
      navigate({ to: "/app/comptabilite/ecritures" as never });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function contrepasser() {
    if (!header.id) return;
    const { error } = await supabase.rpc("contrepasser_ecriture", { _ecriture_id: header.id });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Écriture contre-passée");
    qc.invalidateQueries({ queryKey: ["ecritures"] });
    navigate({ to: "/app/comptabilite/ecritures" as never });
  }

  return (
    <div className="space-y-4 max-w-6xl">
      {readOnly && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm flex items-center gap-2">
          <Badge>{initial?.statut === "validee" ? "Validée" : "Contre-passée"}</Badge>
          <span className="text-muted-foreground">
            Écriture verrouillée. Pour corriger, contre-passez et créez une nouvelle écriture.
          </span>
        </div>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label>Journal</Label>
            <Select
              value={header.journal_id}
              onValueChange={(v) => setHeader({ ...header, journal_id: v })}
              disabled={!!readOnly || mode === "edit"}
            >
              <SelectTrigger>
                <SelectValue placeholder="…" />
              </SelectTrigger>
              <SelectContent>
                {journaux?.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.code} — {j.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Exercice</Label>
            <Select
              value={header.exercice_id}
              onValueChange={(v) => setHeader({ ...header, exercice_id: v })}
              disabled={!!readOnly || mode === "edit"}
            >
              <SelectTrigger>
                <SelectValue placeholder="…" />
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
            <Label>Date pièce</Label>
            <Input
              type="date"
              value={header.date_piece}
              onChange={(e) => setHeader({ ...header, date_piece: e.target.value })}
              disabled={!!readOnly}
            />
          </div>
          <div>
            <Label>Référence</Label>
            <Input
              value={header.reference}
              onChange={(e) => setHeader({ ...header, reference: e.target.value })}
              placeholder="FA-001"
              disabled={!!readOnly}
            />
          </div>
          <div>
            <Label>Libellé</Label>
            <Input
              value={header.libelle}
              onChange={(e) => setHeader({ ...header, libelle: e.target.value })}
              placeholder="Achat fournitures…"
              disabled={!!readOnly}
            />
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 w-[280px]">Compte</th>
              <th className="px-3 py-2">Libellé ligne</th>
              <th className="px-3 py-2 w-[140px] text-right">Débit</th>
              <th className="px-3 py-2 w-[140px] text-right">Crédit</th>
              <th className="px-3 py-2 w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2">
                  <Select
                    value={l.compte_id}
                    onValueChange={(v) => updateLigne(i, { compte_id: v })}
                    disabled={!!readOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Compte…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {comptes?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono mr-2">{c.numero}</span>
                          {c.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={l.libelle}
                    onChange={(e) => updateLigne(i, { libelle: e.target.value })}
                    disabled={!!readOnly}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="text-right font-mono"
                    value={l.debit || ""}
                    onChange={(e) => updateLigne(i, { debit: Number(e.target.value), credit: 0 })}
                    disabled={!!readOnly}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="text-right font-mono"
                    value={l.credit || ""}
                    onChange={(e) => updateLigne(i, { credit: Number(e.target.value), debit: 0 })}
                    disabled={!!readOnly}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLigne(i)}
                      disabled={lignes.length <= 2}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/30">
            <tr className="border-t">
              <td colSpan={2} className="px-3 py-2">
                {!readOnly && (
                  <Button variant="outline" size="sm" onClick={addLigne}>
                    <Plus className="h-3 w-3 mr-1" /> Ajouter une ligne
                  </Button>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold">
                {formatXAF(totals.d)}
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold">
                {formatXAF(totals.c)}
              </td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right text-sm">
                {totals.d === 0 && totals.c === 0 ? (
                  <span className="text-muted-foreground">Saisie en cours…</span>
                ) : totals.balanced ? (
                  <span className="text-primary font-medium">✓ Équilibrée</span>
                ) : (
                  <span className="text-destructive font-medium">
                    Écart : {formatXAF(totals.diff)}
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/app/comptabilite/ecritures" as never })}
        >
          Retour
        </Button>
        {readOnly && initial?.statut === "validee" && (
          <Button variant="outline" onClick={contrepasser}>
            <ArrowLeftRight className="h-4 w-4 mr-1" /> Contre-passer
          </Button>
        )}
        {!readOnly && (
          <>
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>
              Enregistrer brouillon
            </Button>
            <Button onClick={() => save(true)} disabled={saving || !totals.balanced}>
              <Check className="h-4 w-4 mr-1" /> Valider
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
