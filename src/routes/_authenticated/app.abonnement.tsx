import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAbonnement } from "@/hooks/use-abonnement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatXAF, formatDate } from "@/lib/format";
import { libelleStatut, montantDu } from "@/lib/abonnement";

export const Route = createFileRoute("/_authenticated/app/abonnement")({
  head: () => ({ meta: [{ title: "Abonnement — Kompta" }] }),
  component: AbonnementPage,
});

type Plan = {
  code: string;
  libelle: string;
  prix_mensuel: number;
  max_entreprises: number | null;
  max_utilisateurs: number | null;
  ordre: number;
};

type Paiement = {
  id: string;
  plan_code: string;
  cycle: "mensuel" | "annuel";
  montant: number;
  methode: string;
  reference: string | null;
  statut: string;
  declared_at: string;
  note: string | null;
};

const METHODES: { value: string; label: string }[] = [
  { value: "mobile_money", label: "Mobile Money" },
  { value: "virement_bancaire", label: "Virement bancaire" },
  { value: "especes", label: "Espèces" },
  { value: "autre", label: "Autre" },
];

const PAIEMENT_BADGE: Record<string, string> = {
  en_attente: "En attente",
  valide: "Validé",
  rejete: "Rejeté",
};

function AbonnementPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: abonnement } = useAbonnement();

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("code, libelle, prix_mensuel, max_entreprises, max_utilisateurs, ordre")
        .order("ordre");
      if (error) throw error;
      return data as Plan[];
    },
  });

  const { data: paiements } = useQuery({
    queryKey: ["mes-paiements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_abonnement")
        .select("id, plan_code, cycle, montant, methode, reference, statut, declared_at, note")
        .eq("owner_id", user!.id)
        .order("declared_at", { ascending: false });
      if (error) throw error;
      return data as Paiement[];
    },
  });

  const [planCode, setPlanCode] = useState("standard");
  const [cycle, setCycle] = useState<"mensuel" | "annuel">("mensuel");
  const [methode, setMethode] = useState("mobile_money");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const planChoisi = plans?.find((p) => p.code === planCode);
  const montant = planChoisi ? montantDu(planChoisi.prix_mensuel, cycle) : 0;

  async function declarer() {
    if (!planChoisi) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("declarer_paiement", {
        _plan_code: planCode,
        _cycle: cycle,
        _montant: montant,
        _methode: methode as never,
        _reference: reference || undefined,
        _note: note || undefined,
      });
      if (error) throw error;
      toast.success("Paiement déclaré. Il sera validé par notre équipe.");
      setReference("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["mes-paiements"] });
      qc.invalidateQueries({ queryKey: ["mon-abonnement"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Abonnement</h1>
        <p className="text-sm text-muted-foreground">
          Gérez votre offre et déclarez vos paiements. La validation est effectuée manuellement par
          notre équipe.
        </p>
      </div>

      {abonnement && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Offre {abonnement.plan_libelle}</CardTitle>
              <Badge variant={abonnement.peut_ecrire ? "default" : "destructive"}>
                {libelleStatut(abonnement.statut)}
              </Badge>
            </div>
            <CardDescription>
              {abonnement.en_essai
                ? `Essai gratuit — ${abonnement.jours_restants} jour(s) restant(s)`
                : abonnement.periode_fin
                  ? `Valide jusqu'au ${formatDate(abonnement.periode_fin)}`
                  : "Aucune période payée en cours"}
            </CardDescription>
          </CardHeader>
          {!abonnement.peut_ecrire && (
            <CardContent>
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                La saisie est suspendue. Vos données restent consultables et exportables ;
                choisissez une offre ci-dessous pour réactiver l'écriture.
              </p>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Déclarer un paiement</CardTitle>
          <CardDescription>
            Effectuez le règlement par votre moyen habituel, puis renseignez-le ici. Votre accès est
            réactivé dès validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Offre</Label>
              <Select value={planCode} onValueChange={setPlanCode}>
                <SelectTrigger>
                  <SelectValue placeholder="…" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.libelle} — {formatXAF(p.prix_mensuel)}/mois
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cycle</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as "mensuel" | "annuel")}>
                <SelectTrigger>
                  <SelectValue placeholder="…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensuel">Mensuel</SelectItem>
                  <SelectItem value="annuel">Annuel (2 mois offerts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Moyen de paiement</Label>
              <Select value={methode} onValueChange={setMethode}>
                <SelectTrigger>
                  <SelectValue placeholder="…" />
                </SelectTrigger>
                <SelectContent>
                  {METHODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Référence de la transaction</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="N° de transaction / bordereau"
              />
            </div>
          </div>
          <div>
            <Label>Note (optionnel)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Précisions éventuelles…"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              Montant à régler :{" "}
              <span className="font-mono font-semibold">{formatXAF(montant)}</span>
              {cycle === "annuel" && <span className="text-muted-foreground"> / an</span>}
            </div>
            <Button onClick={declarer} disabled={busy || !planChoisi}>
              <Check className="mr-1 h-4 w-4" /> Déclarer le paiement
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des paiements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {paiements && paiements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Offre</th>
                    <th className="px-3 py-2">Cycle</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2">Référence</th>
                    <th className="px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {paiements.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2">{formatDate(p.declared_at)}</td>
                      <td className="px-3 py-2">{p.plan_code}</td>
                      <td className="px-3 py-2">{p.cycle}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatXAF(p.montant)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.reference ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={p.statut === "valide" ? "default" : "outline"}>
                          {PAIEMENT_BADGE[p.statut] ?? p.statut}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">Aucun paiement déclaré.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
