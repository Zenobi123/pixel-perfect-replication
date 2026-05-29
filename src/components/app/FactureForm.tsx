import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Trash2, Check, CreditCard, Printer } from "lucide-react";
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

type FactureType = "devis" | "facture" | "avoir";
type FactureStatut =
  | "brouillon"
  | "validee"
  | "envoyee"
  | "partiellement_payee"
  | "payee"
  | "annulee";

type Tiers = { id: string; code: string; raison_sociale: string };
type Exercice = { id: string; libelle: string };
type Ligne = { designation: string; quantite: number; prix_unitaire: number; taux_tva: number };

export type FactureHeader = {
  id?: string;
  type: FactureType;
  tiers_id: string;
  exercice_id: string;
  date_facture: string;
  date_echeance: string;
  objet: string;
  statut?: FactureStatut;
  numero?: number | null;
  total_ttc?: number;
  montant_paye?: number;
};

const TYPE_LABEL: Record<FactureType, string> = {
  devis: "Devis",
  facture: "Facture",
  avoir: "Avoir",
};

function statutBadge(s: FactureStatut) {
  const map: Record<
    FactureStatut,
    { label: string; variant?: "secondary" | "outline" | "destructive" }
  > = {
    brouillon: { label: "Brouillon", variant: "secondary" },
    validee: { label: "Validée" },
    envoyee: { label: "Envoyée" },
    partiellement_payee: { label: "Partiellement payée", variant: "outline" },
    payee: { label: "Payée" },
    annulee: { label: "Annulée", variant: "destructive" },
  };
  const c = map[s];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function FactureForm({
  entrepriseId,
  initial,
  initialLignes,
  mode,
}: {
  entrepriseId: string;
  initial?: FactureHeader;
  initialLignes?: Ligne[];
  mode: "create" | "edit";
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const readOnly = !!initial?.statut && initial.statut !== "brouillon";

  const [header, setHeader] = useState<FactureHeader>(
    initial ?? {
      type: "facture",
      tiers_id: "",
      exercice_id: "",
      date_facture: new Date().toISOString().slice(0, 10),
      date_echeance: "",
      objet: "",
    },
  );
  const [lignes, setLignes] = useState<Ligne[]>(
    initialLignes ?? [{ designation: "", quantite: 1, prix_unitaire: 0, taux_tva: 19.25 }],
  );
  const [saving, setSaving] = useState(false);

  const { data: tiers } = useQuery({
    queryKey: ["tiers-clients", entrepriseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tiers")
        .select("id, code, raison_sociale")
        .eq("entreprise_id", entrepriseId)
        .eq("actif", true)
        .order("code");
      if (error) throw error;
      return data as Tiers[];
    },
  });

  const { data: exercices } = useQuery({
    queryKey: ["exercices", entrepriseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercices")
        .select("id, libelle")
        .eq("entreprise_id", entrepriseId)
        .order("date_debut", { ascending: false });
      if (error) throw error;
      return data as Exercice[];
    },
  });

  useEffect(() => {
    if (!header.exercice_id && exercices?.[0])
      setHeader((h) => ({ ...h, exercice_id: exercices[0].id }));
  }, [exercices, header.exercice_id]);

  const totals = useMemo(() => {
    let ht = 0;
    let tva = 0;
    for (const l of lignes) {
      const lht = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0);
      ht += lht;
      tva += Math.round(((lht * (Number(l.taux_tva) || 0)) / 100) * 100) / 100;
    }
    return { ht, tva, ttc: ht + tva };
  }, [lignes]);

  function updateLigne(i: number, patch: Partial<Ligne>) {
    setLignes((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLigne() {
    setLignes((arr) => [
      ...arr,
      { designation: "", quantite: 1, prix_unitaire: 0, taux_tva: 19.25 },
    ]);
  }
  function removeLigne(i: number) {
    setLignes((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)));
  }

  async function save(validate: boolean) {
    if (!header.exercice_id) {
      toast.error("Exercice requis");
      return;
    }
    if (header.type !== "devis" && !header.tiers_id) {
      toast.error("Sélectionnez un client");
      return;
    }
    const clean = lignes.filter(
      (l) => l.designation.trim() && Number(l.prix_unitaire) >= 0 && Number(l.quantite) > 0,
    );
    if (clean.length === 0) {
      toast.error("Ajoutez au moins une ligne");
      return;
    }
    setSaving(true);
    try {
      let factureId = header.id;
      const payload = {
        entreprise_id: entrepriseId,
        exercice_id: header.exercice_id,
        tiers_id: header.tiers_id || null,
        type: header.type,
        date_facture: header.date_facture,
        date_echeance: header.date_echeance || null,
        objet: header.objet || null,
      };
      if (mode === "create") {
        const { data, error } = await supabase
          .from("factures")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        factureId = data.id;
      } else if (factureId) {
        const { error } = await supabase.from("factures").update(payload).eq("id", factureId);
        if (error) throw error;
        await supabase.from("lignes_facture").delete().eq("facture_id", factureId);
      }

      const { error: errL } = await supabase.from("lignes_facture").insert(
        clean.map((l, idx) => ({
          facture_id: factureId!,
          entreprise_id: entrepriseId,
          ordre: idx + 1,
          designation: l.designation.trim(),
          quantite: Number(l.quantite),
          prix_unitaire: Number(l.prix_unitaire),
          taux_tva: Number(l.taux_tva),
          montant_ht: Math.round(Number(l.quantite) * Number(l.prix_unitaire) * 100) / 100,
        })),
      );
      if (errL) throw errL;

      if (validate) {
        const { error: errV } = await supabase.rpc("valider_facture", { _facture_id: factureId! });
        if (errV) throw errV;
      }

      toast.success(validate ? "Document validé" : "Brouillon enregistré");
      qc.invalidateQueries({ queryKey: ["factures"] });
      navigate({ to: "/app/ventes" as never });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function regler() {
    if (!header.id) return;
    const reste = (header.total_ttc ?? 0) - (header.montant_paye ?? 0);
    const saisie = window.prompt(
      `Montant du règlement (reste ${formatXAF(reste)}) :`,
      String(reste),
    );
    if (saisie == null) return;
    const montant = Number(saisie.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(montant) || montant <= 0) {
      toast.error("Montant invalide");
      return;
    }
    const { error } = await supabase.rpc("enregistrer_reglement", {
      _facture_id: header.id,
      _montant: montant,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Règlement enregistré");
    qc.invalidateQueries({ queryKey: ["factures"] });
    navigate({ to: "/app/ventes" as never });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {readOnly && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm flex items-center gap-2 print:hidden">
          {statutBadge(initial!.statut!)}
          <span className="text-muted-foreground">
            {TYPE_LABEL[header.type]} n°{header.numero} — document figé.
            {header.type !== "devis" && (
              <>
                {" "}
                Réglé {formatXAF(header.montant_paye ?? 0)} / {formatXAF(header.total_ttc ?? 0)}.
              </>
            )}
          </span>
        </div>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Type</Label>
            <Select
              value={header.type}
              onValueChange={(v) => setHeader({ ...header, type: v as FactureType })}
              disabled={readOnly || mode === "edit"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="devis">Devis</SelectItem>
                <SelectItem value="facture">Facture</SelectItem>
                <SelectItem value="avoir">Avoir</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Client</Label>
            <Select
              value={header.tiers_id}
              onValueChange={(v) => setHeader({ ...header, tiers_id: v })}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {tiers?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.code} — {t.raison_sociale}
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
              disabled={readOnly || mode === "edit"}
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
            <Label>Date</Label>
            <Input
              type="date"
              value={header.date_facture}
              onChange={(e) => setHeader({ ...header, date_facture: e.target.value })}
              disabled={readOnly}
            />
          </div>
          <div>
            <Label>Échéance</Label>
            <Input
              type="date"
              value={header.date_echeance}
              onChange={(e) => setHeader({ ...header, date_echeance: e.target.value })}
              disabled={readOnly}
            />
          </div>
          <div>
            <Label>Objet</Label>
            <Input
              value={header.objet}
              onChange={(e) => setHeader({ ...header, objet: e.target.value })}
              placeholder="Prestation…"
              disabled={readOnly}
            />
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">Désignation</th>
              <th className="px-3 py-2 w-[90px] text-right">Qté</th>
              <th className="px-3 py-2 w-[130px] text-right">PU HT</th>
              <th className="px-3 py-2 w-[90px] text-right">TVA %</th>
              <th className="px-3 py-2 w-[140px] text-right">Montant HT</th>
              <th className="px-3 py-2 w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const lht = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0);
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">
                    <Input
                      value={l.designation}
                      onChange={(e) => updateLigne(i, { designation: e.target.value })}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      className="text-right"
                      value={l.quantite || ""}
                      onChange={(e) => updateLigne(i, { quantite: Number(e.target.value) })}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="text-right font-mono"
                      value={l.prix_unitaire || ""}
                      onChange={(e) => updateLigne(i, { prix_unitaire: Number(e.target.value) })}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="text-right"
                      value={l.taux_tva}
                      onChange={(e) => updateLigne(i, { taux_tva: Number(e.target.value) })}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatXAF(lht)}</td>
                  <td className="px-3 py-2 text-center print:hidden">
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLigne(i)}
                        disabled={lignes.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/30">
            <tr className="border-t">
              <td colSpan={4} className="px-3 py-2">
                {!readOnly && (
                  <Button variant="outline" size="sm" onClick={addLigne} className="print:hidden">
                    <Plus className="h-3 w-3 mr-1" /> Ajouter une ligne
                  </Button>
                )}
              </td>
              <td className="px-3 py-1 text-right text-muted-foreground">Total HT</td>
              <td className="px-3 py-1 text-right font-mono">{formatXAF(totals.ht)}</td>
            </tr>
            <tr>
              <td colSpan={4}></td>
              <td className="px-3 py-1 text-right text-muted-foreground">TVA</td>
              <td className="px-3 py-1 text-right font-mono">{formatXAF(totals.tva)}</td>
            </tr>
            <tr>
              <td colSpan={4}></td>
              <td className="px-3 py-2 text-right font-semibold">Total TTC</td>
              <td className="px-3 py-2 text-right font-mono font-semibold">
                {formatXAF(totals.ttc)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <div className="flex items-center justify-end gap-2 print:hidden">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/ventes" as never })}>
          Retour
        </Button>
        {readOnly && (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimer / PDF
          </Button>
        )}
        {readOnly &&
          header.type !== "devis" &&
          initial?.statut !== "payee" &&
          initial?.statut !== "annulee" && (
            <Button variant="outline" onClick={regler}>
              <CreditCard className="h-4 w-4 mr-1" /> Enregistrer un règlement
            </Button>
          )}
        {!readOnly && (
          <>
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>
              Enregistrer brouillon
            </Button>
            <Button onClick={() => save(true)} disabled={saving}>
              <Check className="h-4 w-4 mr-1" /> Valider
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
