
# Plan de construction — SaaS comptable OHADA (Cameroun)

Le cahier des charges couvre 20 modules métier + un moteur fiscal paramétrable. C'est un produit de niveau ERP, irréalisable en un seul jet. Je propose 6 phases livrables, chacune utilisable en l'état. Vous validez phase par phase.

## Stack retenue (conforme au cahier)

- **Frontend** : TanStack Start (React + Vite + SSR), Tailwind CSS, shadcn/ui — direction visuelle "fintech moderne sobre" (inspiration Qonto / Pennylane).
- **Backend** : Lovable Cloud (Postgres + Auth + Storage + Edge), RLS multi-tenant stricte par `entreprise_id`.
- **Rôles** : table `user_roles` séparée + fonction `has_role` SECURITY DEFINER (jamais de rôle dans `profiles`).
- **Moteur fiscal** : règles versionnées en base (taux, seuils, formules), JAMAIS codées en dur.
- **Paiements abonnement** : Stripe (CB internationale) + à terme Mobile Money via prestataire local.

## Phase 1 — Landing publique + identité produit (livrable immédiat)

But : avoir une vitrine commerciale crédible, prête à collecter les premiers inscrits.

- Pages : `/` (hero + value prop OHADA), `/fonctionnalites`, `/tarifs` (4 offres : Essentiel / Standard / Professionnel / Cabinet — mensuel & annuel avec -2 mois), `/cabinets`, `/contact`, `/legal`.
- Design system complet (tokens oklch, typo, composants) — base de tout le reste.
- SEO : meta par route, sitemap.xml, robots.txt, JSON-LD Organization.
- CTA inscription qui pointera vers l'app phase 2.

## Phase 2 — Socle SaaS multi-tenant (P0 partie 1)

- Auth email/password + Google (via broker Lovable).
- Modèle de données : `entreprises`, `memberships` (user ↔ entreprise + rôle), `user_roles`, `exercices`, `periodes`, `audit_log`.
- RLS sur **toutes** les tables, scoped par `entreprise_id` via memberships.
- Onboarding : création entreprise (raison sociale, NIU, régime fiscal, devise XAF, exercice).
- Sélecteur d'entreprise + switch de contexte (cabinet = multi-dossiers).
- Abonnement basique : essai 14 j, état `actif/suspendu/expiré`, page facturation (Stripe checkout, sans Mobile Money pour l'instant).
- Audit trail global.

## Phase 3 — Cœur comptable (P0 partie 2)

- Plan comptable OHADA pré-rempli (classes 1 à 9), personnalisable par entreprise.
- Journaux (achats, ventes, banque, caisse, OD, à-nouveaux).
- Saisie d'écritures équilibrée (débit = crédit, contrôle bloquant), brouillard / validation / clôture.
- Pièces jointes (Storage) sur chaque écriture.
- Restitutions : journal, grand livre, balance générale, balance auxiliaire — export PDF & Excel.
- Contrepassation, lettrage manuel, numérotation auto par journal.
- Tiers (clients / fournisseurs / autres) avec comptes auxiliaires.

## Phase 4 — Ventes / Achats / Trésorerie (P1)

- Facturation ventes : devis → facture → avoir, génération PDF, numérotation légale, écriture comptable automatique, suivi règlements.
- Achats : facture fournisseur, ventilation analytique simple, écriture auto.
- Trésorerie : banques + caisses, saisie mouvements, rapprochement bancaire basique, import relevé CSV/OFX.
- Mobile Money : type de compte dédié (intégration API reportée P6).
- Tableau de bord dirigeant : CA, trésorerie, créances/dettes, top clients.

## Phase 5 — Fiscalité paramétrable + DSF de base (P1/P2)

- Moteur de règles fiscales versionnées (TVA 19,25 %, IS, IRPP/TPF, droits d'accises, etc. — saisis par admin, pas codés).
- Échéancier fiscal automatique avec rappels.
- Préparation des déclarations périodiques (DSV TVA, acomptes).
- DSF préparatoire : génération des états financiers SYSCOHADA (bilan, compte de résultat, TAFIRE simplifié) + contrôles de cohérence.
- Exports normalisés.

## Phase 6 — Modules avancés (P2/P3)

- Immobilisations & amortissements (linéaire / dégressif).
- Stocks & inventaires (CMUP / PEPS).
- Rapprochement bancaire avancé, intégration Mobile Money (Orange Money / MTN MoMo via agrégateur).
- Portail cabinet enrichi (vue consolidée multi-dossiers, workflow révision).
- Paie OHADA (module à part).
- Notifications SMS, API publique, OCR factures (LLM via Lovable AI Gateway).

## Détails techniques transverses (toutes phases)

- Numérotation : compteurs par journal × exercice, transactionnels.
- Devise : XAF par défaut, support multi-devise au niveau écriture (conversion historisée).
- Rétention : registres comptables conservés 10 ans (exigence OHADA) — pas de suppression hard, soft delete + archive.
- Sécurité : RLS testée par scripts de recette, audit trail immuable (append-only via trigger), 2FA admin.
- Performance : pagination serveur pour grand livre / balance ; vues matérialisées pour tableaux de bord.

## Ce que je propose de faire maintenant

Démarrer **Phase 1** (landing + design system) — c'est rapide, visible, et pose les fondations visuelles de tout le produit. Une fois validée, j'active Lovable Cloud et j'enchaîne Phase 2.

Validez-vous ce découpage ? Souhaitez-vous ajuster les priorités (par ex. démarrer directement par la Phase 2 si la landing n'est pas urgente) ?
