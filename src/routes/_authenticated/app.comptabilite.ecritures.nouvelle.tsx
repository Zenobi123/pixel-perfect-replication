import { createFileRoute } from "@tanstack/react-router";
import { useEntreprises } from "@/hooks/use-entreprises";
import { EcritureForm } from "@/components/app/EcritureForm";

export const Route = createFileRoute("/_authenticated/app/comptabilite/ecritures/nouvelle")({
  component: NouvelleEcriture,
});

function NouvelleEcriture() {
  const { current } = useEntreprises();
  if (!current) return <p className="text-muted-foreground">Aucune entreprise sélectionnée.</p>;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Nouvelle écriture</h2>
      <EcritureForm entrepriseId={current.id} mode="create" />
    </div>
  );
}
