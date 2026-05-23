
-- ============== ENUMS ==============
create type public.app_role as enum ('super_admin');
create type public.membership_role as enum ('owner', 'admin', 'comptable', 'lecteur');
create type public.regime_fiscal as enum ('reel', 'simplifie', 'liberatoire', 'non_assujetti');
create type public.subscription_status as enum ('trial', 'actif', 'suspendu', 'expire');
create type public.exercice_statut as enum ('ouvert', 'cloture');

-- ============== PROFILES ==============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Trigger d'auto-création
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============== USER_ROLES (rôles globaux) ==============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create policy "user_roles_select_own" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- ============== ENTREPRISES ==============
create table public.entreprises (
  id uuid primary key default gen_random_uuid(),
  raison_sociale text not null,
  sigle text,
  niu text,
  rccm text,
  regime_fiscal regime_fiscal not null default 'reel',
  devise text not null default 'XAF',
  adresse text,
  ville text,
  telephone text,
  email text,
  logo_url text,
  subscription_status subscription_status not null default 'trial',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entreprises enable row level security;

-- ============== MEMBERSHIPS ==============
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role membership_role not null default 'lecteur',
  created_at timestamptz not null default now(),
  unique (entreprise_id, user_id)
);

alter table public.memberships enable row level security;

-- Fonctions security definer (évite récursion RLS)
create or replace function public.is_member_of(_user_id uuid, _entreprise_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.memberships where user_id = _user_id and entreprise_id = _entreprise_id);
$$;

create or replace function public.membership_role_of(_user_id uuid, _entreprise_id uuid)
returns membership_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.memberships where user_id = _user_id and entreprise_id = _entreprise_id limit 1;
$$;

create or replace function public.has_membership_role(_user_id uuid, _entreprise_id uuid, _roles membership_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = _user_id and entreprise_id = _entreprise_id and role = any(_roles)
  );
$$;

-- RLS entreprises
create policy "entreprises_select_members" on public.entreprises
  for select to authenticated
  using (public.is_member_of(auth.uid(), id));

create policy "entreprises_insert_self" on public.entreprises
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "entreprises_update_admins" on public.entreprises
  for update to authenticated
  using (public.has_membership_role(auth.uid(), id, array['owner','admin']::membership_role[]));

create policy "entreprises_delete_owner" on public.entreprises
  for delete to authenticated
  using (public.has_membership_role(auth.uid(), id, array['owner']::membership_role[]));

-- RLS memberships
create policy "memberships_select_self_or_member" on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_member_of(auth.uid(), entreprise_id));

create policy "memberships_insert_owner_or_creator" on public.memberships
  for insert to authenticated
  with check (
    -- création initiale par le créateur de l'entreprise
    exists (select 1 from public.entreprises e where e.id = entreprise_id and e.created_by = auth.uid())
    or public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin']::membership_role[])
  );

create policy "memberships_update_admins" on public.memberships
  for update to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin']::membership_role[]));

create policy "memberships_delete_admins" on public.memberships
  for delete to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin']::membership_role[]));

-- ============== EXERCICES ==============
create table public.exercices (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  libelle text not null,
  date_debut date not null,
  date_fin date not null,
  statut exercice_statut not null default 'ouvert',
  cloture_le timestamptz,
  cloture_par uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_fin > date_debut)
);

create index exercices_entreprise_idx on public.exercices(entreprise_id);

alter table public.exercices enable row level security;

create policy "exercices_select_members" on public.exercices
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "exercices_insert_admins" on public.exercices
  for insert to authenticated
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create policy "exercices_update_admins" on public.exercices
  for update to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));

-- ============== AUDIT LOG (immuable) ==============
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid references public.entreprises(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text,
  record_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entreprise_idx on public.audit_log(entreprise_id, created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log_select_members" on public.audit_log
  for select to authenticated
  using (entreprise_id is null and user_id = auth.uid()
         or entreprise_id is not null and public.is_member_of(auth.uid(), entreprise_id));

create policy "audit_log_insert_self" on public.audit_log
  for insert to authenticated
  with check (user_id = auth.uid());

-- Empêche update/delete (immuable)
create or replace function public.prevent_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is immutable';
end; $$;

create trigger audit_log_no_update before update on public.audit_log
  for each row execute function public.prevent_audit_mutation();
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function public.prevent_audit_mutation();

-- ============== Trigger updated_at générique ==============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger entreprises_updated_at before update on public.entreprises
  for each row execute function public.set_updated_at();
create trigger exercices_updated_at before update on public.exercices
  for each row execute function public.set_updated_at();

-- ============== RPC : création atomique entreprise + membership owner ==============
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
  _uid uuid := auth.uid();
  _deb date := coalesce(_exercice_debut, date_trunc('year', current_date)::date);
  _fin date := coalesce(_exercice_fin, (date_trunc('year', current_date) + interval '1 year - 1 day')::date);
begin
  if _uid is null then raise exception 'Non authentifié'; end if;

  insert into public.entreprises (raison_sociale, niu, regime_fiscal, devise, created_by)
  values (_raison_sociale, _niu, _regime, _devise, _uid)
  returning id into _ent_id;

  insert into public.memberships (entreprise_id, user_id, role)
  values (_ent_id, _uid, 'owner');

  insert into public.exercices (entreprise_id, libelle, date_debut, date_fin)
  values (_ent_id, 'Exercice ' || extract(year from _deb)::text, _deb, _fin);

  insert into public.audit_log (entreprise_id, user_id, action, table_name, record_id)
  values (_ent_id, _uid, 'entreprise.create', 'entreprises', _ent_id::text);

  return _ent_id;
end;
$$;
