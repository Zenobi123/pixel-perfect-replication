import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/app/tiers")({
  head: () => ({ meta: [{ title: "Tiers — Kompta" }] }),
  component: TiersPage,
});

type TiersType = "client" | "fournisseur" | "salarie" | "autre";
type Tiers = {
  id: string;
  code: string;
  type: TiersType;
  raison_sociale: string;
  niu: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  compte_id: string | null;
  actif: boolean;
};
type Compte = { id: string; numero: string; libelle: string };

const TYPE_LABEL: Record<TiersType, string> = {
  client: "Client",
  fournisseur: "Fournisseur",
  salarie: "Salarié",
  autre: "Autre",
};

const EMPTY: Omit<Tiers, "id"> = {
  code: "",
  type: "client",
  raison_sociale: "",
  niu: "",
  email: "",
  telephone: "",
  adresse: "",
  compte_id: null,
  actif: true,
};

function TiersPage() {
  const { current } = useEntreprises();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tiers | null>(null);
  const [form, setForm] = useState<Omit<Tiers, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: tiers, isLoading } = useQuery({
    queryKey: ["tiers", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Tiers[]> => {
      const { data, error } = await supabase
        .from("tiers")
        .select("id, code, type, raison_sociale, niu, email, telephone, adresse, compte_id, actif")
        .eq("entreprise_id", current!.id)
        .order("code");
      if (error) throw error;
      return data as Tiers[];
    },
  });

  const { data: comptes } = useQuery({
    queryKey: ["comptes-tiers", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Compte[]> => {
      const { data, error } = await supabase
        .from("comptes")
        .select("id, numero, libelle")
        .eq("entreprise_id", current!.id)
        .eq("classe", 4)
        .eq("actif", true)
        .order("numero");
      if (error) throw error;
      return data as Compte[];
    },
  });

  // Solde par tiers à partir des écritures validées (cahier §Module 6).
  const { data: soldes } = useQuery({
    queryKey: ["tiers-soldes", current?.id],
    enabled: !!current?.id,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from("lignes_ecriture")
        .select("tiers_id, debit, credit, ecritures!inner(statut)")
        .eq("entreprise_id", current!.id)
        .eq("ecritures.statut", "validee")
        .not("tiers_id", "is", null);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as unknown as {
        tiers_id: string;
        debit: number;
        credit: number;
      }[]) {
        map.set(r.tiers_id, (map.get(r.tiers_id) ?? 0) + Number(r.debit) - Number(r.credit));
      }
      return map;
    },
  });

  const filtered = useMemo(() => {
    let list = tiers ?? [];
    if (typeFilter !== "all") list = list.filter((t) => t.type === typeFilter);
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (t) =>
          t.code.toLowerCase().includes(q) ||
          t.raison_sociale.toLowerCase().includes(q) ||
          (t.niu ?? "").toLowerCase().includes(q),
      );
    return list;
  }, [tiers, typeFilter, search]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(t: Tiers) {
    setEditing(t);
    setForm({
      ...t,
      niu: t.niu ?? "",
      email: t.email ?? "",
      telephone: t.telephone ?? "",
      adresse: t.adresse ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!current) return;
    if (!form.code.trim() || !form.raison_sociale.trim()) {
      toast.error("Code et raison sociale sont requis");
      return;
    }
    setSaving(true);
    const payload = {
      entreprise_id: current.id,
      code: form.code.trim(),
      type: form.type,
      raison_sociale: form.raison_sociale.trim(),
      niu: form.niu || null,
      email: form.email || null,
      telephone: form.telephone || null,
      adresse: form.adresse || null,
      compte_id: form.compte_id || null,
      actif: form.actif,
    };
    const { error } = editing
      ? await supabase.from("tiers").update(payload).eq("id", editing.id)
      : await supabase.from("tiers").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Tiers modifié" : "Tiers créé");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["tiers", current.id] });
  }

  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="p-6 md:p-8 space-y-4 max-w-5xl">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tiers</h1>
          <p className="text-sm text-muted-foreground">
            Clients, fournisseurs et autres partenaires.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau tiers
        </Button>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 w-[260px]"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="client">Clients</SelectItem>
            <SelectItem value="fournisseur">Fournisseurs</SelectItem>
            <SelectItem value="salarie">Salariés</SelectItem>
            <SelectItem value="autre">Autres</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Raison sociale</th>
                <th className="px-4 py-2">NIU</th>
                <th className="px-4 py-2 text-right">Solde</th>
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Aucun tiers. Créez le premier !
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const solde = soldes?.get(t.id) ?? 0;
                  return (
                    <tr key={t.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono">{t.code}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{TYPE_LABEL[t.type]}</Badge>
                      </td>
                      <td className="px-4 py-2">{t.raison_sociale}</td>
                      <td className="px-4 py-2 text-muted-foreground">{t.niu ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatXAF(solde)}</td>
                      <td className="px-4 py-2">
                        {t.actif ? (
                          <Badge variant="secondary">Actif</Badge>
                        ) : (
                          <Badge variant="outline">Inactif</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
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
            <DialogTitle>{editing ? "Modifier le tiers" : "Nouveau tiers"}</DialogTitle>
            <DialogDescription>
              Un compte auxiliaire de classe 4 peut être rattaché pour le suivi des soldes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="CL001"
              />
            </div>
            <div>
              <Label>Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as TiersType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="fournisseur">Fournisseur</SelectItem>
                  <SelectItem value="salarie">Salarié</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Raison sociale *</Label>
              <Input
                value={form.raison_sociale}
                onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })}
                placeholder="Ex. SOCIÉTÉ ALPHA SARL"
              />
            </div>
            <div>
              <Label>NIU</Label>
              <Input
                value={form.niu ?? ""}
                onChange={(e) => setForm({ ...form, niu: e.target.value })}
              />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input
                value={form.telephone ?? ""}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Adresse</Label>
              <Input
                value={form.adresse ?? ""}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Compte auxiliaire (classe 4)</Label>
              <Select
                value={form.compte_id ?? "none"}
                onValueChange={(v) => setForm({ ...form, compte_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {comptes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-mono mr-2">{c.numero}</span>
                      {c.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch
                checked={form.actif}
                onCheckedChange={(v) => setForm({ ...form, actif: v })}
              />
              <Label>Actif</Label>
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
