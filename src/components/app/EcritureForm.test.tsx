import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Mocks des dépendances externes du formulaire -----------------------------
// Navigation : hors contexte routeur dans un test unitaire.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

// Client Supabase : chaîne de requête neutre (listes vides) + rpc stub.
vi.mock("@/integrations/supabase/client", () => {
  const qb: Record<string, unknown> = {};
  qb.select = () => qb;
  qb.eq = () => qb;
  qb.order = () => Promise.resolve({ data: [], error: null });
  return {
    supabase: {
      from: () => qb,
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { EcritureForm } from "./EcritureForm";

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EcritureForm entrepriseId="ent-1" mode="create" />
    </QueryClientProvider>,
  );
}

function getValiderButton() {
  return screen.getByRole("button", { name: /valider/i });
}

describe("EcritureForm — invariant d'équilibre comptable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("démarre en saisie vide, bouton Valider désactivé", () => {
    renderForm();
    expect(screen.getByText(/saisie en cours/i)).toBeInTheDocument();
    expect(getValiderButton()).toBeDisabled();
  });

  it("affiche « Équilibrée » et active Valider quand débit = crédit", () => {
    renderForm();
    // 2 lignes par défaut → 4 champs numériques : [d0, c0, d1, c1]
    const montants = screen.getAllByRole("spinbutton");
    expect(montants).toHaveLength(4);

    fireEvent.change(montants[0], { target: { value: "1000" } }); // débit ligne 1
    fireEvent.change(montants[3], { target: { value: "1000" } }); // crédit ligne 2

    expect(screen.getByText(/équilibrée/i)).toBeInTheDocument();
    expect(getValiderButton()).toBeEnabled();
  });

  it("affiche l'écart et bloque Valider quand débit ≠ crédit", () => {
    renderForm();
    const montants = screen.getAllByRole("spinbutton");

    fireEvent.change(montants[0], { target: { value: "1000" } }); // débit ligne 1
    fireEvent.change(montants[3], { target: { value: "600" } }); // crédit ligne 2

    expect(screen.getByText(/écart/i)).toBeInTheDocument();
    expect(getValiderButton()).toBeDisabled();
  });

  it("saisir un débit remet le crédit de la même ligne à zéro (exclusivité)", () => {
    renderForm();
    const montants = screen.getAllByRole("spinbutton");

    fireEvent.change(montants[1], { target: { value: "500" } }); // crédit ligne 1
    expect((montants[1] as HTMLInputElement).value).toBe("500");

    fireEvent.change(montants[0], { target: { value: "300" } }); // débit ligne 1
    // Le crédit de la ligne 1 doit être réinitialisé (affiché vide car 0).
    expect((montants[1] as HTMLInputElement).value).toBe("");
    expect((montants[0] as HTMLInputElement).value).toBe("300");
  });

  it("ne descend jamais en dessous de 2 lignes (suppression bloquée)", () => {
    renderForm();
    const lignesAvant = screen.getAllByRole("spinbutton").length / 2;
    expect(lignesAvant).toBe(2);
    // Les boutons de suppression (icône Trash2, sans texte) sont désactivés
    // tant qu'il ne reste que 2 lignes. On exclut « Ajouter une ligne » (texte).
    const tableau = screen.getByRole("table");
    const suppressions = within(tableau)
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg") && b.textContent?.trim() === "");
    expect(suppressions).toHaveLength(2);
    suppressions.forEach((b) => expect(b).toBeDisabled());
  });
});
