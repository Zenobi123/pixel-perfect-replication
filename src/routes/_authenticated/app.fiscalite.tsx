import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, CalendarClock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatXAF, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/fiscalite")({
  head: () => ({ meta: [{ title: "Échéancier fiscal — Kompta" }] }),
  component: FiscalitePage,
});

type Statut = "a_preparer" | "en_revue" | "validee" | "deposee" | "payee" | "archivee";
type Declaration = {
  id: string;
  code_impot: string;
  libelle: string;
  periode: string | null;
  date_echeance: string;
  montant: number | null;
  reference: string | null;
  statut: Statut;
  notes: string | null;
  exercice_id: string | null;
};
type Exercice = { id: string; libelle: string };

const STATUTS: { value: Statut; label: string }[] = [
  { value: "a_preparer", label: "À préparer" },
  { value: "en_revue", label: "En revue" },
  { value: "validee", label: "Validée" },
  { value: "deposee", label: "Déposée" },
  { value: "payee", label: "Payée" },
  { value: "archivee", label: "Archivée" },
];
const STATUT_LABEL = Object.fromEntries(STATUTS.map((s) => [s.value, s.label])) as Record<
  Statut,
  string
>;
const CODES = ["TVA", "ACOMPTE_IS", "IS", "IRPP", "RETENUE_SOURCE", "PATENTE", "AUTRE"];
const TERMINAL: Statut[] = ["deposee", "payee", "archivee"];

function statutBadge(s: Statut) {
  const variant =
    s === "payee" || s === "deposee" ? undefined : s === "archivee" ? "outline" : "secondary";
  return <Badge variant={variant as "secondary" | "outline" | undefined}>{STATUT_LABEL[s]}</Badge>;
}

type Form = {
  code_impot: string;
  libelle: string;
  periode: string;
  date_echeance: string;
  montant: string;
  reference: string;
  statut: Statut;
  notes: string;
  exercice_id: string;
};
const EMPTY: Form = {
  code_impot: "TVA",
  libelle: "",
  periode: "",
  date_echeance: new Date().toISOString().slice(0, 10),
  montant: "",
  reference: "",
  statut: "a_preparer",
  notes: "",
  exercice_id: "",
};

function FiscalitePage() {
  const { current } = useEntreprises();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Declaration | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: exercices } = useQuery({
    queryKey: ["exercices", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Exercice[]> => {
      const { data, error } = await supabase
        .from("exercices")
        .select("id, libelle")
        .eq("entreprise_id", current!.id)
        .order("date_debut", { ascending: false });
      if (error) throw error;
      return data as Exercice[];
    },
  });

  const { data: declarations, isLoading } = useQuery({
    queryKey: ["declarations", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Declaration[]> => {
      const { data, error } = await supabase
        .from("declarations_fiscales")
        .select(
          "id, code_impot, libelle, periode, date_echeance, montant, reference, statut, notes, exercice_id",
        )
        .eq("entreprise_id", current!.id)
        .order("date_echeance");
      if (error) throw error;
      return data as Declaration[];
    },
  });

  useEffect(() => {
    if (!form.exercice_id && exercices?.[0])
      setForm((f) => ({ ...f, exercice_id: exercices[0].id }));
  }, [exercices, form.exercice_id]);

  const today = new Date().toISOString().slice(0, 10);
  const dans7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

  const alertes = useMemo(
    () =>
      (declarations ?? []).filter((d) => !TERMINAL.includes(d.statut) && d.date_echeance <= dans7),
    [declarations, dans7],
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, exercice_id: exercices?.[0]?.id ?? "" });
    setOpen(true);
  }
  function openEdit(d: Declaration) {
    setEditing(d);
    setForm({
      code_impot: d.code_impot,
      libelle: d.libelle,
      periode: d.periode ?? "",
      date_echeance: d.date_echeance,
      montant: d.montant != null ? String(d.montant) : "",
      reference: d.reference ?? "",
      statut: d.statut,
      notes: d.notes ?? "",
      exercice_id: d.exercice_id ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!current) return;
    if (!form.libelle.trim() || !form.date_echeance) {
      toast.error("Libellé et date d'échéance requis");
      return;
    }
    setSaving(true);
    const payload = {
      entreprise_id: current.id,
      exercice_id: form.exercice_id || null,
      code_impot: form.code_impot,
      libelle: form.libelle.trim(),
      periode: form.periode || null,
      date_echeance: form.date_echeance,
      montant: form.montant === "" ? null : Number(form.montant),
      reference: form.reference || null,
      statut: form.statut,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("declarations_fiscales").update(payload).eq("id", editing.id)
      : await supabase.from("declarations_fiscales").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Déclaration mise à jour" : "Échéance ajoutée");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["declarations", current.id] });
  }

  async function genererTva() {
    if (!current || !exercices?.[0]) {
      toast.error("Aucun exercice");
      return;
    }
    const { data, error } = await supabase.rpc("generer_echeances_tva", {
      _exercice_id: exercices[0].id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${data ?? 0} échéance(s) de TVA générée(s)`);
    qc.invalidateQueries({ queryKey: ["declarations", current.id] });
  }

  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-5xl">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Échéancier fiscal</h1>
          <p className="text-sm text-muted-foreground">
            Calendrier des obligations et suivi des déclarations. Les montants sont saisis
            manuellement (pas de calcul automatique en v0).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={genererTva}>
            <CalendarClock className="h-4 w-4 mr-1" /> Générer TVA mensuelle
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Nouvelle échéance
          </Button>
        </div>
      </header>

      {alertes.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>{alertes.length} échéance(s) à traiter sous 7 jours ou en retard.</span>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Échéance</th>
                <th className="px-4 py-2">Impôt</th>
                <th className="px-4 py-2">Libellé</th>
                <th className="px-4 py-2">Période</th>
                <th className="px-4 py-2 text-right">Montant</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement…
                  </td>
                </tr>
              ) : declarations?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune échéance. Ajoutez-en une ou générez la TVA mensuelle.
                  </td>
                </tr>
              ) : (
                declarations?.map((d) => {
                  const enRetard = !TERMINAL.includes(d.statut) && d.date_echeance < today;
                  return (
                    <tr key={d.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <span className={enRetard ? "text-destructive font-medium" : ""}>
                          {formatDate(d.date_echeance)}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{d.code_impot}</td>
                      <td className="px-4 py-2">{d.libelle}</td>
                      <td className="px-4 py-2 text-muted-foreground">{d.periode ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {d.montant != null ? formatXAF(d.montant) : "—"}
                      </td>
                      <td className="px-4 py-2">{statutBadge(d.statut)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier l'échéance" : "Nouvelle échéance fiscale"}
            </DialogTitle>
            <DialogDescription>
              Suivez l'obligation et son statut. Le montant reste saisi par un utilisateur autorisé.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Impôt</Label>
              <Select
                value={form.code_impot}
                onValueChange={(v) => setForm({ ...form, code_impot: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CODES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select
                value={form.statut}
                onValueChange={(v) => setForm({ ...form, statut: v as Statut })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Libellé</Label>
              <Input
                value={form.libelle}
                onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                placeholder="Déclaration de TVA 01/2026"
              />
            </div>
            <div>
              <Label>Période</Label>
              <Input
                value={form.periode}
                onChange={(e) => setForm({ ...form, periode: e.target.value })}
                placeholder="01/2026"
              />
            </div>
            <div>
              <Label>Date d'échéance</Label>
              <Input
                type="date"
                value={form.date_echeance}
                onChange={(e) => setForm({ ...form, date_echeance: e.target.value })}
              />
            </div>
            <div>
              <Label>Montant (optionnel)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.montant}
                onChange={(e) => setForm({ ...form, montant: e.target.value })}
              />
            </div>
            <div>
              <Label>Référence</Label>
              <Input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="N° de quittance…"
              />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
