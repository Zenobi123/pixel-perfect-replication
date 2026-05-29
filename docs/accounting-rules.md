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

## Abonnement (paiement manuel) et sauvegarde

Migration : `supabase/migrations/20260529180000_abonnement_manuel.sql`.

v0 sans agrégateur de paiement : l'encaissement se fait hors application puis
un **super administrateur** active/prolonge/suspend l'abonnement via
`activer_abonnement(entreprise, statut, jusqu_au)` (réservée `super_admin`,
auditée). Le trigger `check_abonnement_actif` **bloque la création de nouvelles
écritures** quand le statut est `suspendu` ou `expire`, sans jamais empêcher les
consultations ni les exports (cahier §Règles de suspension, Parcours 4).

**Export complet par entreprise** (`/app/export`, Module 18, critère global
n°15) : sauvegarde JSON de toutes les entités comptables + exports CSV, filet de
sécurité indépendant du plan d'hébergement, disponible même abonnement suspendu.

## Pièces justificatives (stockage privé)

Migration : `supabase/migrations/20260529160000_documents_pieces_justificatives.sql`.

- Bucket `pieces` créé **privé** (les buckets sont publics par défaut sur
  Lovable/Supabase), avec limite de taille (10 Mo) et types autorisés
  (PDF, PNG, JPEG, WebP).
- Table `documents` (scopée par `entreprise_id`, liée à une écriture), RLS par
  membership.
- **RLS sur `storage.objects`** : un objet n'est lisible/déposable/supprimable
  que si le 1ᵉʳ segment du chemin (`entreprise_id/…`) correspond à une
  entreprise dont l'utilisateur est membre — isolation physique par tenant.
- L'accès aux fichiers se fait par **URL signée à durée de vie courte (60 s)**
  générée à la volée ; aucune clé secrète côté frontend, aucun objet public.

Frontend : `src/components/app/PiecesJointes.tsx`, intégré à la page détail
d'une écriture.

## Restitutions

Les états (journal général, grand livre, balance générale) sont calculés à
partir des **seules écritures validées** (`statut = 'validee'`). La balance
contrôle l'égalité total débit = total crédit. Les états sont exportables en
CSV (séparateur `;`, BOM UTF-8 pour Excel francophone).

Côté frontend : hook partagé `src/hooks/use-mouvements.tsx`, filtres communs
`src/components/app/RestitutionFilters.tsx`, pages sous
`src/routes/_authenticated/app.comptabilite.{journal,grand-livre,balance}.tsx`.
