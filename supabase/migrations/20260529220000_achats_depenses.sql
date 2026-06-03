-- =========================================================================
-- MODULE 8 — ACHATS ET DÉPENSES (factures fournisseurs)
-- Cahier des charges v1.1, §Module 8 (P1) :
--  - factures fournisseurs avec lignes et TVA déductible ;
--  - numéro interne atomique par exercice (le n° légal est celui du fournisseur,
--    conservé dans reference_fournisseur) ;
--  - écriture d'achat AUTOMATIQUE et équilibrée à la validation :
--      Débit charge (HT) + Débit TVA récupérable / Crédit fournisseur (TTC) ;
--  - suivi des paiements (montant payé, statut).
-- =========================================================================

create type public.achat_statut as enum (
  'brouillon', 'validee', 'partiellement_payee', 'payee', 'annulee'
);

create table public.achats (
  id                  uuid primary key default gen_random_uuid(),
  entreprise_id       uuid not null references public.entreprises(id) on delete cascade,
  exercice_id         uuid not null references public.exercices(id),
  tiers_id            uuid references public.tiers(id),
  numero              integer,
  reference_fournisseur text,
  date_facture        date not null default current_date,
  date_echeance       date,
  objet               text,
  statut              public.achat_statut not null default 'brouillon',
  compte_charge_id    uuid references public.comptes(id),
  total_ht            numeric(18,2) not null default 0,
  total_tva           numeric(18,2) not null default 0,
  total_ttc           numeric(18,2) not null default 0,
  montant_paye        numeric(18,2) not null default 0 check (montant_paye >= 0),
  ecriture_id         uuid references public.ecritures(id),
  validee_le          timestamptz,
  created_by          uuid not null default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_achats_ent_exo on public.achats(entreprise_id, exercice_id);
create index idx_achats_tiers on public.achats(tiers_id);
create unique index uq_achats_numero
  on public.achats (entreprise_id, exercice_id, numero) where numero is not null;
alter table public.achats enable row level security;

create policy "achats_select_members" on public.achats
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "achats_insert_comptables" on public.achats
  for insert to authenticated
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create policy "achats_update_members" on public.achats
  for update to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create policy "achats_delete_brouillon" on public.achats
  for delete to authenticated
  using (
    public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin']::membership_role[])
    and statut = 'brouillon'
  );

create trigger trg_achats_updated before update on public.achats
  for each row execute function public.set_updated_at();

create table public.lignes_achat (
  id            uuid primary key default gen_random_uuid(),
  achat_id      uuid not null references public.achats(id) on delete cascade,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  ordre         smallint not null default 1,
  designation   text not null,
  quantite      numeric(18,3) not null default 1 check (quantite > 0),
  prix_unitaire numeric(18,2) not null default 0 check (prix_unitaire >= 0),
  taux_tva      numeric(5,2) not null default 19.25 check (taux_tva >= 0),
  montant_ht    numeric(18,2) not null default 0,
  created_at    timestamptz not null default now()
);
create index idx_lignes_achat on public.lignes_achat(achat_id);
alter table public.lignes_achat enable row level security;

create policy "lignes_achat_select_members" on public.lignes_achat
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "lignes_achat_cud" on public.lignes_achat
  for all to authenticated
  using (
    public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and exists (select 1 from public.achats a where a.id = achat_id and a.statut = 'brouillon')
  )
  with check (
    public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and exists (select 1 from public.achats a where a.id = achat_id and a.statut = 'brouillon')
  );

-- Numéro interne atomique par exercice.
create table public.compteurs_achat (
  entreprise_id  uuid not null references public.entreprises(id) on delete cascade,
  exercice_id    uuid not null references public.exercices(id) on delete cascade,
  dernier_numero integer not null default 0,
  primary key (entreprise_id, exercice_id)
);
alter table public.compteurs_achat enable row level security;
create policy "compteurs_achat_select_members" on public.compteurs_achat
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));

create or replace function public.attribuer_numero_achat(_entreprise_id uuid, _exercice_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare _num integer;
begin
  insert into public.compteurs_achat (entreprise_id, exercice_id, dernier_numero)
  values (_entreprise_id, _exercice_id, 1)
  on conflict (entreprise_id, exercice_id)
    do update set dernier_numero = public.compteurs_achat.dernier_numero + 1
  returning dernier_numero into _num;
  return _num;
end; $$;
revoke execute on function public.attribuer_numero_achat(uuid, uuid) from public, anon, authenticated;

-- Validation : numéro interne + écriture d'achat automatique et équilibrée.
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

revoke execute on function public.valider_achat(uuid) from public, anon;
revoke execute on function public.enregistrer_paiement_achat(uuid, numeric) from public, anon;
grant execute on function public.valider_achat(uuid) to authenticated;
grant execute on function public.enregistrer_paiement_achat(uuid, numeric) to authenticated;
