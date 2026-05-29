-- =========================================================================
-- MODULE 4 — EXERCICES, PÉRIODES ET CLÔTURES
-- Cahier des charges v1.1, §Module 4 et critère d'acceptation global n°7
-- (« Les périodes peuvent être verrouillées et clôturées »).
--
-- Apporte : périodes mensuelles, états ouverte/en_revue/verrouillée/clôturée,
-- verrouillage, réouverture justifiée, clôture (interdite si brouillons), et
-- blocage de toute saisie dans une période verrouillée ou clôturée.
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
-- Les transitions d'état passent exclusivement par les fonctions SECURITY
-- DEFINER ci-dessous (contrôles métier + audit) : pas d'UPDATE direct.
create policy "periodes_insert_admins" on public.periodes
  for insert to authenticated
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));

create trigger trg_periodes_updated before update on public.periodes
  for each row execute function public.set_updated_at();

-- =========================================================================
-- Génération des périodes mensuelles d'un exercice (idempotente).
-- =========================================================================
create or replace function public.generer_periodes(_exercice_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _ent uuid;
  _deb date;
  _fin date;
  _m date;
  _n int := 0;
begin
  select entreprise_id, date_debut, date_fin into _ent, _deb, _fin
  from public.exercices where id = _exercice_id;
  if _ent is null then raise exception 'Exercice introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé';
  end if;

  for _m in
    select generate_series(date_trunc('month', _deb), date_trunc('month', _fin), interval '1 month')::date
  loop
    insert into public.periodes (entreprise_id, exercice_id, libelle, date_debut, date_fin)
    values (
      _ent, _exercice_id,
      'Période ' || to_char(_m, 'MM/YYYY'),
      greatest(_m, _deb),
      least((_m + interval '1 month - 1 day')::date, _fin)
    )
    on conflict (exercice_id, date_debut) do nothing;
    _n := _n + 1;
  end loop;
  return _n;
end; $$;

-- =========================================================================
-- Transitions d'état d'une période.
-- =========================================================================
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

-- Clôture : impossible s'il subsiste des écritures en brouillon sur la période
-- (cahier §Module 4, critères d'acceptation).
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
  if _nb > 0 then
    raise exception 'Clôture impossible : % écriture(s) en brouillon sur la période.', _nb;
  end if;
  update public.periodes set statut = 'cloturee' where id = _periode_id;
  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_ent, auth.uid(), 'periode.cloturer', 'periodes', _periode_id::text);
end; $$;

-- Réouverture contrôlée : motif obligatoire et rôle admin/owner (cahier :
-- « Une réouverture exige un motif et une autorisation »).
create or replace function public.rouvrir_periode(_periode_id uuid, _motif text)
returns void language plpgsql security definer set search_path = public as $$
declare _ent uuid;
begin
  if _motif is null or length(trim(_motif)) < 3 then
    raise exception 'Un motif de réouverture est requis';
  end if;
  select entreprise_id into _ent from public.periodes where id = _periode_id;
  if _ent is null then raise exception 'Période introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  update public.periodes set statut = 'ouverte' where id = _periode_id;
  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id, payload)
  values (_ent, auth.uid(), 'periode.rouvrir', 'periodes', _periode_id::text,
          jsonb_build_object('motif', _motif));
end; $$;

-- =========================================================================
-- Blocage de la saisie dans une période verrouillée ou clôturée.
-- S'applique à la création comme à la modification (donc aussi à la
-- validation et à la contrepassation, qui écrivent dans la période).
-- =========================================================================
create or replace function public.check_periode_ouverte()
returns trigger language plpgsql security definer set search_path = public as $$
declare _statut periode_statut;
begin
  select p.statut into _statut
  from public.periodes p
  where p.entreprise_id = new.entreprise_id
    and p.exercice_id = new.exercice_id
    and new.date_piece between p.date_debut and p.date_fin
  limit 1;
  if _statut in ('verrouillee', 'cloturee') then
    raise exception 'Saisie interdite : la période du % est %.', new.date_piece, _statut;
  end if;
  return new;
end; $$;

create trigger trg_ecritures_periode
  before insert or update on public.ecritures
  for each row execute function public.check_periode_ouverte();

-- =========================================================================
-- Droits d'exécution.
-- =========================================================================
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

-- =========================================================================
-- L'onboarding génère désormais les périodes du premier exercice.
-- =========================================================================
create or replace function public.create_entreprise_with_owner(
  _raison_sociale text,
  _niu text default null,
  _regime regime_fiscal default 'reel',
  _devise text default 'XAF',
  _exercice_debut date default null,
  _exercice_fin date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _ent_id uuid;
  _exo_id uuid;
  _uid uuid := auth.uid();
  _deb date := coalesce(_exercice_debut, date_trunc('year', current_date)::date);
  _fin date := coalesce(_exercice_fin, (date_trunc('year', current_date) + interval '1 year - 1 day')::date);
  _m date;
begin
  if _uid is null then raise exception 'Non authentifié'; end if;

  insert into public.entreprises (raison_sociale, niu, regime_fiscal, devise, created_by)
  values (_raison_sociale, _niu, _regime, _devise, _uid)
  returning id into _ent_id;

  insert into public.memberships (entreprise_id, user_id, role)
  values (_ent_id, _uid, 'owner');

  insert into public.exercices (entreprise_id, libelle, date_debut, date_fin)
  values (_ent_id, 'Exercice ' || extract(year from _deb)::text, _deb, _fin)
  returning id into _exo_id;

  -- Périodes mensuelles du premier exercice.
  for _m in
    select generate_series(date_trunc('month', _deb), date_trunc('month', _fin), interval '1 month')::date
  loop
    insert into public.periodes (entreprise_id, exercice_id, libelle, date_debut, date_fin)
    values (
      _ent_id, _exo_id,
      'Période ' || to_char(_m, 'MM/YYYY'),
      greatest(_m, _deb),
      least((_m + interval '1 month - 1 day')::date, _fin)
    )
    on conflict (exercice_id, date_debut) do nothing;
  end loop;

  insert into public.audit_log (entreprise_id, user_id, action, table_name, record_id)
  values (_ent_id, _uid, 'entreprise.create', 'entreprises', _ent_id::text);

  return _ent_id;
end;
$$;
