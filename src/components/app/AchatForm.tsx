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

type AchatStatut = "brouillon" | "validee" | "partiellement_payee" | "payee" | "annulee";
type Tiers = { id: string; code: string; raison_sociale: string };
type Exercice = { id: string; libelle: string };
type Compte = { id: string; numero: string; libelle: string };
type Ligne = { designation: string; quantite: number; prix_unitaire: number; taux_tva: number };

export type AchatHeader = {
  id?: string;
  tiers_id: string;
  exercice_id: string;
  date_facture: string;
  date_echeance: string;
  reference_fournisseur: string;
  objet: string;
  compte_charge_id: string | null;
  statut?: AchatStatut;
  numero?: number | null;
  total_ttc?: number;
  montant_paye?: number;
};

function statutBadge(s: AchatStatut) {
  const map: Record<
    AchatStatut,
    { label: string; variant?: "secondary" | "outline" | "destructive" }
  > = {
    brouillon: { label: "Brouillon", variant: "secondary" },
    validee: { label: "Validée" },
    partiellement_payee: { label: "Partiellement payée", variant: "outline" },
    payee: { label: "Payée" },
    annulee: { label: "Annulée", variant: "destructive" },
  };
  const c = map[s];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function AchatForm({
  entrepriseId,
  initial,
  initialLignes,
  mode,
}: {
  entrepriseId: string;
  initial?: AchatHeader;
  initialLignes?: Ligne[];
  mode: "create" | "edit";
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const readOnly = !!initial?.statut && initial.statut !== "brouillon";

  const [header, setHeader] = useState<AchatHeader>(
    initial ?? {
      tiers_id: "",
      exercice_id: "",
      date_facture: new Date().toISOString().slice(0, 10),
      date_echeance: "",
      reference_fournisseur: "",
      objet: "",
      compte_charge_id: null,
    },
  );
  const [lignes, setLignes] = useState<Ligne[]>(
    initialLignes ?? [{ designation: "", quantite: 1, prix_unitaire: 0, taux_tva: 19.25 }],
  );
  const [saving, setSaving] = useState(false);

  const { data: fournisseurs } = useQuery({
    queryKey: ["tiers-fournisseurs", entrepriseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tiers")
        .select("id, code, raison_sociale")
        .eq("entreprise_id", entrepriseId)
        .eq("type", "fournisseur")
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

  const { data: charges } = useQuery({
    queryKey: ["comptes-charges", entrepriseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comptes")
        .select("id, numero, libelle")
        .eq("entreprise_id", entrepriseId)
        .eq("classe", 6)
        .eq("actif", true)
        .order("numero");
      if (error) throw error;
      return data as Compte[];
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
    if (!header.tiers_id) {
      toast.error("Sélectionnez un fournisseur");
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
      let achatId = header.id;
      const payload = {
        entreprise_id: entrepriseId,
        exercice_id: header.exercice_id,
        tiers_id: header.tiers_id || null,
        date_facture: header.date_facture,
        date_echeance: header.date_echeance || null,
        reference_fournisseur: header.reference_fournisseur || null,
        objet: header.objet || null,
        compte_charge_id: header.compte_charge_id || null,
      };
      if (mode === "create") {
        const { data, error } = await supabase.from("achats").insert(payload).select("id").single();
        if (error) throw error;
        achatId = data.id;
      } else if (achatId) {
        const { error } = await supabase.from("achats").update(payload).eq("id", achatId);
        if (error) throw error;
        await supabase.from("lignes_achat").delete().eq("achat_id", achatId);
      }

      const { error: errL } = await supabase.from("lignes_achat").insert(
        clean.map((l, idx) => ({
          achat_id: achatId!,
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
        const { error: errV } = await supabase.rpc("valider_achat", { _achat_id: achatId! });
        if (errV) throw errV;
      }

      toast.success(validate ? "Facture fournisseur validée" : "Brouillon enregistré");
      qc.invalidateQueries({ queryKey: ["achats"] });
      navigate({ to: "/app/achats" as never });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function payer() {
    if (!header.id) return;
    const reste = (header.total_ttc ?? 0) - (header.montant_paye ?? 0);
    const saisie = window.prompt(
      `Montant du paiement (reste ${formatXAF(reste)}) :`,
      String(reste),
    );
    if (saisie == null) return;
    const montant = Number(saisie.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(montant) || montant <= 0) {
      toast.error("Montant invalide");
      return;
    }
    const { error } = await supabase.rpc("enregistrer_paiement_achat", {
      _achat_id: header.id,
      _montant: montant,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Paiement enregistré");
    qc.invalidateQueries({ queryKey: ["achats"] });
    navigate({ to: "/app/achats" as never });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {readOnly && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm flex items-center gap-2 print:hidden">
          {statutBadge(initial!.statut!)}
          <span className="text-muted-foreground">
            Facture fournisseur n°{header.numero} — document figé. Payé{" "}
            {formatXAF(header.montant_paye ?? 0)} / {formatXAF(header.total_ttc ?? 0)}.
          </span>
        </div>
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Fournisseur</Label>
            <Select
              value={header.tiers_id}
              onValueChange={(v) => setHeader({ ...header, tiers_id: v })}
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {fournisseurs?.map((t) => (
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
            <Label>N° facture fournisseur</Label>
            <Input
              value={header.reference_fournisseur}
              onChange={(e) => setHeader({ ...header, reference_fournisseur: e.target.value })}
              placeholder="FF-2026-001"
              disabled={readOnly}
            />
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
            <Label>Compte de charge</Label>
            <Select
              value={header.compte_charge_id ?? "auto"}
              onValueChange={(v) =>
                setHeader({ ...header, compte_charge_id: v === "auto" ? null : v })
              }
              disabled={readOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Automatique" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatique (60…)</SelectItem>
                {charges?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="font-mono mr-2">{c.numero}</span>
                    {c.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label>Objet</Label>
            <Input
              value={header.objet}
              onChange={(e) => setHeader({ ...header, objet: e.target.value })}
              placeholder="Fournitures de bureau…"
              disabled={readOnly}
            />
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
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
        <Button variant="ghost" onClick={() => navigate({ to: "/app/achats" as never })}>
          Retour
        </Button>
        {readOnly && (
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimer / PDF
          </Button>
        )}
        {readOnly && initial?.statut !== "payee" && initial?.statut !== "annulee" && (
          <Button variant="outline" onClick={payer}>
            <CreditCard className="h-4 w-4 mr-1" /> Enregistrer un paiement
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
