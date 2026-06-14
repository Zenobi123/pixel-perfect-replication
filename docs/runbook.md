# Runbook d'exploitation — Kompta

Procédures d'exploitation pour la mise en production et la maintenance.
Public visé : responsable technique / personne d'astreinte.

> **Données comptables = données critiques.** Toute opération destructive
> (migration, restauration, purge) doit être précédée d'une sauvegarde vérifiée
> et, si possible, répétée sur un environnement de pré-production.

---

## 1. Architecture de déploiement

```
Navigateur ──► Cloudflare Workers (SSR, src/server.ts) ──► Supabase
                                                            ├─ PostgreSQL (RLS)
                                                            ├─ Auth (JWT)
                                                            └─ Storage (pièces jointes, buckets privés)
```

- **Frontend / SSR** : build Vite (`dist/`), servi par un Worker Cloudflare
  (`wrangler.jsonc`, entrée `main = src/server.ts`, flag `nodejs_compat`).
- **Base et services** : projet Supabase managé (`SUPABASE_PROJECT_ID`).
- **Sécurité d'accès aux données** : assurée par les **politiques RLS** côté
  PostgreSQL, pas par le secret des clés client (la clé anon est publique).

---

## 2. Variables d'environnement

Source de vérité : **`.env.example`**. Aucune valeur secrète n'est versionnée.

| Variable                                                     | Portée                 | Secret  | Rôle                                         |
| ------------------------------------------------------------ | ---------------------- | ------- | -------------------------------------------- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL`                         | client + serveur       | non     | URL du projet Supabase                       |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | client + serveur       | non     | Clé anon (publique, RLS)                     |
| `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID`           | client + serveur       | non     | Identifiant projet                           |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | **serveur uniquement** | **OUI** | Contourne la RLS — opérations admin          |
| `VITE_OBSERVABILITY_ENDPOINT` / `OBSERVABILITY_ENDPOINT`     | client / serveur       | non     | Endpoint de collecte des erreurs (optionnel) |
| `VITE_APP_ENV` / `APP_ENV`                                   | client / serveur       | non     | Nom de l'environnement (logs)                |
| `VITE_APP_RELEASE` / `APP_RELEASE`                           | client / serveur       | non     | Version (corrélation des logs)               |

En production, ces variables sont injectées par la plateforme :

```bash
# Secret serveur (jamais en clair dans le dépôt)
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Variables publiques côté build : définies dans l'environnement de build
# (dashboard Cloudflare/Lovable) — voir .github/workflows/quality.yml pour la
# liste exacte attendue par le build.
```

**Configuration d'authentification** : la politique d'auth (confirmations email,
expiration JWT, politique de mot de passe, rate-limits) est versionnée dans
`supabase/config.toml`. Pour l'appliquer au projet managé :

```bash
supabase link --project-ref "$SUPABASE_PROJECT_ID"
supabase config push        # applique [auth], [auth.email], [auth.rate_limit]…
```

Penser à y renseigner la vraie `site_url` de production (le fichier contient une
valeur locale par défaut).

---

## 3. Procédure de déploiement

1. **Pré-vol** : la branche est verte en CI (`npm run check` + tests base) et
   la **checklist §7** est satisfaite.
2. **Migrations base d'abord** (voir §4), sur un schéma sauvegardé.
3. **Build et publication du Worker** :
   ```bash
   npm ci
   npm run build
   wrangler deploy
   ```
4. **Vérification post-déploiement** (§8).
5. **Rollback applicatif** si besoin :
   ```bash
   wrangler deployments list
   wrangler rollback [--message "raison"]
   ```
   ⚠️ Un rollback applicatif ne défait **pas** les migrations base. Si la
   migration est incompatible avec l'ancienne version, traiter d'abord §4.

---

## 4. Migrations de base de données

Les migrations vivent dans `supabase/migrations/` (préfixe horodaté) et sont
**forward-only** par convention Supabase.

**Appliquer** (environnement managé) :

```bash
supabase link --project-ref "$SUPABASE_PROJECT_ID"
supabase db push          # applique les migrations en attente
```

**Reproduire / réinitialiser en local** (comme la CI) :

```bash
supabase start
supabase db reset --local # rejoue toutes les migrations à neuf
```

**Vérifier après migration** : rejouer les tests sur une base de dev migrée

```bash
DATABASE_URL=postgres://... npm run test:rls
DATABASE_URL=postgres://... GOLDEN_TEST_USER_ID=<uuid> npm run test:golden
```

**Rollback d'une migration** — il n'existe pas de « down » automatique :

1. **Privilégier** la restauration point-in-time (PITR, §5) vers l'instant
   précédant la migration, si elle a corrompu des données.
2. Sinon, écrire une **migration compensatoire** (nouveau fichier qui annule
   proprement le changement) et la passer en CI avant de la déployer.
3. Ne jamais éditer/supprimer une migration déjà appliquée en production.

> Règle d'or : une migration touchant aux écritures comptables n'est déployée
> qu'après passage **vert** du test golden (§7).

---

## 5. Sauvegarde et restauration

Deux niveaux complémentaires :

**a) Sauvegardes de la plateforme (primaire)**

- Sauvegardes automatiques quotidiennes Supabase + **PITR** (Point-In-Time
  Recovery) selon le plan. Vérifier que le PITR est **activé** sur le projet de
  production et noter la fenêtre de rétention.
- Restauration / PITR : via le dashboard Supabase (Database → Backups).

**b) Sauvegarde logique manuelle (avant opération sensible)**

```bash
supabase db dump --db-url "$DATABASE_URL" -f backup_$(date +%F).sql
# Restauration :
psql "$DATABASE_URL" -f backup_AAAA-MM-JJ.sql
```

**c) Filet de sécurité applicatif (par dossier)**
L'application expose un **export complet par entreprise** (route `/app/export`,
CSV/JSON via `src/lib/export.ts`). C'est le filet maîtrisable indépendamment de
l'hébergeur, prévu par le cahier des charges : encourager les clients/cabinets à
exporter régulièrement.

**Test de restauration** : au moins **trimestriel**, restaurer une sauvegarde
sur un projet jetable et rejouer `test:rls` + `test:golden`. Une sauvegarde non
testée n'est pas une sauvegarde.

---

## 6. Reprise après sinistre (DR)

| Scénario                                | Action                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Worker en échec / mauvaise version      | `wrangler rollback` (§3)                                                                                         |
| Corruption de données suite à migration | PITR Supabase à T-avant-migration (§5a)                                                                          |
| Perte projet Supabase                   | Recréer un projet, restaurer le dump (§5b), `supabase db push`, réinjecter les secrets, repointer `SUPABASE_URL` |
| Fuite de `SERVICE_ROLE_KEY`             | Rotation immédiate (§9)                                                                                          |

Objectifs à définir avec le métier puis documenter ici : **RPO** (perte de
données tolérée) et **RTO** (durée d'indisponibilité tolérée).

---

## 7. Checklist avant mise en production

- [ ] CI verte : `npm run check` (lint, typecheck, tests front, build)
- [ ] Tests base verts : `test:rls` **et** `test:golden`
- [ ] Migrations en attente revues et testées sur pré-production
- [ ] Sauvegarde récente vérifiée (et PITR actif)
- [ ] Balance équilibrée, aucune écriture brouillon orpheline sur les états
- [ ] Secrets de production en place (`SUPABASE_SERVICE_ROLE_KEY`, etc.)
- [ ] `APP_RELEASE` mis à jour pour tracer la version dans les logs

---

## 8. Vérifications post-déploiement (smoke test)

1. La page d'accueil publique répond (HTTP 200).
2. Connexion d'un compte de test → accès à `/app`.
3. Création d'une écriture brouillon équilibrée → validation OK.
4. Affichage de la balance/journal sans erreur.
5. Aucun pic d'erreurs dans les logs (§9) dans les minutes qui suivent.

---

## 9. Observabilité et réponse aux incidents

Le module `src/lib/observability.ts` émet des **logs JSON structurés** à chaque
erreur (niveau, message, stack, `scope`, `url`, environnement, release).

- **Consulter les logs** : tail temps réel du Worker
  ```bash
  wrangler tail
  ```
  ou les Cloudflare Workers Logs / Logpush du dashboard.
- **Agrégateur externe (optionnel)** : définir `OBSERVABILITY_ENDPOINT` /
  `VITE_OBSERVABILITY_ENDPOINT` pour transmettre les erreurs (Sentry via proxy,
  Axiom, Logflare, Worker dédié…). Sans configuration, les logs restent
  consultables via le tail.
- **Filtrer un incident** : rechercher `"level":"error"` et le `scope`
  (`worker.fetch`, `ssr`, `request-middleware`, `react-error-boundary`,
  `global-handler`) pour localiser l'origine.

**Procédure incident** : identifier le `scope` et l'`url` fautifs → reproduire →
si données impactées, geler les écritures concernées et envisager PITR →
corriger → déployer → vérifier (§8) → consigner dans un post-mortem.

---

## 10. Rotation des secrets

- **Clé `service_role`** : rotation depuis le dashboard Supabase (Settings →
  API), puis `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`. À faire
  immédiatement en cas de suspicion de fuite.
- **Clé anon / publishable** : publique par design ; sa rotation n'est requise
  qu'en cas de changement de projet. La sécurité repose sur la RLS.
- Après toute rotation : redéployer et exécuter le smoke test (§8).

---

## 11. Modèle de sécurité d'authentification (décision assumée)

Posture retenue et revue — à connaître avant toute évolution de l'auth :

- **Frontière de sécurité des données = RLS PostgreSQL.** Aucune donnée tenant
  n'est accessible sans un JWT valide dont le `sub` est membre de l'entreprise.
  C'est vérifié par le test d'isolation inter-tenant (`npm run test:rls`).
- **Server functions** : authentifiées par **Bearer token** (le middleware
  client `attachSupabaseAuth` joint le token, `requireSupabaseAuth` le valide
  côté serveur via `getClaims`). Défense en profondeur en complément de la RLS.
- **Sessions stockées en `localStorage`** (client navigateur). Le serveur ne
  reçoit donc pas de cookie de session : il **ne peut pas** connaître l'état
  d'authentification lors du rendu du document initial.
- **Routes authentifiées rendues côté client uniquement** (`ssr: false` sur
  `/_authenticated`). Conséquence : le serveur ne produit jamais de contenu
  authentifié, il n'y a pas de flash de coquille vide pour un visiteur non
  connecté, et la redirection vers `/login` est effectuée côté client par
  `beforeLoad`. Un état de chargement neutre est affiché tant que la session
  n'est pas résolue.
- **Invariant CI** : `scripts/check-auth-ssr.mjs` garantit que le routeur ne
  redéclenche pas de redirection serveur sur la seule absence de session
  navigateur (ce qui provoquerait des redirections erronées en SSR).

**Évolution possible (hors périmètre actuel)** : migrer vers des sessions par
**cookie** (`@supabase/ssr`) permettrait une vraie redirection côté serveur et
une défense en profondeur au niveau du document. C'est une refonte de l'auth
(risque de régression du login) à planifier séparément, pas un correctif.

---

## 12. Sécurité des dépendances

- **Garde CI** : le job `application` exécute `npm audit --audit-level=high`.
  Toute vulnérabilité high/critical fait échouer la CI.
- **Advisory sans correctif amont** : forcer une version corrigée via le champ
  `overrides` de `package.json` (cf. `esbuild` épinglé à la première version non
  vulnérable), puis revalider avec `npm run check`. Si aucune version corrigée
  n'existe et que la faille ne concerne pas le runtime de production (ex. outil
  de build / serveur de dev uniquement), documenter l'exception ici avec sa
  justification et la date de revue.
- **Rappel** : le bundle déployé (Worker) ne contient pas l'outillage de build
  (esbuild, vite, wrangler). Une faille de serveur de développement n'expose
  donc pas la production, mais reste à corriger pour les postes de développement.
- **Exceptions en cours** : _aucune_ (audit à 0 vulnérabilité au dernier passage).

---

## 13. Stratégie de version des dépendances

- **Installs reproductibles** : `package-lock.json` est versionné ; la CI et les
  déploiements utilisent `npm ci`. Le `bunfig.toml` ajoute un garde anti
  supply-chain (`minimumReleaseAge` 24 h) pour `bun`.
- **Socle (récent mais stable / GA)** : React 19, TanStack Start/Router, Vite 7,
  Tailwind 4. Mises à jour mineures à valider via `npm run check` (build + tests)
  avant déploiement.
- **Pré-versions** : interdites par défaut. Le garde `npm run check:deps`
  (`scripts/check-prerelease-deps.mjs`) fait échouer la CI si une dépendance
  beta/alpha/rc/etc. apparaît hors **allowlist**.
- **Allowlist actuelle** :
  - **`nitro`** (`3.0.260429-beta`) — exigé par `@lovable.dev/vite-tanstack-config`
    (build serveur de TanStack Start). Aucune version stable de Nitro 3 n'est
    publiée (le dist-tag `latest` reste une beta). Pin exact pour rester aligné
    sur la résolution de la config Lovable. **Non importé dans `src/`** : c'est
    une dépendance de build, pas du runtime applicatif.
    **Condition de sortie** : passer à une version stable dès que TanStack Start /
    la config Lovable la supporte.
- **Procédure pour ajouter une pré-version** : l'inscrire dans `ALLOWLIST`
  (scripts/check-prerelease-deps.mjs) avec justification et condition de sortie,
  puis la documenter ici. Sinon, préférer une version stable.

---

## 14. Abonnements et paiements (v0 — validation manuelle)

Modèle : l'abonnement appartient au **compte propriétaire** ; le plan définit
les limites (Essentiel/Standard/Pro = 1 entreprise ; Cabinet = illimité). Essai
gratuit de **14 jours** créé paresseusement au premier appel de `mon_abonnement`.

**Cycle de vie (paiement manuel)** :

1. Le client choisit une offre et **déclare un paiement** dans `/app/abonnement`
   (RPC `declarer_paiement`) après avoir réglé par son moyen habituel
   (Mobile Money, virement, espèces).
2. Un **administrateur** (`app_role = 'super_admin'`) ouvre `/app/admin/paiements`,
   vérifie le règlement et **valide** (RPC `valider_paiement`) : l'abonnement
   passe `active` et la période payée est prolongée (1 ou 12 mois selon le cycle).
   Le rejet (`rejeter_paiement`) est aussi possible.

**Désigner un administrateur** : insérer le rôle dans `user_roles`.

```sql
insert into public.user_roles (user_id, role) values ('<uuid-auth-users>', 'super_admin');
```

**Accès quand l'abonnement est inactif** (essai expiré / non payé) : la **lecture
et l'export restent disponibles**, mais la **saisie d'écritures est bloquée** (UI :
boutons désactivés + bandeau ; la fonction `mon_abonnement` calcule `peut_ecrire`).

**Limites assumées du v0** (pistes de durcissement, hors périmètre actuel) :

- **Enforcement côté client** : le blocage d'écriture est appliqué dans l'UI. Une
  protection inviolable nécessiterait un contrôle d'abonnement **dans les RPC
  comptables** (`save_ecriture_brouillon`, etc.). Volontairement non fait ici pour
  rester additif et ne pas modifier les fonctions couvertes par le test golden
  (qui devrait alors provisionner un abonnement dans son harnais).
- **Périmètre du blocage** : appliqué à la saisie d'**écritures** (cœur comptable)
  et signalé globalement par le bandeau. À étendre aux formulaires ventes/achats/
  trésorerie si besoin.
- **Limites de plan** (max entreprises/utilisateurs) : stockées dans `plans` et
  affichées, mais **non encore imposées** à la création.
- **Paiement en ligne** (Stripe / Mobile Money automatisé) : non intégré au v0,
  conformément au cahier (après validation commerciale).
