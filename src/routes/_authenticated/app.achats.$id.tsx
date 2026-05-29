import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { AchatForm } from "@/components/app/AchatForm";

export const Route = createFileRoute("/_authenticated/app/achats/$id")({
  component: AchatDetail,
});

function AchatDetail() {
  const { id } = Route.useParams();
  const { current } = useEntreprises();

  const { data, isLoading } = useQuery({
    queryKey: ["achat", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achats")
        .select(
          "id, tiers_id, exercice_id, date_facture, date_echeance, reference_fournisseur, objet, compte_charge_id, statut, numero, total_ttc, montant_paye, lignes_achat(designation, quantite, prix_unitaire, taux_tva, ordre)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;
  if (isLoading || !data) return <p className="text-muted-foreground p-6">Chargement…</p>;

  const lignes = [...(data.lignes_achat ?? [])]
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
    .map((l) => ({
      designation: l.designation,
      quantite: Number(l.quantite) || 0,
      prix_unitaire: Number(l.prix_unitaire) || 0,
      taux_tva: Number(l.taux_tva) || 0,
    }));

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-4">
        {data.numero != null
          ? `Facture fournisseur n°${data.numero}`
          : "Facture fournisseur (brouillon)"}
      </h1>
      <AchatForm
        entrepriseId={current.id}
        mode="edit"
        initial={{
          id: data.id,
          tiers_id: data.tiers_id ?? "",
          exercice_id: data.exercice_id,
          date_facture: data.date_facture,
          date_echeance: data.date_echeance ?? "",
          reference_fournisseur: data.reference_fournisseur ?? "",
          objet: data.objet ?? "",
          compte_charge_id: data.compte_charge_id,
          statut: data.statut,
          numero: data.numero,
          total_ttc: Number(data.total_ttc) || 0,
          montant_paye: Number(data.montant_paye) || 0,
        }}
        initialLignes={lignes}
      />
    </div>
  );
}
