# Jeu d'écritures « golden » (anti-régression comptable)

Conformément au cahier des charges v1.1 (§Maintenabilité, règle de
développement n°22, checklist production), un dossier de référence couvrant un
cycle **achats — ventes — trésorerie** est figé avec ses états attendus. Il doit
être rejoué à chaque évolution du moteur comptable ; tout écart bloque la mise
en production.

## Le scénario (exercice 2026, XAF, TVA 19,25 %)

| # | Journal | Écriture | Débit | Crédit |
|---|---------|----------|------:|-------:|
| 1 | VEN | Vente : 411 / 701 + 4431 | 411 = 1 192 500 | 701 = 1 000 000 ; 4431 = 192 500 |
| 2 | BAN | Encaissement client : 521 / 411 | 521 = 1 192 500 | 411 = 1 192 500 |
| 3 | ACH | Achat : 601 + 4452 / 401 | 601 = 600 000 ; 4452 = 115 500 | 401 = 715 500 |
| 4 | BAN | Paiement fournisseur : 401 / 521 | 401 = 715 500 | 521 = 715 500 |

## États attendus (figés)

| Contrôle | Valeur attendue |
|---|---:|
| Total débit = total crédit | 3 816 000 |
| Solde 521 Banque | 477 000 D |
| Solde 601 Achats | 600 000 D |
| Solde 4452 TVA récupérable | 115 500 D |
| Solde 701 Ventes | 1 000 000 C |
| Solde 4431 TVA facturée | 192 500 C |
| Solde 411 Clients | 0 |
| Solde 401 Fournisseurs | 0 |
| Résultat (produits − charges) | 400 000 (bénéfice) |
| Total actif = total passif | 592 500 |

## Exécution

Script : [`supabase/tests/golden_ecritures.sql`](../supabase/tests/golden_ecritures.sql).
Il crée le dossier, comptabilise le cycle, vérifie chaque état via `ASSERT`,
puis `ROLLBACK` (aucune donnée persistée). Toute divergence lève une exception
et fait sortir `psql` en erreur.

```bash
# Contre une instance de DÉVELOPPEMENT uniquement.
# uid = un identifiant existant dans auth.users (le script l'utilise comme
# created_by ; il est requis par la contrainte de clé étrangère).
psql "$DATABASE_URL" -v uid="'00000000-0000-0000-0000-000000000000'" \
  -f supabase/tests/golden_ecritures.sql
```

Sortie attendue :

```
NOTICE:  GOLDEN OK — balance, résultat (400 000) et bilan (592 500) conformes.
ROLLBACK
```

## Intégration continue (recommandée)

Ajouter une étape CI qui lance le script contre une base éphémère (Supabase CLI
`supabase db start`, ou un conteneur Postgres sur lequel les migrations de
`supabase/migrations/` ont été appliquées). Faire échouer le job si `psql`
retourne un code non nul.

## Portée

Ce test verrouille la **justesse des états** (partie double, équilibre, soldes,
résultat, bilan) — le risque « une balance fausse » du cahier. Les comportements
de la couche RPC (numérotation atomique à la validation, immuabilité, blocage en
période verrouillée ou abonnement suspendu) sont garantis par la conception des
migrations (`validate_ecriture`, `attribuer_numero_ecriture`, triggers
`check_periode_ouverte` / `check_abonnement_actif`) et se testent via un
utilisateur authentifié sur une instance réelle.
