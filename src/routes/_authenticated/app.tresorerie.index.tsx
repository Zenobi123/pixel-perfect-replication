import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, ArrowRightLeft, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatXAF } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/tresorerie/")({
  head: () => ({ meta: [{ title: "Trésorerie — Kompta" }] }),
  component: TresoreriePage,
});

type TresorerieType = "banque" | "caisse" | "mobile_money" | "autre";
type MouvType = "encaissement" | "decaissement" | "transfert";
type CompteTreso = {
  id: string;
  libelle: string;
  type: TresorerieType;
  compte_id: string;
  solde_initial: number;
  actif: boolean;
};
type Compte = { id: string; numero: string; libelle: string; classe: number };
type Tiers = { id: string; code: string; raison_sociale: string };
type Exercice = { id: string; libelle: string };

const TYPE_LABEL: Record<TresorerieType, string> = {
  banque: "Banque",
  caisse: "Caisse",
  mobile_money: "Mobile Money",
  autre: "Autre",
};

function TresoreriePage() {
  const { current } = useEntreprises();
  const qc = useQueryClient();
  const [openCompte, setOpenCompte] = useState(false);
  const [openMouv, setOpenMouv] = useState(false);
  const [saving, setSaving] = useState(false);

  const [compteForm, setCompteForm] = useState({
    libelle: "",
    type: "banque" as TresorerieType,
    compte_id: "",
    solde_initial: 0,
  });
  const [mouvForm, setMouvForm] = useState({
    compte_tresorerie_id: "",
    type: "encaissement" as MouvType,
    date: new Date().toISOString().slice(0, 10),
    libelle: "",
    montant: 0,
    contrepartie_compte_id: "",
    tiers_id: "",
    compte_tresorerie_dest_id: "",
    exercice_id: "",
  });

  const { data: comptesTreso } = useQuery({
    queryKey: ["comptes-tresorerie", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<CompteTreso[]> => {
      const { data, error } = await supabase
        .from("comptes_tresorerie")
        .select("id, libelle, type, compte_id, solde_initial, actif")
        .eq("entreprise_id", current!.id)
        .order("libelle");
      if (error) throw error;
      return data as CompteTreso[];
    },
  });

  const { data: comptes } = useQuery({
    queryKey: ["comptes-all", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Compte[]> => {
      const { data, error } = await supabase
        .from("comptes")
        .select("id, numero, libelle, classe")
        .eq("entreprise_id", current!.id)
        .eq("actif", true)
        .order("numero");
      if (error) throw error;
      return data as Compte[];
    },
  });

  const { data: tiers } = useQuery({
    queryKey: ["tiers-all", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Tiers[]> => {
      const { data, error } = await supabase
        .from("tiers")
        .select("id, code, raison_sociale")
        .eq("entreprise_id", current!.id)
        .eq("actif", true)
        .order("code");
      if (error) throw error;
      return data as Tiers[];
    },
  });

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

  // Soldes = solde initial + mouvements validés sur le compte de classe 5 lié.
  const { data: soldes } = useQuery({
    queryKey: ["tresorerie-soldes", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from("lignes_ecriture")
        .select("compte_id, debit, credit, ecritures!inner(statut)")
        .eq("entreprise_id", current!.id)
        .eq("ecritures.statut", "validee");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as unknown as {
        compte_id: string;
        debit: number;
        credit: number;
      }[]) {
        map.set(r.compte_id, (map.get(r.compte_id) ?? 0) + Number(r.debit) - Number(r.credit));
      }
      return map;
    },
  });

  useEffect(() => {
    if (!mouvForm.exercice_id && exercices?.[0])
      setMouvForm((f) => ({ ...f, exercice_id: exercices[0].id }));
  }, [exercices, mouvForm.exercice_id]);

  const comptes5 = (comptes ?? []).filter((c) => c.classe === 5);

  async function saveCompte() {
    if (!current) return;
    if (!compteForm.libelle.trim() || !compteForm.compte_id) {
      toast.error("Libellé et compte comptable requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("comptes_tresorerie").insert({
      entreprise_id: current.id,
      libelle: compteForm.libelle.trim(),
      type: compteForm.type,
      compte_id: compteForm.compte_id,
      solde_initial: Number(compteForm.solde_initial) || 0,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Compte de trésorerie créé");
    setOpenCompte(false);
    setCompteForm({ libelle: "", type: "banque", compte_id: "", solde_initial: 0 });
    qc.invalidateQueries({ queryKey: ["comptes-tresorerie", current.id] });
  }

  async function saveMouv() {
    if (!current) return;
    if (!mouvForm.compte_tresorerie_id || !mouvForm.exercice_id) {
      toast.error("Compte de trésorerie et exercice requis");
      return;
    }
    if (!mouvForm.libelle.trim() || Number(mouvForm.montant) <= 0) {
      toast.error("Libellé et montant (> 0) requis");
      return;
    }
    if (mouvForm.type !== "transfert" && !mouvForm.contrepartie_compte_id) {
      toast.error("Compte de contrepartie requis");
      return;
    }
    if (mouvForm.type === "transfert" && !mouvForm.compte_tresorerie_dest_id) {
      toast.error("Compte de destination requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("enregistrer_mouvement_tresorerie", {
      _compte_tresorerie_id: mouvForm.compte_tresorerie_id,
      _exercice_id: mouvForm.exercice_id,
      _type: mouvForm.type,
      _date: mouvForm.date,
      _libelle: mouvForm.libelle.trim(),
      _montant: Number(mouvForm.montant),
      _contrepartie_compte_id:
        mouvForm.type === "transfert" ? undefined : mouvForm.contrepartie_compte_id,
      _tiers_id: mouvForm.tiers_id || undefined,
      _compte_tresorerie_dest_id:
        mouvForm.type === "transfert" ? mouvForm.compte_tresorerie_dest_id : undefined,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mouvement enregistré");
    setOpenMouv(false);
    setMouvForm((f) => ({
      ...f,
      libelle: "",
      montant: 0,
      contrepartie_compte_id: "",
      tiers_id: "",
      compte_tresorerie_dest_id: "",
    }));
    qc.invalidateQueries({ queryKey: ["tresorerie-soldes", current.id] });
    qc.invalidateQueries({ queryKey: ["mouvements-tresorerie"] });
  }

  function soldeOf(ct: CompteTreso) {
    return Number(ct.solde_initial) + (soldes?.get(ct.compte_id) ?? 0);
  }

  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-5xl">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trésorerie</h1>
          <p className="text-sm text-muted-foreground">Banques, caisses et Mobile Money.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenCompte(true)}>
            <Plus className="h-4 w-4 mr-1" /> Compte
          </Button>
          <Button onClick={() => setOpenMouv(true)} disabled={(comptesTreso?.length ?? 0) === 0}>
            <ArrowRightLeft className="h-4 w-4 mr-1" /> Mouvement
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {comptesTreso?.length === 0 ? (
          <p className="text-muted-foreground col-span-full">
            Aucun compte de trésorerie. Créez une banque ou une caisse.
          </p>
        ) : (
          comptesTreso?.map((ct) => (
            <Link key={ct.id} to={"/app/tresorerie/$id" as never} params={{ id: ct.id } as never}>
              <Card className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    {ct.libelle}
                  </span>
                  <Badge variant="outline">{TYPE_LABEL[ct.type]}</Badge>
                </div>
                <div className="text-2xl font-bold mt-3 font-mono">{formatXAF(soldeOf(ct))}</div>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Dialog nouveau compte */}
      <Dialog open={openCompte} onOpenChange={setOpenCompte}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau compte de trésorerie</DialogTitle>
            <DialogDescription>
              Rattachez-le à un compte comptable de classe 5 (trésorerie).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Libellé</Label>
              <Input
                value={compteForm.libelle}
                onChange={(e) => setCompteForm({ ...compteForm, libelle: e.target.value })}
                placeholder="Banque Afriland"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={compteForm.type}
                onValueChange={(v) => setCompteForm({ ...compteForm, type: v as TresorerieType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banque">Banque</SelectItem>
                  <SelectItem value="caisse">Caisse</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Compte comptable (classe 5)</Label>
              <Select
                value={compteForm.compte_id}
                onValueChange={(v) => setCompteForm({ ...compteForm, compte_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {comptes5.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-mono mr-2">{c.numero}</span>
                      {c.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Solde initial</Label>
              <Input
                type="number"
                step="0.01"
                value={compteForm.solde_initial || ""}
                onChange={(e) =>
                  setCompteForm({ ...compteForm, solde_initial: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCompte(false)}>
              Annuler
            </Button>
            <Button onClick={saveCompte} disabled={saving}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nouveau mouvement */}
      <Dialog open={openMouv} onOpenChange={setOpenMouv}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau mouvement</DialogTitle>
            <DialogDescription>
              Génère automatiquement une écriture équilibrée sur le compte de trésorerie.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Compte</Label>
              <Select
                value={mouvForm.compte_tresorerie_id}
                onValueChange={(v) => setMouvForm({ ...mouvForm, compte_tresorerie_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="…" />
                </SelectTrigger>
                <SelectContent>
                  {comptesTreso?.map((ct) => (
                    <SelectItem key={ct.id} value={ct.id}>
                      {ct.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={mouvForm.type}
                onValueChange={(v) => setMouvForm({ ...mouvForm, type: v as MouvType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="encaissement">Encaissement</SelectItem>
                  <SelectItem value="decaissement">Décaissement</SelectItem>
                  <SelectItem value="transfert">Transfert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={mouvForm.date}
                onChange={(e) => setMouvForm({ ...mouvForm, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Montant</Label>
              <Input
                type="number"
                step="0.01"
                value={mouvForm.montant || ""}
                onChange={(e) => setMouvForm({ ...mouvForm, montant: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <Label>Libellé</Label>
              <Input
                value={mouvForm.libelle}
                onChange={(e) => setMouvForm({ ...mouvForm, libelle: e.target.value })}
                placeholder="Règlement client, retrait, virement…"
              />
            </div>

            {mouvForm.type === "transfert" ? (
              <div className="col-span-2">
                <Label>Compte de destination</Label>
                <Select
                  value={mouvForm.compte_tresorerie_dest_id}
                  onValueChange={(v) => setMouvForm({ ...mouvForm, compte_tresorerie_dest_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="…" />
                  </SelectTrigger>
                  <SelectContent>
                    {comptesTreso
                      ?.filter((ct) => ct.id !== mouvForm.compte_tresorerie_id)
                      .map((ct) => (
                        <SelectItem key={ct.id} value={ct.id}>
                          {ct.libelle}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div>
                  <Label>Compte de contrepartie</Label>
                  <Select
                    value={mouvForm.contrepartie_compte_id}
                    onValueChange={(v) => setMouvForm({ ...mouvForm, contrepartie_compte_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="…" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {comptes
                        ?.filter((c) => c.classe !== 5)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="font-mono mr-2">{c.numero}</span>
                            {c.libelle}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tiers (optionnel)</Label>
                  <Select
                    value={mouvForm.tiers_id || "none"}
                    onValueChange={(v) =>
                      setMouvForm({ ...mouvForm, tiers_id: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aucun" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {tiers?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.code} — {t.raison_sociale}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenMouv(false)}>
              Annuler
            </Button>
            <Button onClick={saveMouv} disabled={saving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
