-- =========================================================================
-- MODULE 9 — TRÉSORERIE (banques, caisses, Mobile Money)
-- Cahier des charges v1.1, §Module 9 (P1) :
--  - comptes de trésorerie rattachés chacun à un compte comptable de classe 5 ;
--  - encaissements, décaissements et transferts internes ;
--  - chaque mouvement génère une écriture comptable ÉQUILIBRÉE ;
--  - journal de caisse / solde par compte (calculé sur les écritures validées).
-- =========================================================================

create type public.tresorerie_type as enum ('banque', 'caisse', 'mobile_money', 'autre');
create type public.mouvement_tresorerie_type as enum ('encaissement', 'decaissement', 'transfert');

create table public.comptes_tresorerie (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  libelle       text not null,
  type          public.tresorerie_type not null default 'banque',
  compte_id     uuid not null references public.comptes(id), -- compte de classe 5
  solde_initial numeric(18,2) not null default 0,
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_comptes_tresorerie_ent on public.comptes_tresorerie(entreprise_id);
alter table public.comptes_tresorerie enable row level security;

create policy "comptes_tresorerie_select_members" on public.comptes_tresorerie
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "comptes_tresorerie_cud_admins" on public.comptes_tresorerie
  for all to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]))
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));

create trigger trg_comptes_tresorerie_updated before update on public.comptes_tresorerie
  for each row execute function public.set_updated_at();

create table public.mouvements_tresorerie (
  id                       uuid primary key default gen_random_uuid(),
  entreprise_id            uuid not null references public.entreprises(id) on delete cascade,
  exercice_id              uuid not null references public.exercices(id),
  compte_tresorerie_id     uuid not null references public.comptes_tresorerie(id),
  type                     public.mouvement_tresorerie_type not null,
  date_mouvement           date not null default current_date,
  libelle                  text not null,
  montant                  numeric(18,2) not null check (montant > 0),
  tiers_id                 uuid references public.tiers(id),
  contrepartie_compte_id   uuid references public.comptes(id),
  compte_tresorerie_dest_id uuid references public.comptes_tresorerie(id),
  ecriture_id              uuid references public.ecritures(id),
  created_by               uuid not null default auth.uid(),
  created_at               timestamptz not null default now()
);
create index idx_mouv_tresorerie_ent on public.mouvements_tresorerie(entreprise_id, compte_tresorerie_id);
alter table public.mouvements_tresorerie enable row level security;

create policy "mouv_tresorerie_select_members" on public.mouvements_tresorerie
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
-- L'insertion se fait exclusivement via la fonction SECURITY DEFINER ci-dessous.

-- =========================================================================
-- Enregistrement d'un mouvement de trésorerie + écriture équilibrée.
-- =========================================================================
create or replace function public.enregistrer_mouvement_tresorerie(
  _compte_tresorerie_id uuid,
  _exercice_id uuid,
  _type public.mouvement_tresorerie_type,
  _date date,
  _libelle text,
  _montant numeric,
  _contrepartie_compte_id uuid default null,
  _tiers_id uuid default null,
  _compte_tresorerie_dest_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _ent uuid; _ttype public.tresorerie_type; _c_tres uuid;
  _c_dest uuid; _jtype public.journal_type; _jou uuid;
  _e uuid; _num int; _mid uuid;
begin
  select entreprise_id, type, compte_id into _ent, _ttype, _c_tres
  from public.comptes_tresorerie where id = _compte_tresorerie_id;
  if _ent is null then raise exception 'Compte de trésorerie introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _montant <= 0 then raise exception 'Montant invalide'; end if;

  -- Journal : caisse pour une caisse, banque sinon.
  _jtype := (case when _ttype = 'caisse' then 'caisse' else 'banque' end)::public.journal_type;
  select id into _jou from public.journaux
    where entreprise_id = _ent and type = _jtype and actif order by code limit 1;
  if _jou is null then
    raise exception 'Aucun journal % actif : créez-en un d''abord.', _jtype; end if;

  _num := public.attribuer_numero_ecriture(_ent, _exercice_id, _jou);
  insert into public.ecritures(entreprise_id, exercice_id, journal_id, numero, date_piece, libelle, statut, validee_le, validee_par, created_by)
  values (_ent, _exercice_id, _jou, _num, _date, _libelle, 'validee', now(), auth.uid(), auth.uid())
  returning id into _e;

  if _type = 'transfert' then
    if _compte_tresorerie_dest_id is null or _compte_tresorerie_dest_id = _compte_tresorerie_id then
      raise exception 'Transfert : un compte de destination distinct est requis'; end if;
    select compte_id into _c_dest from public.comptes_tresorerie
      where id = _compte_tresorerie_dest_id and entreprise_id = _ent;
    if _c_dest is null then raise exception 'Compte de destination introuvable'; end if;
    -- Débit destination / Crédit source
    insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, libelle, debit, credit) values
      (_e, _ent, 1, _c_dest, _libelle, _montant, 0),
      (_e, _ent, 2, _c_tres, _libelle, 0, _montant);
  elsif _type = 'encaissement' then
    if _contrepartie_compte_id is null then raise exception 'Compte de contrepartie requis'; end if;
    -- Débit trésorerie / Crédit contrepartie
    insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit) values
      (_e, _ent, 1, _c_tres, null, _libelle, _montant, 0),
      (_e, _ent, 2, _contrepartie_compte_id, _tiers_id, _libelle, 0, _montant);
  else -- decaissement
    if _contrepartie_compte_id is null then raise exception 'Compte de contrepartie requis'; end if;
    -- Débit contrepartie / Crédit trésorerie
    insert into public.lignes_ecriture(ecriture_id, entreprise_id, ordre, compte_id, tiers_id, libelle, debit, credit) values
      (_e, _ent, 1, _contrepartie_compte_id, _tiers_id, _libelle, _montant, 0),
      (_e, _ent, 2, _c_tres, null, _libelle, 0, _montant);
  end if;

  insert into public.mouvements_tresorerie(entreprise_id, exercice_id, compte_tresorerie_id, type, date_mouvement, libelle, montant, tiers_id, contrepartie_compte_id, compte_tresorerie_dest_id, ecriture_id)
  values (_ent, _exercice_id, _compte_tresorerie_id, _type, _date, _libelle, _montant, _tiers_id, _contrepartie_compte_id, _compte_tresorerie_dest_id, _e)
  returning id into _mid;

  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_ent, auth.uid(), 'tresorerie.mouvement', 'mouvements_tresorerie', _mid::text);

  return _mid;
end; $$;

revoke execute on function public.enregistrer_mouvement_tresorerie(uuid, uuid, public.mouvement_tresorerie_type, date, text, numeric, uuid, uuid, uuid) from public, anon;
grant execute on function public.enregistrer_mouvement_tresorerie(uuid, uuid, public.mouvement_tresorerie_type, date, text, numeric, uuid, uuid, uuid) to authenticated;
