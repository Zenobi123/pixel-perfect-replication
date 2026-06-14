# Kompta — SaaS comptable OHADA (Cameroun)

Application SaaS multi-entreprises de comptabilité conforme au référentiel
**OHADA / SYSCOHADA révisé**, destinée aux PME, TPE, associations et cabinets
comptables camerounais. Tenue de comptabilité en partie double, journaux,
grand-livre, balance, ventes, achats, trésorerie, tiers, fiscalité et états de
base — avec isolation multi-tenant stricte par `entreprise_id`.

> Document de conception : `cahier_des_charges_saas_comptable_ohada_cameroun_lovable_v1.1.md`.
> Les règles, taux et seuils fiscaux doivent être validés chaque année avec les
> textes officiels (DGI, loi de finances).

## Stack technique

| Couche         | Technologie                                                                           |
| -------------- | ------------------------------------------------------------------------------------- |
| Frontend / SSR | [TanStack Start](https://tanstack.com/start) (React 19 + Vite 7), TypeScript          |
| UI             | Tailwind CSS 4, shadcn/ui (style « new-york »), lucide-react                          |
| Données / état | TanStack Query, react-hook-form + zod                                                 |
| Backend        | Supabase (PostgreSQL, Auth, Storage), RLS multi-tenant + fonctions `SECURITY DEFINER` |
| Hébergement    | Cloudflare Workers (`wrangler`, `nodejs_compat`) — entrée SSR `src/server.ts`         |
| Tests          | Vitest + Testing Library (front) · psql (RLS + golden côté base)                      |

## Prérequis

- **Node.js 22** (voir `.github/workflows/quality.yml`)
- **npm** (le dépôt versionne `package-lock.json` ; `bun` est utilisable via `bunfig.toml`)
- Pour les tests base de données : **Supabase CLI** et **psql**

## Démarrage rapide

```bash
# 1. Dépendances
npm ci

# 2. Variables d'environnement (valeurs publiques pré-remplies)
cp .env.example .env
# Renseigner SUPABASE_SERVICE_ROLE_KEY uniquement si besoin d'opérations admin
# serveur. Ne JAMAIS committer ce fichier (il est ignoré par git).

# 3. Démarrage en développement
npm run dev
```

## Scripts

| Script                   | Rôle                                                                     |
| ------------------------ | ------------------------------------------------------------------------ |
| `npm run dev`            | Serveur de développement Vite                                            |
| `npm run build`          | Build de production (client + serveur SSR)                               |
| `npm run preview`        | Prévisualisation du build                                                |
| `npm run lint`           | ESLint                                                                   |
| `npm run format`         | Prettier (écriture)                                                      |
| `npm run typecheck`      | `tsc --noEmit`                                                           |
| `npm run test`           | Tests front (Vitest, une passe)                                          |
| `npm run test:watch`     | Tests front en mode veille                                               |
| `npm run check:schema`   | Vérifie que les tables/RPC utilisées existent dans `types.ts`            |
| `npm run check:auth-ssr` | Vérifie le garde d'auth SSR du routeur                                   |
| `npm run test:rls`       | Test d'isolation RLS (psql, `DATABASE_URL` requis)                       |
| `npm run test:golden`    | Test comptable « golden » (psql, `DATABASE_URL` + `GOLDEN_TEST_USER_ID`) |
| `npm run check`          | Chaîne complète : schema + auth-ssr + lint + typecheck + test + build    |

## Structure du dépôt

```
src/
  routes/                 Routes TanStack (publiques + _authenticated/*)
  components/ui/          Primitives shadcn/ui
  components/app/         Formulaires métier (écritures, factures, achats…)
  hooks/                  use-auth, use-entreprises, …
  integrations/supabase/  Clients (navigateur, serveur admin, middleware auth)
  lib/                    format, export, observability, utils
  server.ts / start.ts    Entrée SSR + middleware d'erreur
supabase/
  migrations/             Migrations SQL (schéma, RLS, RPC SECURITY DEFINER)
  tests/                  rls_isolation.sql, golden_ecritures.sql
docs/                     accounting-rules.md, golden-tests.md, runbook.md
scripts/                  Vérifs (schéma, auth-ssr) et lanceurs de tests SQL
```

## Tests

- **Front** : `npm run test` (Vitest + jsdom). Couvre la logique pure
  (formatage XAF, export CSV, observabilité) et l'invariant d'équilibre
  débit=crédit du formulaire de saisie d'écriture.
- **Base de données** : `npm run test:rls` (isolation inter-tenant) et
  `npm run test:golden` (cycle achats-ventes-trésorerie figé). Voir
  `docs/golden-tests.md`.

## Intégration continue

`.github/workflows/quality.yml` exécute, sur chaque PR et push sur `main` :

- **application** : `npm ci` puis `npm run check` (schéma, auth-ssr, lint,
  typecheck, tests front, build) ;
- **database** : démarre Supabase en local, applique les migrations, joue les
  tests RLS et golden.

## Déploiement et exploitation

Cible : **Cloudflare Workers** (build → `dist/`, entrée `src/server.ts`).
La procédure complète — variables d'environnement, migrations, sauvegarde /
restauration, reprise après sinistre, réponse aux incidents et observabilité —
est décrite dans **[`docs/runbook.md`](docs/runbook.md)**.

## Documentation

- [`docs/runbook.md`](docs/runbook.md) — exploitation (déploiement, sauvegarde, incidents)
- [`docs/accounting-rules.md`](docs/accounting-rules.md) — règles du moteur comptable
- [`docs/golden-tests.md`](docs/golden-tests.md) — filet anti-régression comptable
- `cahier_des_charges_saas_comptable_ohada_cameroun_lovable_v1.1.md` — cahier des charges
