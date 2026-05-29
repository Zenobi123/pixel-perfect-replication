import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntreprises } from "@/hooks/use-entreprises";
import { EcritureForm } from "@/components/app/EcritureForm";
import { PiecesJointes } from "@/components/app/PiecesJointes";

export const Route = createFileRoute("/_authenticated/app/comptabilite/ecritures/$id")({
  component: EcritureDetail,
});

function EcritureDetail() {
  const { id } = Route.useParams();
  const { current } = useEntreprises();

  const { data, isLoading } = useQuery({
    queryKey: ["ecriture", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ecritures")
        .select(
          "id, journal_id, exercice_id, date_piece, reference, libelle, statut, numero, lignes_ecriture(id, compte_id, libelle, debit, credit, ordre)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!current) return <p className="text-muted-foreground">Aucune entreprise sélectionnée.</p>;
  if (isLoading || !data) return <p className="text-muted-foreground">Chargement…</p>;

  const lignes = [...(data.lignes_ecriture ?? [])]
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
    .map((l) => ({
      id: l.id,
      compte_id: l.compte_id,
      libelle: l.libelle ?? "",
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
    }));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {data.numero != null ? `Écriture n°${data.numero}` : "Écriture (brouillon)"}
      </h2>
      <EcritureForm
        entrepriseId={current.id}
        mode="edit"
        initial={{
          id: data.id,
          journal_id: data.journal_id,
          exercice_id: data.exercice_id,
          date_piece: data.date_piece,
          reference: data.reference ?? "",
          libelle: data.libelle,
          statut: data.statut,
        }}
        initialLignes={lignes}
      />
      <PiecesJointes entrepriseId={current.id} ecritureId={data.id} />
    </div>
  );
}
