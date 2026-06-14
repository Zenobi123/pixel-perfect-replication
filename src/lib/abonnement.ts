// Logique pure d'abonnement (libellés, calculs d'affichage). Sans React ni
// I/O : testable isolément. La source de vérité de l'accès reste la RPC
// `mon_abonnement` côté serveur (champ `peut_ecrire`).

export type AbonnementStatut =
  | "trial"
  | "active"
  | "past_due"
  | "grace_period"
  | "suspended"
  | "cancelled"
  | "archived";

export type AbonnementEtat = {
  id: string;
  plan_code: string;
  plan_libelle: string;
  prix_mensuel: number;
  statut: AbonnementStatut;
  cycle: "mensuel" | "annuel";
  trial_fin: string | null;
  periode_fin: string | null;
  en_essai: boolean;
  peut_ecrire: boolean;
  jours_restants: number;
};

export const STATUT_LIBELLE: Record<AbonnementStatut, string> = {
  trial: "Essai gratuit",
  active: "Actif",
  past_due: "Paiement en attente",
  grace_period: "Période de grâce",
  suspended: "Suspendu",
  cancelled: "Résilié",
  archived: "Archivé",
};

export function libelleStatut(statut: string): string {
  return STATUT_LIBELLE[statut as AbonnementStatut] ?? statut;
}

/** Montant dû selon l'offre et le cycle : l'annuel offre 2 mois (≈ ×10). */
export function montantDu(prixMensuel: number, cycle: "mensuel" | "annuel"): number {
  return cycle === "annuel" ? prixMensuel * 10 : prixMensuel;
}

/**
 * Message à afficher dans le bandeau global, ou null si rien à signaler.
 * Sert à inciter au paiement sans bloquer l'accès en lecture.
 */
export function bandeauAbonnement(
  etat: Pick<AbonnementEtat, "statut" | "en_essai" | "peut_ecrire" | "jours_restants">,
): { ton: "info" | "alerte"; texte: string } | null {
  if (!etat.peut_ecrire) {
    return {
      ton: "alerte",
      texte:
        etat.statut === "trial"
          ? "Votre essai gratuit est terminé. La saisie est suspendue jusqu'au paiement ; vos données restent consultables et exportables."
          : "Abonnement inactif : la saisie est suspendue jusqu'au paiement. Vos données restent consultables et exportables.",
    };
  }
  if (etat.en_essai && etat.jours_restants <= 3) {
    return {
      ton: "info",
      texte: `Essai gratuit : ${etat.jours_restants} jour(s) restant(s). Choisissez une offre pour continuer sans interruption.`,
    };
  }
  if (etat.statut === "past_due") {
    return { ton: "info", texte: "Paiement en attente de validation par notre équipe." };
  }
  return null;
}
