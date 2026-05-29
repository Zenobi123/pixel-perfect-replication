import { createFileRoute } from "@tanstack/react-router";
import { useEntreprises } from "@/hooks/use-entreprises";
import { FactureForm } from "@/components/app/FactureForm";

export const Route = createFileRoute("/_authenticated/app/ventes/nouvelle")({
  head: () => ({ meta: [{ title: "Nouveau document — Kompta" }] }),
  component: NouvelleFacture,
});

function NouvelleFacture() {
  const { current } = useEntreprises();
  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;
  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-4">Nouveau document de vente</h1>
      <FactureForm entrepriseId={current.id} mode="create" />
    </div>
  );
}
