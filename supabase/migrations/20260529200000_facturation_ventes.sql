-- =========================================================================
-- MODULE 7 — FACTURATION DES VENTES (devis → facture → avoir)
-- Cahier des charges v1.1, §Module 7 (P1) :
--  - documents devis / facture / avoir avec lignes et TVA ;
--  - numérotation légale par exercice et par type, attribuée de façon ATOMIQUE
--    à la validation (cohérent avec la numérotation des écritures) ;
--  - écriture de vente AUTOMATIQUE et équilibrée à la validation ;
--  - suivi des règlements (montant payé, statut).
-- Les montants sont en numeric(18,2). L'écriture d'encaissement (trésorerie)
-- relève du module Trésorerie ; ici on suit seulement le montant réglé.
-- =========================================================================

create type public.facture_type as enum ('devis', 'facture', 'avoir');
create type public.facture_statut as enum (
  'brouillon', 'validee', 'envoyee', 'partiellement_payee', 'payee', 'annulee'
);

create table public.factures (
  id              uuid primary key default gen_random_uuid(),
  entreprise_id   uuid not null references public.entreprises(id) on delete cascade,
  exercice_id     uuid not null references public.exercices(id),
  tiers_id        uuid references public.tiers(id),
  type            public.facture_type not null default 'facture',
  numero          integer,
  date_facture    date not null default current_date,
  date_echeance   date,
  objet           text,
  statut          public.facture_statut not null default 'brouillon',
  total_ht        numeric(18,2) not null default 0,
  total_tva       numeric(18,2) not null default 0,
  total_ttc       numeric(18,2) not null default 0,
  montant_paye    numeric(18,2) not null default 0 check (montant_paye >= 0),
  facture_origine_id uuid references public.factures(id), -- avoir → facture d'origine
  ecriture_id     uuid references public.ecritures(id),
  validee_le      timestamptz,
  created_by      uuid not null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_factures_ent_exo on public.factures(entreprise_id, exercice_id);
create index idx_factures_tiers on public.factures(tiers_id);
create unique index uq_factures_numero
  on public.factures (entreprise_id, exercice_id, type, numero)
  where numero is not null;
alter table public.factures enable row level security;

create policy "factures_select_members" on public.factures
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "factures_insert_comptables" on public.factures
  for insert to authenticated
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create policy "factures_update_brouillon" on public.factures
  for update to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create policy "factures_delete_brouillon" on public.factures
  for delete to authenticated
  using (
    public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin']::membership_role[])
    and statut = 'brouillon'
  );

create trigger trg_factures_updated before update on public.factures
  for each row execute function public.set_updated_at();

create table public.lignes_facture (
  id            uuid primary key default gen_random_uuid(),
  facture_id    uuid not null references public.factures(id) on delete cascade,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  ordre         smallint not null default 1,
  designation   text not null,
  quantite      numeric(18,3) not null default 1 check (quantite > 0),
  prix_unitaire numeric(18,2) not null default 0 check (prix_unitaire >= 0),
  taux_tva      numeric(5,2) not null default 19.25 check (taux_tva >= 0),
  montant_ht    numeric(18,2) not null default 0,
  created_at    timestamptz not null default now()
);
create index idx_lignes_facture on public.lignes_facture(facture_id);
alter table public.lignes_facture enable row level security;

create policy "lignes_facture_select_members" on public.lignes_facture
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "lignes_facture_cud" on public.lignes_facture
  for all to authenticated
  using (
    public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and exists (select 1 from public.factures f where f.id = facture_id and f.statut = 'brouillon')
  )
  with check (
    public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and exists (select 1 from public.factures f where f.id = facture_id and f.statut = 'brouillon')
  );

-- =========================================================================
-- Numérotation légale atomique par (entreprise, exercice, type de document).
-- =========================================================================
create table public.compteurs_facture (
  entreprise_id  uuid not null references public.entreprises(id) on delete cascade,
  exercice_id    uuid not null references public.exercices(id) on delete cascade,
  type           public.facture_type not null,
  dernier_numero integer not null default 0,
  primary key (entreprise_id, exercice_id, type)
);
alter table public.compteurs_facture enable row level security;
create policy "compteurs_facture_select_members" on public.compteurs_facture
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));

create or replace function public.attribuer_numero_facture(
  _entreprise_id uuid, _exercice_id uuid, _type public.facture_type
) returns integer
language plpgsql security definer set search_path = public as $$
declare _num integer;
begin
  insert into public.compteurs_facture (entreprise_id, exercice_id, type, dernier_numero)
  values (_entreprise_id, _exercice_id, _type, 1)
  on conflict (entreprise_id, exercice_id, type)
    do update set dernier_numero = public.compteurs_facture.dernier_numero + 1
  returning dernier_numero into _num;
  return _num;
end; $$;
revoke execute on function public.attribuer_numero_facture(uuid, uuid, public.facture_type) from public, anon, authenticated;

-- =========================================================================
-- Validation : numéro légal + écriture de vente automatique et équilibrée.
-- =========================================================================
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

  -- Un devis ne génère pas d'écriture comptable.
  if _f.type = 'devis' then return; end if;
  _is_avoir := (_f.type = 'avoir');

  -- Résolution des comptes (paramétrage minimal du plan OHADA).
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
    -- Vente : Débit client (TTC) / Crédit produits (HT) + Crédit TVA
    insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit) values
      (_e, _f.entreprise_id, 1, _c_client, _f.tiers_id, 'Créance client', _ttc, 0),
      (_e, _f.entreprise_id, 2, _c_prod, null, 'Ventes', 0, _ht);
    if _tva > 0 then
      insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit)
      values (_e, _f.entreprise_id, 3, _c_tva, null, 'TVA facturée', 0, _tva);
    end if;
  else
    -- Avoir : sens inverse
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

-- =========================================================================
-- Enregistrement d'un règlement (met à jour le montant payé et le statut).
-- =========================================================================
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

revoke execute on function public.valider_facture(uuid) from public, anon;
revoke execute on function public.enregistrer_reglement(uuid, numeric) from public, anon;
grant execute on function public.valider_facture(uuid) to authenticated;
grant execute on function public.enregistrer_reglement(uuid, numeric) to authenticated;
