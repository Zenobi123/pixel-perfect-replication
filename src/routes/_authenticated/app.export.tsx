import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Archive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { downloadCsv, downloadJson } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/app/export")({
  head: () => ({ meta: [{ title: "Sauvegarde & export — Kompta" }] }),
  component: ExportPage,
});

// Export client par entreprise (cahier v1.1, §Disponibilité « à livrer dès le
// MVP », Module 18, critère d'acceptation global n°15). Filet de sécurité
// indépendant du plan d'hébergement : l'utilisateur peut récupérer l'intégralité
// de ses données comptables à tout moment, y compris abonnement suspendu.
function ExportPage() {
  const { current } = useEntreprises();
  const [busy, setBusy] = useState(false);

  async function fetchAll<T>(table: string): Promise<T[]> {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .eq("entreprise_id", current!.id);
    if (error) throw error;
    return (data ?? []) as T[];
  }

  async function sauvegardeComplete() {
    if (!current) return;
    setBusy(true);
    try {
      const [exercices, periodes, comptes, journaux, tiers, ecritures, lignes, documents] =
        await Promise.all([
          fetchAll("exercices"),
          fetchAll("periodes"),
          fetchAll("comptes"),
          fetchAll("journaux"),
          fetchAll("tiers"),
          fetchAll("ecritures"),
          fetchAll("lignes_ecriture"),
          fetchAll("documents"),
        ]);
      downloadJson(`sauvegarde_${current.raison_sociale.replace(/[^\w]+/g, "_")}_${today()}`, {
        meta: {
          genere_le: new Date().toISOString(),
          entreprise: current.raison_sociale,
          entreprise_id: current.id,
          format: "kompta-backup-v1",
        },
        exercices,
        periodes,
        comptes,
        journaux,
        tiers,
        ecritures,
        lignes_ecriture: lignes,
        documents, // métadonnées seulement (les fichiers restent dans le bucket privé)
      });
      toast.success("Sauvegarde complète générée");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function exportComptes() {
    if (!current) return;
    const comptes = await fetchAll<{
      numero: string;
      libelle: string;
      classe: number;
      sens: string;
      actif: boolean;
    }>("comptes");
    downloadCsv(
      `plan_comptable_${today()}`,
      ["Numéro", "Libellé", "Classe", "Sens", "Actif"],
      comptes
        .sort((a, b) => a.numero.localeCompare(b.numero))
        .map((c) => [c.numero, c.libelle, c.classe, c.sens, c.actif ? "oui" : "non"]),
    );
  }

  async function exportTiers() {
    if (!current) return;
    const tiers = await fetchAll<{
      code: string;
      type: string;
      raison_sociale: string;
      niu: string | null;
      email: string | null;
      telephone: string | null;
    }>("tiers");
    downloadCsv(
      `tiers_${today()}`,
      ["Code", "Type", "Raison sociale", "NIU", "Email", "Téléphone"],
      tiers.map((t) => [t.code, t.type, t.raison_sociale, t.niu, t.email, t.telephone]),
    );
  }

  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sauvegarde & export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Récupérez à tout moment l'intégralité des données de{" "}
          <strong>{current.raison_sociale}</strong>. Cet export reste disponible même si
          l'abonnement est suspendu.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" /> Sauvegarde complète (JSON)
          </CardTitle>
          <CardDescription>
            Exercices, périodes, plan comptable, journaux, tiers, écritures, lignes et métadonnées
            documentaires dans un seul fichier réimportable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={sauvegardeComplete} disabled={busy}>
            <Download className="h-4 w-4 mr-1" />{" "}
            {busy ? "Génération…" : "Télécharger la sauvegarde"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exports CSV</CardTitle>
          <CardDescription>Fichiers tableurs (compatibles Excel) par domaine.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportComptes}>
            <Download className="h-4 w-4 mr-1" /> Plan comptable
          </Button>
          <Button variant="outline" onClick={exportTiers}>
            <Download className="h-4 w-4 mr-1" /> Tiers
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
