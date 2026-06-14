import { describe, it, expect } from "vitest";
import { libelleStatut, montantDu, bandeauAbonnement } from "./abonnement";

describe("libelleStatut", () => {
  it("traduit les statuts connus", () => {
    expect(libelleStatut("trial")).toBe("Essai gratuit");
    expect(libelleStatut("active")).toBe("Actif");
    expect(libelleStatut("past_due")).toBe("Paiement en attente");
  });
  it("retourne la valeur brute pour un statut inconnu", () => {
    expect(libelleStatut("xyz")).toBe("xyz");
  });
});

describe("montantDu", () => {
  it("applique le tarif mensuel tel quel", () => {
    expect(montantDu(19900, "mensuel")).toBe(19900);
  });
  it("offre 2 mois sur l'annuel (×10)", () => {
    expect(montantDu(19900, "annuel")).toBe(199000);
  });
});

describe("bandeauAbonnement", () => {
  it("alerte quand l'écriture est bloquée", () => {
    const b = bandeauAbonnement({
      statut: "trial",
      en_essai: false,
      peut_ecrire: false,
      jours_restants: 0,
    });
    expect(b?.ton).toBe("alerte");
    expect(b?.texte).toMatch(/exportables/);
  });

  it("informe quand l'essai se termine bientôt", () => {
    const b = bandeauAbonnement({
      statut: "trial",
      en_essai: true,
      peut_ecrire: true,
      jours_restants: 2,
    });
    expect(b?.ton).toBe("info");
    expect(b?.texte).toMatch(/2 jour/);
  });

  it("ne signale rien quand l'abonnement est actif et confortable", () => {
    expect(
      bandeauAbonnement({
        statut: "active",
        en_essai: false,
        peut_ecrire: true,
        jours_restants: 25,
      }),
    ).toBeNull();
  });

  it("signale un paiement en attente de validation", () => {
    const b = bandeauAbonnement({
      statut: "past_due",
      en_essai: false,
      peut_ecrire: true,
      jours_restants: 0,
    });
    expect(b?.ton).toBe("info");
    expect(b?.texte).toMatch(/attente/);
  });
});
