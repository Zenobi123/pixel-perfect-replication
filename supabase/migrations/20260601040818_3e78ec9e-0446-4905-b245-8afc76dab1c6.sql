-- =========================================================================
-- NUMÉROTATION ATOMIQUE DES ÉCRITURES
-- =========================================================================
alter table public.ecritures alter column numero drop not null;
alter table public.ecritures
  drop constraint if exists ecritures_entreprise_id_exercice_id_journal_id_numero_key;
create unique index if not exists uq_ecritures_numero
  on public.ecritures (entreprise_id, exercice_id, journal_id, numero)
  where numero is not null;

create table if not exists public.compteurs_ecriture (
  entreprise_id  uuid not null references public.entreprises(id) on delete cascade,
  exercice_id    uuid not null references public.exercices(id) on delete cascade,
  journal_id     uuid not null references public.journaux(id) on delete cascade,
  dernier_numero integer not null default 0,
  primary key (entreprise_id, exercice_id, journal_id)
);
alter table public.compteurs_ecriture enable row level security;
create policy "compteurs_select_members" on public.compteurs_ecriture
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));

insert into public.compteurs_ecriture (entreprise_id, exercice_id, journal_id, dernier_numero)
select entreprise_id, exercice_id, journal_id, max(numero)
from public.ecritures
where numero is not null
group by entreprise_id, exercice_id, journal_id
on conflict (entreprise_id, exercice_id, journal_id) do update
  set dernier_numero = greatest(public.compteurs_ecriture.dernier_numero, excluded.dernier_numero);

create or replace function public.attribuer_numero_ecriture(
  _entreprise_id uuid, _exercice_id uuid, _journal_id uuid
) returns integer language plpgsql security definer set search_path = public as $$
declare _num integer;
begin
  insert into public.compteurs_ecriture (entreprise_id, exercice_id, journal_id, dernier_numero)
  values (_entreprise_id, _exercice_id, _journal_id, 1)
  on conflict (entreprise_id, exercice_id, journal_id)
    do update set dernier_numero = public.compteurs_ecriture.dernier_numero + 1
  returning dernier_numero into _num;
  return _num;
end; $$;
revoke execute on function public.attribuer_numero_ecriture(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.validate_ecriture(_ecriture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _ent uuid; _exo uuid; _jou uuid; _statut ecriture_statut;
  _debit numeric; _credit numeric; _nb int; _num int;
begin
  select entreprise_id, exercice_id, journal_id, statut into _ent, _exo, _jou, _statut
  from public.ecritures where id = _ecriture_id;
  if _ent is null then raise exception 'Écriture introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _statut <> 'brouillon' then raise exception 'Écriture déjà validée'; end if;
  select coalesce(sum(debit),0), coalesce(sum(credit),0), count(*) into _debit, _credit, _nb
  from public.lignes_ecriture where ecriture_id = _ecriture_id;
  if _nb < 2 then raise exception 'Au moins 2 lignes requises'; end if;
  if _debit <> _credit then raise exception 'Écriture non équilibrée: débit=% crédit=%', _debit, _credit; end if;
  if _debit = 0 then raise exception 'Montants nuls'; end if;
  _num := public.attribuer_numero_ecriture(_ent, _exo, _jou);
  update public.ecritures
    set statut = 'validee', numero = _num, validee_le = now(), validee_par = auth.uid()
    where id = _ecriture_id;
  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_ent, auth.uid(), 'ecriture.validate', 'ecritures', _ecriture_id::text);
end; $$;

create or replace function public.contrepasser_ecriture(_ecriture_id uuid, _date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare _src record; _new_id uuid; _next int;
begin
  select * into _src from public.ecritures where id = _ecriture_id;
  if _src is null then raise exception 'Écriture introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _src.entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
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

-- =========================================================================
-- PÉRIODES
-- =========================================================================
create type public.periode_statut as enum ('ouverte', 'en_revue', 'verrouillee', 'cloturee');

create table public.periodes (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  exercice_id   uuid not null references public.exercices(id) on delete cascade,
  libelle       text not null,
  date_debut    date not null,
  date_fin      date not null,
  statut        public.periode_statut not null default 'ouverte',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (date_fin >= date_debut),
  unique (exercice_id, date_debut)
);
create index idx_periodes_ent_exo on public.periodes(entreprise_id, exercice_id);
alter table public.periodes enable row level security;
create policy "periodes_select_members" on public.periodes
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "periodes_insert_admins" on public.periodes
  for insert to authenticated
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create trigger trg_periodes_updated before update on public.periodes
  for each row execute function public.set_updated_at();

create or replace function public.generer_periodes(_exercice_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare _ent uuid; _deb date; _fin date; _m date; _n int := 0;
begin
  select entreprise_id, date_debut, date_fin into _ent, _deb, _fin from public.exercices where id = _exercice_id;
  if _ent is null then raise exception 'Exercice introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  for _m in select generate_series(date_trunc('month', _deb), date_trunc('month', _fin), interval '1 month')::date loop
    insert into public.periodes (entreprise_id, exercice_id, libelle, date_debut, date_fin)
    values (_ent, _exercice_id, 'Période ' || to_char(_m, 'MM/YYYY'),
            greatest(_m, _deb), least((_m + interval '1 month - 1 day')::date, _fin))
    on conflict (exercice_id, date_debut) do nothing;
    _n := _n + 1;
  end loop;
  return _n;
end; $$;

create or replace function public.mettre_en_revue_periode(_periode_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _ent uuid; _st periode_statut;
begin
  select entreprise_id, statut into _ent, _st from public.periodes where id = _periode_id;
  if _ent is null then raise exception 'Période introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _st = 'cloturee' then raise exception 'Période clôturée'; end if;
  update public.periodes set statut = 'en_revue' where id = _periode_id;
  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_ent, auth.uid(), 'periode.en_revue', 'periodes', _periode_id::text);
end; $$;

create or replace function public.verrouiller_periode(_periode_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _ent uuid; _st periode_statut;
begin
  select entreprise_id, statut into _ent, _st from public.periodes where id = _periode_id;
  if _ent is null then raise exception 'Période introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _st = 'cloturee' then raise exception 'Période déjà clôturée'; end if;
  update public.periodes set statut = 'verrouillee' where id = _periode_id;
  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_ent, auth.uid(), 'periode.verrouiller', 'periodes', _periode_id::text);
end; $$;

create or replace function public.cloturer_periode(_periode_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _ent uuid; _exo uuid; _deb date; _fin date; _nb int;
begin
  select entreprise_id, exercice_id, date_debut, date_fin into _ent, _exo, _deb, _fin
  from public.periodes where id = _periode_id;
  if _ent is null then raise exception 'Période introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  select count(*) into _nb from public.ecritures e
  where e.entreprise_id = _ent and e.exercice_id = _exo
    and e.date_piece between _deb and _fin and e.statut = 'brouillon';
  if _nb > 0 then raise exception 'Clôture impossible : % écriture(s) en brouillon sur la période.', _nb; end if;
  update public.periodes set statut = 'cloturee' where id = _periode_id;
  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_ent, auth.uid(), 'periode.cloturer', 'periodes', _periode_id::text);
end; $$;

create or replace function public.rouvrir_periode(_periode_id uuid, _motif text)
returns void language plpgsql security definer set search_path = public as $$
declare _ent uuid;
begin
  if _motif is null or length(trim(_motif)) < 3 then raise exception 'Un motif de réouverture est requis'; end if;
  select entreprise_id into _ent from public.periodes where id = _periode_id;
  if _ent is null then raise exception 'Période introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  update public.periodes set statut = 'ouverte' where id = _periode_id;
  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id, payload)
  values (_ent, auth.uid(), 'periode.rouvrir', 'periodes', _periode_id::text, jsonb_build_object('motif', _motif));
end; $$;

create or replace function public.check_periode_ouverte()
returns trigger language plpgsql security definer set search_path = public as $$
declare _statut periode_statut;
begin
  select p.statut into _statut from public.periodes p
  where p.entreprise_id = new.entreprise_id and p.exercice_id = new.exercice_id
    and new.date_piece between p.date_debut and p.date_fin limit 1;
  if _statut in ('verrouillee', 'cloturee') then
    raise exception 'Saisie interdite : la période du % est %.', new.date_piece, _statut;
  end if;
  return new;
end; $$;
create trigger trg_ecritures_periode before insert or update on public.ecritures
  for each row execute function public.check_periode_ouverte();

revoke execute on function public.generer_periodes(uuid) from public, anon;
revoke execute on function public.mettre_en_revue_periode(uuid) from public, anon;
revoke execute on function public.verrouiller_periode(uuid) from public, anon;
revoke execute on function public.cloturer_periode(uuid) from public, anon;
revoke execute on function public.rouvrir_periode(uuid, text) from public, anon;
grant execute on function public.generer_periodes(uuid) to authenticated;
grant execute on function public.mettre_en_revue_periode(uuid) to authenticated;
grant execute on function public.verrouiller_periode(uuid) to authenticated;
grant execute on function public.cloturer_periode(uuid) to authenticated;
grant execute on function public.rouvrir_periode(uuid, text) to authenticated;

-- Onboarding : exercice + plan OHADA + périodes mensuelles.
create or replace function public.create_entreprise_with_owner(
  _raison_sociale text, _niu text default null,
  _regime regime_fiscal default 'reel', _devise text default 'XAF',
  _exercice_debut date default null, _exercice_fin date default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  _ent_id uuid; _exo_id uuid; _uid uuid := auth.uid();
  _deb date := coalesce(_exercice_debut, date_trunc('year', current_date)::date);
  _fin date := coalesce(_exercice_fin, (date_trunc('year', current_date) + interval '1 year - 1 day')::date);
  _m date;
begin
  if _uid is null then raise exception 'Non authentifié'; end if;
  insert into public.entreprises (raison_sociale, niu, regime_fiscal, devise, created_by)
  values (_raison_sociale, _niu, _regime, _devise, _uid) returning id into _ent_id;
  insert into public.memberships (entreprise_id, user_id, role) values (_ent_id, _uid, 'owner');
  insert into public.exercices (entreprise_id, libelle, date_debut, date_fin)
  values (_ent_id, 'Exercice ' || extract(year from _deb)::text, _deb, _fin) returning id into _exo_id;
  perform public.seed_plan_ohada(_ent_id);
  for _m in select generate_series(date_trunc('month', _deb), date_trunc('month', _fin), interval '1 month')::date loop
    insert into public.periodes (entreprise_id, exercice_id, libelle, date_debut, date_fin)
    values (_ent_id, _exo_id, 'Période ' || to_char(_m, 'MM/YYYY'),
            greatest(_m, _deb), least((_m + interval '1 month - 1 day')::date, _fin))
    on conflict (exercice_id, date_debut) do nothing;
  end loop;
  insert into public.audit_log (entreprise_id, user_id, action, table_name, record_id)
  values (_ent_id, _uid, 'entreprise.create', 'entreprises', _ent_id::text);
  return _ent_id;
end; $$;

-- =========================================================================
-- DOCUMENTS / PIÈCES JUSTIFICATIVES (bucket privé + RLS storage)
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pieces', 'pieces', false, 10485760,
        array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create type public.document_type as enum (
  'facture_client','facture_fournisseur','recu','releve_bancaire',
  'contrat','declaration','quittance','document_social','autre'
);

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  ecriture_id   uuid references public.ecritures(id) on delete set null,
  type          public.document_type not null default 'autre',
  nom_fichier   text not null,
  chemin        text not null unique,
  taille        bigint,
  mime          text,
  created_by    uuid not null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index idx_documents_ent on public.documents(entreprise_id);
create index idx_documents_ecriture on public.documents(ecriture_id);
alter table public.documents enable row level security;
create policy "documents_select_members" on public.documents
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "documents_insert_members" on public.documents
  for insert to authenticated
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create policy "documents_delete_admins" on public.documents
  for delete to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin']::membership_role[]));

create policy "pieces_select_members" on storage.objects
  for select to authenticated
  using (bucket_id = 'pieces' and public.is_member_of(auth.uid(), ((storage.foldername(name))[1])::uuid));
create policy "pieces_insert_members" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pieces' and public.has_membership_role(
    auth.uid(), ((storage.foldername(name))[1])::uuid,
    array['owner','admin','comptable']::membership_role[]));
create policy "pieces_delete_admins" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pieces' and public.has_membership_role(
    auth.uid(), ((storage.foldername(name))[1])::uuid,
    array['owner','admin']::membership_role[]));

-- =========================================================================
-- ABONNEMENT MANUEL + gating saisie
-- =========================================================================
alter table public.entreprises add column if not exists abonnement_jusqu_au timestamptz;

create or replace function public.activer_abonnement(
  _entreprise_id uuid, _statut public.subscription_status, _jusqu_au timestamptz default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Réservé à l''administrateur de la plateforme'; end if;
  update public.entreprises
    set subscription_status = _statut,
        abonnement_jusqu_au = coalesce(_jusqu_au, abonnement_jusqu_au)
    where id = _entreprise_id;
  if not found then raise exception 'Entreprise introuvable'; end if;
  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id, payload)
  values (_entreprise_id, auth.uid(), 'abonnement.activer', 'entreprises', _entreprise_id::text,
          jsonb_build_object('statut', _statut, 'jusqu_au', _jusqu_au));
end; $$;
revoke execute on function public.activer_abonnement(uuid, public.subscription_status, timestamptz) from public, anon;
grant execute on function public.activer_abonnement(uuid, public.subscription_status, timestamptz) to authenticated;

create or replace function public.check_abonnement_actif()
returns trigger language plpgsql security definer set search_path = public as $$
declare _st public.subscription_status;
begin
  select subscription_status into _st from public.entreprises where id = new.entreprise_id;
  if _st in ('suspendu','expire') then
    raise exception 'Abonnement % : la création de nouvelles écritures est bloquée. Les consultations et exports restent disponibles.', _st;
  end if;
  return new;
end; $$;
create trigger trg_ecritures_abonnement before insert on public.ecritures
  for each row execute function public.check_abonnement_actif();

-- =========================================================================
-- FACTURATION VENTES
-- =========================================================================
create type public.facture_type as enum ('devis','facture','avoir');
create type public.facture_statut as enum (
  'brouillon','validee','envoyee','partiellement_payee','payee','annulee'
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
  facture_origine_id uuid references public.factures(id),
  ecriture_id     uuid references public.ecritures(id),
  validee_le      timestamptz,
  created_by      uuid not null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_factures_ent_exo on public.factures(entreprise_id, exercice_id);
create index idx_factures_tiers on public.factures(tiers_id);
create unique index uq_factures_numero on public.factures (entreprise_id, exercice_id, type, numero) where numero is not null;
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
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin']::membership_role[]) and statut = 'brouillon');
create trigger trg_factures_updated before update on public.factures for each row execute function public.set_updated_at();

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
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and exists (select 1 from public.factures f where f.id = facture_id and f.statut = 'brouillon'))
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and exists (select 1 from public.factures f where f.id = facture_id and f.statut = 'brouillon'));

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
) returns integer language plpgsql security definer set search_path = public as $$
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

create or replace function public.valider_facture(_facture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _f public.factures; _ht numeric; _tva numeric; _ttc numeric;
  _jou uuid; _c_client uuid; _c_prod uuid; _c_tva uuid;
  _e uuid; _num int; _is_avoir boolean;
begin
  select * into _f from public.factures where id = _facture_id;
  if _f.id is null then raise exception 'Facture introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _f.entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _f.statut <> 'brouillon' then raise exception 'Document déjà validé'; end if;
  select coalesce(sum(montant_ht),0), coalesce(sum(round(montant_ht * taux_tva / 100, 2)),0)
    into _ht, _tva from public.lignes_facture where facture_id = _facture_id;
  if _ht = 0 then raise exception 'Le document ne comporte aucune ligne'; end if;
  _ttc := _ht + _tva;
  _num := public.attribuer_numero_facture(_f.entreprise_id, _f.exercice_id, _f.type);
  update public.factures set numero = _num, statut = 'validee',
    total_ht = _ht, total_tva = _tva, total_ttc = _ttc, validee_le = now()
    where id = _facture_id;
  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_f.entreprise_id, auth.uid(), 'facture.valider', 'factures', _facture_id::text);
  if _f.type = 'devis' then return; end if;
  _is_avoir := (_f.type = 'avoir');
  select id into _jou from public.journaux where entreprise_id = _f.entreprise_id and type = 'ventes' and actif order by code limit 1;
  if _jou is null then raise exception 'Aucun journal de ventes actif : créez-en un d''abord.'; end if;
  select t.compte_id into _c_client from public.tiers t where t.id = _f.tiers_id;
  if _c_client is null then
    select id into _c_client from public.comptes where entreprise_id = _f.entreprise_id and numero like '411%' and actif order by numero limit 1;
  end if;
  select id into _c_prod from public.comptes where entreprise_id = _f.entreprise_id and numero like '70%' and actif order by numero limit 1;
  select id into _c_tva from public.comptes where entreprise_id = _f.entreprise_id and numero like '443%' and actif order by numero limit 1;
  if _c_client is null or _c_prod is null then
    raise exception 'Comptes requis manquants : un compte client (411) et un compte de produits (70).'; end if;
  if _tva > 0 and _c_tva is null then raise exception 'Compte de TVA facturée (443) manquant dans le plan comptable.'; end if;
  _num := public.attribuer_numero_ecriture(_f.entreprise_id, _f.exercice_id, _jou);
  insert into public.ecritures(entreprise_id, exercice_id, journal_id, numero, reference, date_piece, libelle, statut, validee_le, validee_par, created_by)
  values (_f.entreprise_id, _f.exercice_id, _jou, _num,
          upper(_f.type::text) || '-' || _num, _f.date_facture,
          (case when _is_avoir then 'Avoir ventes' else 'Facture ventes' end) || coalesce(' — ' || _f.objet, ''),
          'validee', now(), auth.uid(), auth.uid()) returning id into _e;
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
  select * into _f from public.factures where id = _facture_id;
  if _f.id is null then raise exception 'Facture introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _f.entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _f.type = 'devis' then raise exception 'Un devis ne peut pas être réglé'; end if;
  if _f.statut not in ('validee','envoyee','partiellement_payee') then
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

-- =========================================================================
-- ACHATS / DÉPENSES
-- =========================================================================
create type public.achat_statut as enum ('brouillon','validee','partiellement_payee','payee','annulee');

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
create unique index uq_achats_numero on public.achats (entreprise_id, exercice_id, numero) where numero is not null;
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
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin']::membership_role[]) and statut = 'brouillon');
create trigger trg_achats_updated before update on public.achats for each row execute function public.set_updated_at();

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
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and exists (select 1 from public.achats a where a.id = achat_id and a.statut = 'brouillon'))
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and exists (select 1 from public.achats a where a.id = achat_id and a.statut = 'brouillon'));

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

create or replace function public.valider_achat(_achat_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _a public.achats; _ht numeric; _tva numeric; _ttc numeric;
  _jou uuid; _c_charge uuid; _c_four uuid; _c_tva uuid; _e uuid; _num int;
begin
  select * into _a from public.achats where id = _achat_id;
  if _a.id is null then raise exception 'Achat introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _a.entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _a.statut <> 'brouillon' then raise exception 'Document déjà validé'; end if;
  select coalesce(sum(montant_ht),0), coalesce(sum(round(montant_ht * taux_tva / 100, 2)),0)
    into _ht, _tva from public.lignes_achat where achat_id = _achat_id;
  if _ht = 0 then raise exception 'Le document ne comporte aucune ligne'; end if;
  _ttc := _ht + _tva;
  select id into _jou from public.journaux where entreprise_id = _a.entreprise_id and type = 'achats' and actif order by code limit 1;
  if _jou is null then raise exception 'Aucun journal d''achats actif : créez-en un d''abord.'; end if;
  select t.compte_id into _c_four from public.tiers t where t.id = _a.tiers_id;
  if _c_four is null then
    select id into _c_four from public.comptes where entreprise_id = _a.entreprise_id and numero like '401%' and actif order by numero limit 1;
  end if;
  _c_charge := _a.compte_charge_id;
  if _c_charge is null then
    select id into _c_charge from public.comptes where entreprise_id = _a.entreprise_id and numero like '60%' and actif order by numero limit 1;
  end if;
  select id into _c_tva from public.comptes where entreprise_id = _a.entreprise_id and numero like '445%' and actif order by numero limit 1;
  if _c_four is null or _c_charge is null then
    raise exception 'Comptes requis manquants : un compte fournisseur (401) et un compte de charge (6).'; end if;
  if _tva > 0 and _c_tva is null then raise exception 'Compte de TVA récupérable (445) manquant.'; end if;

  _num := public.attribuer_numero_achat(_a.entreprise_id, _a.exercice_id);
  update public.achats set numero = _num, statut = 'validee',
    total_ht = _ht, total_tva = _tva, total_ttc = _ttc, validee_le = now()
    where id = _achat_id;
  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_a.entreprise_id, auth.uid(), 'achat.valider', 'achats', _achat_id::text);

  _num := public.attribuer_numero_ecriture(_a.entreprise_id, _a.exercice_id, _jou);
  insert into public.ecritures(entreprise_id, exercice_id, journal_id, numero, reference, date_piece, libelle, statut, validee_le, validee_par, created_by)
  values (_a.entreprise_id, _a.exercice_id, _jou, _num,
          coalesce(_a.reference_fournisseur, 'ACH-' || _num), _a.date_facture,
          'Facture fournisseur' || coalesce(' — ' || _a.objet, ''),
          'validee', now(), auth.uid(), auth.uid()) returning id into _e;
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
  select * into _a from public.achats where id = _achat_id;
  if _a.id is null then raise exception 'Achat introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _a.entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _a.statut not in ('validee','partiellement_payee') then
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

-- =========================================================================
-- GRANTs Data API
-- =========================================================================
grant select, insert, update, delete on public.periodes to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.factures to authenticated;
grant select, insert, update, delete on public.lignes_facture to authenticated;
grant select, insert, update, delete on public.achats to authenticated;
grant select, insert, update, delete on public.lignes_achat to authenticated;
grant select on public.compteurs_ecriture to authenticated;
grant select on public.compteurs_facture to authenticated;
grant select on public.compteurs_achat to authenticated;
grant all on public.periodes, public.documents, public.factures, public.lignes_facture,
              public.achats, public.lignes_achat, public.compteurs_ecriture,
              public.compteurs_facture, public.compteurs_achat to service_role;