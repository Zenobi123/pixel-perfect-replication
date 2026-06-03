-- =========================================================================
-- DURCISSEMENT CONCURRENCE — verrou FOR UPDATE avant consommation d'un numéro
-- Suite à la revue de code (bug de concurrence sur validate_ecriture) :
-- deux validations concurrentes du même brouillon pouvaient lire toutes deux
-- statut='brouillon' (lecture non verrouillée), consommer chacune un numéro de
-- journal, et un seul UPDATE l'emportait → numéro consommé non attribué = trou.
--
-- Cette migration ré-applique (create or replace) les fonctions concernées en
-- ajoutant un SELECT ... FOR UPDATE sur la ligne au début, ce qui sérialise les
-- appels concurrents (le perdant relit l'état à jour et échoue AVANT de
-- consommer un numéro). Elle s'exécute APRÈS le schéma consolidé qui définit
-- ces fonctions sans le verrou, et constitue donc la version faisant foi.
-- Classe de défaut identique corrigée pour : contrepassation (double extourne),
-- validation facture/achat (double numéro), règlements (sur-paiement concurrent).
-- =========================================================================

create or replace function public.validate_ecriture(_ecriture_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _ent uuid;
  _exo uuid;
  _jou uuid;
  _statut ecriture_statut;
  _debit numeric;
  _credit numeric;
  _nb int;
  _num int;
begin
  select entreprise_id, exercice_id, journal_id, statut
    into _ent, _exo, _jou, _statut
  from public.ecritures where id = _ecriture_id
  for update;
  if _ent is null then raise exception 'Écriture introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé';
  end if;
  if _statut <> 'brouillon' then raise exception 'Écriture déjà validée'; end if;

  select coalesce(sum(debit),0), coalesce(sum(credit),0), count(*)
    into _debit, _credit, _nb
  from public.lignes_ecriture where ecriture_id = _ecriture_id;

  if _nb < 2 then raise exception 'Au moins 2 lignes requises'; end if;
  if _debit <> _credit then
    raise exception 'Écriture non équilibrée: débit=% crédit=%', _debit, _credit;
  end if;
  if _debit = 0 then raise exception 'Montants nuls'; end if;

  _num := public.attribuer_numero_ecriture(_ent, _exo, _jou);

  update public.ecritures
    set statut = 'validee', numero = _num, validee_le = now(), validee_par = auth.uid()
    where id = _ecriture_id;

  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_ent, auth.uid(), 'ecriture.validate', 'ecritures', _ecriture_id::text);
end; $$;

create or replace function public.contrepasser_ecriture(_ecriture_id uuid, _date date default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _src record;
  _new_id uuid;
  _next int;
begin
  select * into _src from public.ecritures where id = _ecriture_id for update;
  if _src is null then raise exception 'Écriture introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _src.entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé';
  end if;
  if _src.statut <> 'validee' then raise exception 'Seules les écritures validées peuvent être contre-passées'; end if;

  _next := public.attribuer_numero_ecriture(_src.entreprise_id, _src.exercice_id, _src.journal_id);

  insert into public.ecritures(entreprise_id, exercice_id, journal_id, numero, reference, date_piece, libelle, statut, validee_le, validee_par, contrepasse_par, created_by)
  values (_src.entreprise_id, _src.exercice_id, _src.journal_id, _next, 'EXT-'||_src.numero, coalesce(_date, current_date), 'Extourne — '||_src.libelle, 'validee', now(), auth.uid(), _src.id, auth.uid())
  returning id into _new_id;

  insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit)
  select _new_id, l.entreprise_id, l.ordre, l.compte_id, l.tiers_id, l.libelle, l.credit, l.debit
  from public.lignes_ecriture l where l.ecriture_id = _src.id;

  update public.ecritures set statut = 'contrepassee' where id = _src.id;

  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_src.entreprise_id, auth.uid(), 'ecriture.contrepasser', 'ecritures', _src.id::text);

  return _new_id;
end; $$;

create or replace function public.valider_facture(_facture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _f public.factures;
  _ht numeric; _tva numeric; _ttc numeric;
  _jou uuid; _c_client uuid; _c_prod uuid; _c_tva uuid;
  _e uuid; _num int; _is_avoir boolean;
begin
  select * into _f from public.factures where id = _facture_id for update;
  if _f.id is null then raise exception 'Facture introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _f.entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _f.statut <> 'brouillon' then raise exception 'Document déjà validé'; end if;

  select coalesce(sum(montant_ht), 0),
         coalesce(sum(round(montant_ht * taux_tva / 100, 2)), 0)
    into _ht, _tva
  from public.lignes_facture where facture_id = _facture_id;
  if _ht = 0 then raise exception 'Le document ne comporte aucune ligne'; end if;
  _ttc := _ht + _tva;

  _num := public.attribuer_numero_facture(_f.entreprise_id, _f.exercice_id, _f.type);
  update public.factures
    set numero = _num, statut = 'validee',
        total_ht = _ht, total_tva = _tva, total_ttc = _ttc, validee_le = now()
    where id = _facture_id;

  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_f.entreprise_id, auth.uid(), 'facture.valider', 'factures', _facture_id::text);

  if _f.type = 'devis' then return; end if;
  _is_avoir := (_f.type = 'avoir');

  select id into _jou from public.journaux
    where entreprise_id = _f.entreprise_id and type = 'ventes' and actif order by code limit 1;
  if _jou is null then raise exception 'Aucun journal de ventes actif : créez-en un d''abord.'; end if;

  select t.compte_id into _c_client from public.tiers t where t.id = _f.tiers_id;
  if _c_client is null then
    select id into _c_client from public.comptes
      where entreprise_id = _f.entreprise_id and numero like '411%' and actif order by numero limit 1;
  end if;
  select id into _c_prod from public.comptes
    where entreprise_id = _f.entreprise_id and numero like '70%' and actif order by numero limit 1;
  select id into _c_tva from public.comptes
    where entreprise_id = _f.entreprise_id and numero like '443%' and actif order by numero limit 1;

  if _c_client is null or _c_prod is null then
    raise exception 'Comptes requis manquants : un compte client (411) et un compte de produits (70).';
  end if;
  if _tva > 0 and _c_tva is null then
    raise exception 'Compte de TVA facturée (443) manquant dans le plan comptable.';
  end if;

  _num := public.attribuer_numero_ecriture(_f.entreprise_id, _f.exercice_id, _jou);
  insert into public.ecritures(entreprise_id, exercice_id, journal_id, numero, reference, date_piece, libelle, statut, validee_le, validee_par, created_by)
  values (_f.entreprise_id, _f.exercice_id, _jou, _num,
          upper(_f.type::text) || '-' || _num,
          _f.date_facture,
          (case when _is_avoir then 'Avoir ventes' else 'Facture ventes' end) || coalesce(' — ' || _f.objet, ''),
          'validee', now(), auth.uid(), auth.uid())
  returning id into _e;

  if not _is_avoir then
    insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit) values
      (_e, _f.entreprise_id, 1, _c_client, _f.tiers_id, 'Créance client', _ttc, 0),
      (_e, _f.entreprise_id, 2, _c_prod, null, 'Ventes', 0, _ht);
    if _tva > 0 then
      insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit)
      values (_e, _f.entreprise_id, 3, _c_tva, null, 'TVA facturée', 0, _tva);
    end if;
  else
    insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit) values
      (_e, _f.entreprise_id, 1, _c_prod, null, 'Ventes (avoir)', _ht, 0);
    if _tva > 0 then
      insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit)
      values (_e, _f.entreprise_id, 2, _c_tva, null, 'TVA (avoir)', _tva, 0);
    end if;
    insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit)
    values (_e, _f.entreprise_id, 3, _c_client, _f.tiers_id, 'Créance client (avoir)', 0, _ttc);
  end if;

  update public.factures set ecriture_id = _e where id = _facture_id;
end; $$;

create or replace function public.enregistrer_reglement(_facture_id uuid, _montant numeric)
returns void language plpgsql security definer set search_path = public as $$
declare _f public.factures; _paye numeric; _statut public.facture_statut;
begin
  select * into _f from public.factures where id = _facture_id for update;
  if _f.id is null then raise exception 'Facture introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _f.entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _f.type = 'devis' then raise exception 'Un devis ne peut pas être réglé'; end if;
  if _f.statut not in ('validee', 'envoyee', 'partiellement_payee') then
    raise exception 'Document non réglable (statut %).', _f.statut; end if;
  if _montant <= 0 then raise exception 'Montant invalide'; end if;

  _paye := _f.montant_paye + _montant;
  if _paye > _f.total_ttc then raise exception 'Le règlement dépasse le total TTC restant'; end if;
  _statut := case when _paye >= _f.total_ttc then 'payee' else 'partiellement_payee' end;

  update public.factures set montant_paye = _paye, statut = _statut where id = _facture_id;

  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id, payload)
  values (_f.entreprise_id, auth.uid(), 'facture.reglement', 'factures', _facture_id::text,
          jsonb_build_object('montant', _montant, 'cumul', _paye));
end; $$;

create or replace function public.valider_achat(_achat_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _a public.achats;
  _ht numeric; _tva numeric; _ttc numeric;
  _jou uuid; _c_charge uuid; _c_four uuid; _c_tva uuid;
  _e uuid; _num int;
begin
  select * into _a from public.achats where id = _achat_id for update;
  if _a.id is null then raise exception 'Achat introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _a.entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _a.statut <> 'brouillon' then raise exception 'Document déjà validé'; end if;

  select coalesce(sum(montant_ht), 0),
         coalesce(sum(round(montant_ht * taux_tva / 100, 2)), 0)
    into _ht, _tva
  from public.lignes_achat where achat_id = _achat_id;
  if _ht = 0 then raise exception 'Le document ne comporte aucune ligne'; end if;
  _ttc := _ht + _tva;

  _num := public.attribuer_numero_achat(_a.entreprise_id, _a.exercice_id);
  update public.achats
    set numero = _num, statut = 'validee',
        total_ht = _ht, total_tva = _tva, total_ttc = _ttc, validee_le = now()
    where id = _achat_id;

  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_a.entreprise_id, auth.uid(), 'achat.valider', 'achats', _achat_id::text);

  select id into _jou from public.journaux
    where entreprise_id = _a.entreprise_id and type = 'achats' and actif order by code limit 1;
  if _jou is null then raise exception 'Aucun journal d''achats actif : créez-en un d''abord.'; end if;

  _c_charge := _a.compte_charge_id;
  if _c_charge is null then
    select id into _c_charge from public.comptes
      where entreprise_id = _a.entreprise_id and numero like '60%' and actif order by numero limit 1;
  end if;
  select t.compte_id into _c_four from public.tiers t where t.id = _a.tiers_id;
  if _c_four is null then
    select id into _c_four from public.comptes
      where entreprise_id = _a.entreprise_id and numero like '401%' and actif order by numero limit 1;
  end if;
  select id into _c_tva from public.comptes
    where entreprise_id = _a.entreprise_id and numero like '445%' and actif order by numero limit 1;

  if _c_charge is null or _c_four is null then
    raise exception 'Comptes requis manquants : un compte de charges (60) et un compte fournisseur (401).';
  end if;
  if _tva > 0 and _c_tva is null then
    raise exception 'Compte de TVA récupérable (445) manquant dans le plan comptable.';
  end if;

  _num := public.attribuer_numero_ecriture(_a.entreprise_id, _a.exercice_id, _jou);
  insert into public.ecritures(entreprise_id, exercice_id, journal_id, numero, reference, date_piece, libelle, statut, validee_le, validee_par, created_by)
  values (_a.entreprise_id, _a.exercice_id, _jou, _num,
          coalesce(_a.reference_fournisseur, 'ACH-' || _num),
          _a.date_facture,
          'Facture fournisseur' || coalesce(' — ' || _a.objet, ''),
          'validee', now(), auth.uid(), auth.uid())
  returning id into _e;

  insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit) values
    (_e, _a.entreprise_id, 1, _c_charge, null, 'Charge', _ht, 0);
  if _tva > 0 then
    insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit)
    values (_e, _a.entreprise_id, 2, _c_tva, null, 'TVA récupérable', _tva, 0);
  end if;
  insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit)
  values (_e, _a.entreprise_id, 3, _c_four, _a.tiers_id, 'Dette fournisseur', 0, _ttc);

  update public.achats set ecriture_id = _e where id = _achat_id;
end; $$;

create or replace function public.enregistrer_paiement_achat(_achat_id uuid, _montant numeric)
returns void language plpgsql security definer set search_path = public as $$
declare _a public.achats; _paye numeric; _statut public.achat_statut;
begin
  select * into _a from public.achats where id = _achat_id for update;
  if _a.id is null then raise exception 'Achat introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _a.entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _a.statut not in ('validee', 'partiellement_payee') then
    raise exception 'Document non payable (statut %).', _a.statut; end if;
  if _montant <= 0 then raise exception 'Montant invalide'; end if;
  _paye := _a.montant_paye + _montant;
  if _paye > _a.total_ttc then raise exception 'Le paiement dépasse le total TTC restant'; end if;
  _statut := case when _paye >= _a.total_ttc then 'payee' else 'partiellement_payee' end;
  update public.achats set montant_paye = _paye, statut = _statut where id = _achat_id;

  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id, payload)
  values (_a.entreprise_id, auth.uid(), 'achat.paiement', 'achats', _achat_id::text,
          jsonb_build_object('montant', _montant, 'cumul', _paye));
end; $$;
