import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Créer votre entreprise — Kompta" }] }),
  component: Onboarding,
});

type Regime = "reel" | "simplifie" | "liberatoire" | "non_assujetti";

function Onboarding() {
  const navigate = useNavigate();
  const [raisonSociale, setRaisonSociale] = useState("");
  const [niu, setNiu] = useState("");
  const [regime, setRegime] = useState<Regime>("reel");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.rpc("create_entreprise_with_owner", {
      _raison_sociale: raisonSociale,
      _niu: niu || null,
      _regime: regime,
      _devise: "XAF",
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data && typeof window !== "undefined") {
      localStorage.setItem("kompta.current_entreprise_id", data as string);
    }
    toast.success("Entreprise créée");
    navigate({ to: "/app" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Créez votre première entreprise</CardTitle>
          <CardDescription>
            Quelques informations pour démarrer votre comptabilité OHADA. Vous pourrez ajuster tout cela ensuite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="rs">Raison sociale *</Label>
              <Input id="rs" required value={raisonSociale} onChange={(e) => setRaisonSociale(e.target.value)} placeholder="Ex. KOMPTA SARL" />
            </div>
            <div>
              <Label htmlFor="niu">NIU (Numéro d'Identifiant Unique)</Label>
              <Input id="niu" value={niu} onChange={(e) => setNiu(e.target.value)} placeholder="Optionnel" />
            </div>
            <div>
              <Label htmlFor="regime">Régime fiscal *</Label>
              <Select value={regime} onValueChange={(v) => setRegime(v as Regime)}>
                <SelectTrigger id="regime"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reel">Régime du réel</SelectItem>
                  <SelectItem value="simplifie">Régime simplifié</SelectItem>
                  <SelectItem value="liberatoire">Impôt libératoire</SelectItem>
                  <SelectItem value="non_assujetti">Non assujetti</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Devise : XAF (FCFA). Un exercice comptable couvrant l'année en cours sera créé automatiquement.
            </p>
            <Button type="submit" className="w-full" disabled={loading || !raisonSociale}>
              {loading ? "Création…" : "Créer mon entreprise"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
