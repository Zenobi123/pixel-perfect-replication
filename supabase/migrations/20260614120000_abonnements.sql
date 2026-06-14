-- =========================================================================
-- ABONNEMENTS — v0 « paiement manuel validé par administrateur »
-- (cahier des charges v1.1, recommandation MVP §9 et Annexe B des statuts).
--
-- Modèle : l'abonnement appartient au COMPTE PROPRIÉTAIRE (un par owner). Le
-- plan définit les limites (max entreprises / utilisateurs ; Cabinet illimité).
-- Essai gratuit de 14 jours, puis paiement déclaré par le client et validé
-- manuellement par un administrateur plateforme (rôle app_role = 'super_admin').
--
-- Cette migration est ADDITIVE : elle ne modifie aucune fonction comptable
-- existante, donc le jeu d'écritures « golden » et les tests RLS restent verts.
-- =========================================================================

-- Statuts d'abonnement (cf. Annexe B du cahier).
create type public.abonnement_statut as enum (
  'trial', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'archived'
);
create type public.paiement_statut as enum ('en_attente', 'valide', 'rejete');
create type public.paiement_methode as enum ('mobile_money', 'virement_bancaire', 'especes', 'autre');
create type public.cycle_facturation as enum ('mensuel', 'annuel');

-- Catalogue des offres (valeurs alignées sur la page /tarifs).
create table public.plans (
  code text primary key,
  libelle text not null,
  prix_mensuel integer not null,        -- en XAF
  max_entreprises integer,              -- null = illimité (Cabinet)
  max_utilisateurs integer,             -- par entreprise ; null = illimité
  ordre integer not null
);
alter table public.plans enable row level security;
create policy "plans_select_authenticated" on public.plans
  for select to authenticated using (true);

insert into public.plans (code, libelle, prix_mensuel, max_entreprises, max_utilisateurs, ordre) values
  ('essentiel',     'Essentiel',     9900,  1,    1,    1),
  ('standard',      'Standard',      19900, 1,    3,    2),
  ('professionnel', 'Professionnel', 39900, 1,    10,   3),
  ('cabinet',       'Cabinet',       59900, null, null, 4);

-- Abonnement (un par propriétaire).
create table public.abonnements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  plan_code text not null default 'essentiel' references public.plans(code),
  statut public.abonnement_statut not null default 'trial',
  cycle public.cycle_facturation not null default 'mensuel',
  trial_fin timestamptz not null default (now() + interval '14 days'),
  periode_fin timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.abonnements enable row level security;
create trigger abonnements_updated_at before update on public.abonnements
  for each row execute function public.set_updated_at();

-- Le propriétaire lit son abonnement ; l'administrateur lit tout. Les écritures
-- passent uniquement par les RPC SECURITY DEFINER ci-dessous.
create policy "abonnements_select_own" on public.abonnements
  for select to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

-- Déclarations de paiement (validation manuelle par l'administrateur).
create table public.paiements_abonnement (
  id uuid primary key default gen_random_uuid(),
  abonnement_id uuid not null references public.abonnements(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.plans(code),
  cycle public.cycle_facturation not null,
  montant integer not null check (montant >= 0),
  methode public.paiement_methode not null,
  reference text,
  statut public.paiement_statut not null default 'en_attente',
  note text,
  declared_at timestamptz not null default now(),
  validated_by uuid references auth.users(id),
  validated_at timestamptz
);
alter table public.paiements_abonnement enable row level security;

create policy "paiements_select_own_or_admin" on public.paiements_abonnement
  for select to authenticated
  using (owner_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

-- =========================================================================
-- RPC
-- =========================================================================

-- Renvoie l'abonnement du compte appelant (création paresseuse d'un essai de
-- 14 jours au premier appel), enrichi de l'état d'accès calculé.
create or replace function public.mon_abonnement()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _ab public.abonnements;
  _plan public.plans;
  _peut_ecrire boolean;
  _en_essai boolean;
  _jours_restants integer;
begin
  if _uid is null then
    raise exception 'Non authentifié';
  end if;

  insert into public.abonnements (owner_id)
  values (_uid)
  on conflict (owner_id) do nothing;

  select * into _ab from public.abonnements where owner_id = _uid;
  select * into _plan from public.plans where code = _ab.plan_code;

  _en_essai := _ab.statut = 'trial' and _ab.trial_fin > now();
  _peut_ecrire := _en_essai
    or (_ab.statut in ('active', 'grace_period')
        and (_ab.periode_fin is null or _ab.periode_fin > now()));
  _jours_restants := case
    when _ab.statut = 'trial' then greatest(0, ceil(extract(epoch from (_ab.trial_fin - now())) / 86400)::int)
    when _ab.periode_fin is not null then greatest(0, ceil(extract(epoch from (_ab.periode_fin - now())) / 86400)::int)
    else 0
  end;

  return jsonb_build_object(
    'id', _ab.id,
    'plan_code', _ab.plan_code,
    'plan_libelle', _plan.libelle,
    'prix_mensuel', _plan.prix_mensuel,
    'statut', _ab.statut,
    'cycle', _ab.cycle,
    'trial_fin', _ab.trial_fin,
    'periode_fin', _ab.periode_fin,
    'en_essai', _en_essai,
    'peut_ecrire', _peut_ecrire,
    'jours_restants', _jours_restants
  );
end; $$;

-- Le client déclare un paiement (passe l'abonnement en attente de validation).
create or replace function public.declarer_paiement(
  _plan_code text,
  _cycle public.cycle_facturation,
  _montant integer,
  _methode public.paiement_methode,
  _reference text default null,
  _note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _ab public.abonnements;
  _pid uuid;
begin
  if _uid is null then raise exception 'Non authentifié'; end if;
  if not exists (select 1 from public.plans where code = _plan_code) then
    raise exception 'Offre inconnue';
  end if;

  insert into public.abonnements (owner_id) values (_uid) on conflict (owner_id) do nothing;
  select * into _ab from public.abonnements where owner_id = _uid;

  insert into public.paiements_abonnement
    (abonnement_id, owner_id, plan_code, cycle, montant, methode, reference, note)
  values
    (_ab.id, _uid, _plan_code, _cycle, _montant, _methode, _reference, _note)
  returning id into _pid;

  -- Marque l'abonnement comme en attente de règlement (sauf s'il est en essai
  -- encore valide, auquel cas l'essai continue jusqu'à validation).
  if not (_ab.statut = 'trial' and _ab.trial_fin > now()) then
    update public.abonnements set statut = 'past_due' where id = _ab.id;
  end if;

  return _pid;
end; $$;

-- L'administrateur valide un paiement : active l'abonnement et prolonge la
-- période payée (1 mois ou 12 mois selon le cycle).
create or replace function public.valider_paiement(_paiement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _p public.paiements_abonnement;
  _base timestamptz;
  _delta interval;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Réservé à l''administrateur';
  end if;

  select * into _p from public.paiements_abonnement where id = _paiement_id for update;
  if _p.id is null then raise exception 'Paiement introuvable'; end if;
  if _p.statut <> 'en_attente' then raise exception 'Paiement déjà traité'; end if;

  update public.paiements_abonnement
    set statut = 'valide', validated_by = auth.uid(), validated_at = now()
    where id = _paiement_id;

  -- Point de départ de la nouvelle période : la fin de période courante si elle
  -- est encore dans le futur, sinon maintenant.
  select greatest(coalesce(periode_fin, now()), now()) into _base
    from public.abonnements where id = _p.abonnement_id;
  _delta := case when _p.cycle = 'annuel' then interval '12 months' else interval '1 month' end;

  update public.abonnements
    set statut = 'active', plan_code = _p.plan_code, cycle = _p.cycle,
        periode_fin = _base + _delta
    where id = _p.abonnement_id;
end; $$;

-- L'administrateur rejette un paiement (avec motif).
create or replace function public.rejeter_paiement(_paiement_id uuid, _note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _p public.paiements_abonnement;
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Réservé à l''administrateur';
  end if;

  select * into _p from public.paiements_abonnement where id = _paiement_id for update;
  if _p.id is null then raise exception 'Paiement introuvable'; end if;
  if _p.statut <> 'en_attente' then raise exception 'Paiement déjà traité'; end if;

  update public.paiements_abonnement
    set statut = 'rejete', validated_by = auth.uid(), validated_at = now(),
        note = coalesce(_note, note)
    where id = _paiement_id;
end; $$;

-- Verrouillage des droits d'exécution (cf. pattern des autres RPC).
revoke execute on function public.mon_abonnement() from public, anon;
revoke execute on function public.declarer_paiement(text, public.cycle_facturation, integer, public.paiement_methode, text, text) from public, anon;
revoke execute on function public.valider_paiement(uuid) from public, anon;
revoke execute on function public.rejeter_paiement(uuid, text) from public, anon;

grant execute on function public.mon_abonnement() to authenticated;
grant execute on function public.declarer_paiement(text, public.cycle_facturation, integer, public.paiement_methode, text, text) to authenticated;
grant execute on function public.valider_paiement(uuid) to authenticated;
grant execute on function public.rejeter_paiement(uuid, text) to authenticated;
