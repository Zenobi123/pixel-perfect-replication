-- =========================================================================
-- JEU D'ÉCRITURES « GOLDEN » — filet anti-régression du moteur comptable
-- Cahier des charges v1.1, §Maintenabilité et règle de développement n°22 :
-- « un dossier d'exemple couvrant un cycle achats-ventes-trésorerie complet,
--   dont la balance, le bilan et le compte de résultat attendus sont connus et
--   figés. À chaque évolution du moteur, ce dossier est rejoué et les états
--   produits sont comparés automatiquement aux états attendus ; tout écart
--   bloque la mise en production. »
--
-- EXÉCUTION (contre une instance de développement, JAMAIS la production) :
--   psql "$DATABASE_URL" -v uid="'<un-uuid-de-auth.users>'" \
--     -f supabase/tests/golden_ecritures.sql
--
-- Le script crée un dossier isolé, comptabilise le cycle, vérifie les états
-- attendus via des ASSERT, puis ROLLBACK : aucune donnée n'est persistée.
-- Toute divergence lève une exception et fait échouer le script (code != 0).
--
-- Scénario (exercice 2026, montants en XAF, TVA 19,25 %) :
--   1. Vente de marchandises : 1 000 000 HT + 192 500 TVA = 1 192 500 TTC
--      VEN : D 411=1 192 500 / C 701=1 000 000 / C 4431=192 500
--   2. Encaissement client par banque
--      BAN : D 521=1 192 500 / C 411=1 192 500
--   3. Achat de marchandises : 600 000 HT + 115 500 TVA = 715 500 TTC
--      ACH : D 601=600 000 / D 4452=115 500 / C 401=715 500
--   4. Paiement fournisseur par banque
--      BAN : D 401=715 500 / C 521=715 500
--
-- États attendus (figés) :
--   total débit = total crédit = 3 816 000   (balance équilibrée)
--   solde 521 Banque        = 477 000 D
--   solde 601 Achats        = 600 000 D
--   solde 4452 TVA récup.   = 115 500 D
--   solde 701 Ventes        = 1 000 000 C
--   solde 4431 TVA facturée = 192 500 C
--   solde 411 Clients       = 0
--   solde 401 Fournisseurs  = 0
--   résultat (cl.7 - cl.6)  = 400 000  (bénéfice)
--   total actif = total passif = 592 500  (bilan équilibré)
-- =========================================================================

\set ON_ERROR_STOP on
begin;

do $$
declare
  _uid uuid := :uid;
  _ent uuid;
  _exo uuid;
  _jven uuid; _jach uuid; _jban uuid;
  _c411 uuid; _c701 uuid; _c4431 uuid; _c521 uuid; _c601 uuid; _c401 uuid; _c4452 uuid;
  _e uuid;
  _td numeric; _tc numeric;
  _s521 numeric; _s601 numeric; _s4452 numeric;
  _s701 numeric; _s4431 numeric; _s411 numeric; _s401 numeric;
  _produits numeric; _charges numeric; _resultat numeric;
  _actif numeric; _passif numeric;
begin
  if _uid is null then
    raise exception 'Passez un uid existant : psql -v uid="''<uuid>''" -f ...';
  end if;

  -- ---- Dossier isolé -----------------------------------------------------
  insert into public.entreprises (raison_sociale, regime_fiscal, devise, created_by)
  values ('GOLDEN TEST SARL', 'reel', 'XAF', _uid) returning id into _ent;

  insert into public.exercices (entreprise_id, libelle, date_debut, date_fin)
  values (_ent, 'Exercice 2026', '2026-01-01', '2026-12-31') returning id into _exo;

  insert into public.journaux (entreprise_id, code, libelle, type) values
    (_ent, 'VEN', 'Ventes', 'ventes')  returning id into _jven;
  insert into public.journaux (entreprise_id, code, libelle, type) values
    (_ent, 'ACH', 'Achats', 'achats')  returning id into _jach;
  insert into public.journaux (entreprise_id, code, libelle, type) values
    (_ent, 'BAN', 'Banque', 'banque')  returning id into _jban;

  insert into public.comptes (entreprise_id, numero, libelle, classe, sens) values
    (_ent, '411',  'Clients', 4, 'debit')                 returning id into _c411;
  insert into public.comptes (entreprise_id, numero, libelle, classe, sens) values
    (_ent, '701',  'Ventes de marchandises', 7, 'credit') returning id into _c701;
  insert into public.comptes (entreprise_id, numero, libelle, classe, sens) values
    (_ent, '4431', 'État, TVA facturée', 4, 'credit')     returning id into _c4431;
  insert into public.comptes (entreprise_id, numero, libelle, classe, sens) values
    (_ent, '521',  'Banques', 5, 'debit')                 returning id into _c521;
  insert into public.comptes (entreprise_id, numero, libelle, classe, sens) values
    (_ent, '601',  'Achats de marchandises', 6, 'debit')  returning id into _c601;
  insert into public.comptes (entreprise_id, numero, libelle, classe, sens) values
    (_ent, '401',  'Fournisseurs', 4, 'credit')           returning id into _c401;
  insert into public.comptes (entreprise_id, numero, libelle, classe, sens) values
    (_ent, '4452', 'État, TVA récupérable', 4, 'debit')   returning id into _c4452;

  -- ---- 1. Vente -----------------------------------------------------------
  insert into public.ecritures (entreprise_id, exercice_id, journal_id, numero, date_piece, libelle, statut, created_by, validee_le, validee_par)
  values (_ent, _exo, _jven, 1, '2026-02-10', 'Facture vente VF-001', 'validee', _uid, now(), _uid) returning id into _e;
  insert into public.lignes_ecriture (ecriture_id, entreprise_id, ordre, compte_id, debit, credit) values
    (_e, _ent, 1, _c411,  1192500, 0),
    (_e, _ent, 2, _c701,  0, 1000000),
    (_e, _ent, 3, _c4431, 0, 192500);

  -- ---- 2. Encaissement client --------------------------------------------
  insert into public.ecritures (entreprise_id, exercice_id, journal_id, numero, date_piece, libelle, statut, created_by, validee_le, validee_par)
  values (_ent, _exo, _jban, 1, '2026-02-15', 'Encaissement VF-001', 'validee', _uid, now(), _uid) returning id into _e;
  insert into public.lignes_ecriture (ecriture_id, entreprise_id, ordre, compte_id, debit, credit) values
    (_e, _ent, 1, _c521, 1192500, 0),
    (_e, _ent, 2, _c411, 0, 1192500);

  -- ---- 3. Achat -----------------------------------------------------------
  insert into public.ecritures (entreprise_id, exercice_id, journal_id, numero, date_piece, libelle, statut, created_by, validee_le, validee_par)
  values (_ent, _exo, _jach, 1, '2026-03-05', 'Facture achat AF-001', 'validee', _uid, now(), _uid) returning id into _e;
  insert into public.lignes_ecriture (ecriture_id, entreprise_id, ordre, compte_id, debit, credit) values
    (_e, _ent, 1, _c601,  600000, 0),
    (_e, _ent, 2, _c4452, 115500, 0),
    (_e, _ent, 3, _c401,  0, 715500);

  -- ---- 4. Paiement fournisseur -------------------------------------------
  insert into public.ecritures (entreprise_id, exercice_id, journal_id, numero, date_piece, libelle, statut, created_by, validee_le, validee_par)
  values (_ent, _exo, _jban, 2, '2026-03-10', 'Paiement AF-001', 'validee', _uid, now(), _uid) returning id into _e;
  insert into public.lignes_ecriture (ecriture_id, entreprise_id, ordre, compte_id, debit, credit) values
    (_e, _ent, 1, _c401, 715500, 0),
    (_e, _ent, 2, _c521, 0, 715500);

  -- ====================== VÉRIFICATIONS (états figés) =====================
  -- Balance globale
  select coalesce(sum(l.debit),0), coalesce(sum(l.credit),0)
    into _td, _tc
  from public.lignes_ecriture l
  join public.ecritures e on e.id = l.ecriture_id
  where e.entreprise_id = _ent and e.statut = 'validee';
  assert _td = 3816000, format('Total débit attendu 3 816 000, obtenu %s', _td);
  assert _tc = 3816000, format('Total crédit attendu 3 816 000, obtenu %s', _tc);
  assert _td = _tc, 'Balance déséquilibrée';

  -- Soldes par compte (débit - crédit)
  create temporary table _soldes on commit drop as
  select c.numero, c.classe, sum(l.debit) - sum(l.credit) as solde
  from public.lignes_ecriture l
  join public.ecritures e on e.id = l.ecriture_id
  join public.comptes c on c.id = l.compte_id
  where e.entreprise_id = _ent and e.statut = 'validee'
  group by c.numero, c.classe;

  select solde into _s521  from _soldes where numero = '521';
  select solde into _s601  from _soldes where numero = '601';
  select solde into _s4452 from _soldes where numero = '4452';
  select solde into _s701  from _soldes where numero = '701';
  select solde into _s4431 from _soldes where numero = '4431';
  select solde into _s411  from _soldes where numero = '411';
  select solde into _s401  from _soldes where numero = '401';

  assert _s521  =  477000,  format('Solde 521 attendu 477 000 D, obtenu %s', _s521);
  assert _s601  =  600000,  format('Solde 601 attendu 600 000 D, obtenu %s', _s601);
  assert _s4452 =  115500,  format('Solde 4452 attendu 115 500 D, obtenu %s', _s4452);
  assert _s701  = -1000000, format('Solde 701 attendu 1 000 000 C, obtenu %s', _s701);
  assert _s4431 = -192500,  format('Solde 4431 attendu 192 500 C, obtenu %s', _s4431);
  assert _s411  =  0,       format('Solde 411 attendu 0, obtenu %s', _s411);
  assert _s401  =  0,       format('Solde 401 attendu 0, obtenu %s', _s401);

  -- Compte de résultat : produits (cl.7) - charges (cl.6)
  select coalesce(sum(case when classe = 7 then -solde else 0 end), 0),
         coalesce(sum(case when classe = 6 then  solde else 0 end), 0)
    into _produits, _charges
  from _soldes;
  _resultat := _produits - _charges;
  assert _produits = 1000000, format('Produits attendus 1 000 000, obtenu %s', _produits);
  assert _charges  =  600000, format('Charges attendues 600 000, obtenu %s', _charges);
  assert _resultat =  400000, format('Résultat attendu 400 000, obtenu %s', _resultat);

  -- Bilan : actif (soldes débiteurs hors cl.6/7) = passif (soldes créditeurs + résultat)
  select coalesce(sum(case when classe in (1,2,3,4,5) and solde > 0 then solde else 0 end), 0),
         coalesce(sum(case when classe in (1,2,3,4,5) and solde < 0 then -solde else 0 end), 0)
    into _actif, _passif
  from _soldes;
  _passif := _passif + _resultat; -- le résultat bénéficiaire est au passif
  assert _actif = 592500, format('Total actif attendu 592 500, obtenu %s', _actif);
  assert _passif = 592500, format('Total passif attendu 592 500, obtenu %s', _passif);
  assert _actif = _passif, 'Bilan déséquilibré';

  raise notice 'GOLDEN OK — balance, résultat (400 000) et bilan (592 500) conformes.';
end $$;

rollback;
