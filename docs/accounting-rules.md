# Règles du moteur comptable

Document de référence pour les règles comptables implémentées, conformément au
cahier des charges v1.1 (SYSCOHADA révisé / OHADA).

## Partie double et validation

Une écriture appartient à une entreprise, un exercice et un journal. Elle
comporte au moins deux lignes, chaque ligne portant soit un débit, soit un
crédit (jamais les deux), en `numeric(18,2)` — jamais en `float`.

La fonction `validate_ecriture(_ecriture_id)` (SECURITY DEFINER) applique les
contrôles bloquants avant comptabilisation :

1. droits de l'utilisateur (`owner`/`admin`/`comptable`) ;
2. statut courant = `brouillon` ;
3. au moins 2 lignes ;
4. **total débit = total crédit** (comparaison de `numeric`) ;
5. montant non nul.

Une écriture validée devient immuable (les politiques RLS interdisent
`UPDATE`/`DELETE` hors statut `brouillon`). Toute correction passe par
`contrepasser_ecriture`, qui génère l'écriture inverse et lie les deux.

## Numérotation atomique (à la validation)

Migration : `supabase/migrations/20260529120000_numerotation_atomique_ecritures.sql`.

- Le numéro **n'est attribué qu'à la validation**, jamais en brouillon (un
  brouillon abandonné ne consomme donc aucun numéro). La colonne
  `ecritures.numero` est nullable ; un index unique partiel
  (`uq_ecritures_numero`) garantit l'unicité des numéros attribués.
- L'attribution est **atomique** : `attribuer_numero_ecriture` réalise un
  `INSERT … ON CONFLICT DO UPDATE` sur la table `compteurs_ecriture`
  (clé `entreprise_id, exercice_id, journal_id`). Le verrou de ligne pris par
  l'upsert sérialise deux validations concurrentes → numéros **distincts et
  consécutifs**, sans doublon ni trou (test de recette « validations
  simultanées »).
- La fonction `attribuer_numero_ecriture` est interne (droits révoqués pour
  `public`/`anon`/`authenticated`) : elle n'est appelable que depuis les
  fonctions SECURITY DEFINER `validate_ecriture` et `contrepasser_ecriture`.
- Au déploiement, les compteurs sont amorcés depuis le `max(numero)` existant
  par (entreprise, exercice, journal) pour ne jamais réémettre un numéro.

## Périodes et clôtures

Migration : `supabase/migrations/20260529140000_periodes_verrouillage_cloture.sql`.

Chaque exercice est découpé en **périodes mensuelles** (`generer_periodes`,
idempotente ; générées aussi à l'onboarding). États possibles :
`ouverte → en_revue → verrouillee → cloturee`, avec transitions contrôlées par
des fonctions SECURITY DEFINER (audit systématique) :

- `mettre_en_revue_periode`, `verrouiller_periode` (rôle owner/admin/comptable) ;
- `cloturer_periode` (rôle owner/admin) — **refusée s'il reste des écritures
  en brouillon** sur la période ;
- `rouvrir_periode(_motif)` (rôle owner/admin) — **motif obligatoire**,
  consigné dans `audit_log.payload`.

Le trigger `trg_ecritures_periode` (`check_periode_ouverte`) **bloque toute
création ou modification d'écriture** dont la date tombe dans une période
`verrouillee` ou `cloturee` — la validation et la contrepassation comprises.

## Restitutions

Les états (journal général, grand livre, balance générale) sont calculés à
partir des **seules écritures validées** (`statut = 'validee'`). La balance
contrôle l'égalité total débit = total crédit. Les états sont exportables en
CSV (séparateur `;`, BOM UTF-8 pour Excel francophone).

Côté frontend : hook partagé `src/hooks/use-mouvements.tsx`, filtres communs
`src/components/app/RestitutionFilters.tsx`, pages sous
`src/routes/_authenticated/app.comptabilite.{journal,grand-livre,balance}.tsx`.
