import { createFileRoute } from "@tanstack/react-router";
import { useEntreprises } from "@/hooks/use-entreprises";
import { AchatForm } from "@/components/app/AchatForm";

export const Route = createFileRoute("/_authenticated/app/achats/nouvelle")({
  head: () => ({ meta: [{ title: "Nouvelle facture fournisseur — Kompta" }] }),
  component: NouvelAchat,
});

function NouvelAchat() {
  const { current } = useEntreprises();
  if (!current) return <p className="text-muted-foreground p-6">Aucune entreprise sélectionnée.</p>;
  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-4">Nouvelle facture fournisseur</h1>
      <AchatForm entrepriseId={current.id} mode="create" />
    </div>
  );
}
