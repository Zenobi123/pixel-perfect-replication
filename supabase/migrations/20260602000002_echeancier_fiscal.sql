-- =========================================================================
-- MODULE 13 (v0 fiscal) — ÉCHÉANCIER FISCAL ET SUIVI DES DÉCLARATIONS
-- Cahier des charges v1.1, §Module 13 « Progression réaliste du calcul fiscal » :
-- en version initiale, la fiscalité se limite au CALENDRIER d'échéances, aux
-- ALERTES, au SUIVI DU STATUT des déclarations et à l'archivage des
-- justificatifs — SANS calcul automatique d'impôt. Le moteur de règles
-- versionnées viendra dans une itération suivante (clause de prudence fiscale).
--
-- Statuts (annexe B) : a_preparer, en_revue, validee, deposee, payee, archivee.
-- =========================================================================

create type public.declaration_statut as enum (
  'a_preparer', 'en_revue', 'validee', 'deposee', 'payee', 'archivee'
);

create table public.declarations_fiscales (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  exercice_id   uuid references public.exercices(id) on delete set null,
  code_impot    text not null,            -- TVA, IS, ACOMPTE_IS, IRPP, PATENTE, …
  libelle       text not null,
  periode       text,                      -- ex. « 01/2026 », « T1 2026 », « 2026 »
  date_echeance date not null,
  montant       numeric(18,2),             -- saisi manuellement (pas de calcul auto)
  reference     text,
  statut        public.declaration_statut not null default 'a_preparer',
  notes         text,
  created_by    uuid not null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_declarations_ent on public.declarations_fiscales(entreprise_id, date_echeance);
alter table public.declarations_fiscales enable row level security;

create policy "declarations_select_members" on public.declarations_fiscales
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "declarations_cud" on public.declarations_fiscales
  for all to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]))
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));

create trigger trg_declarations_updated before update on public.declarations_fiscales
  for each row execute function public.set_updated_at();

-- =========================================================================
-- Génère les échéances de TVA mensuelles d'un exercice (calendrier fiscal).
-- Échéance = le jour _jour du mois SUIVANT la période. Idempotente.
-- =========================================================================
create or replace function public.generer_echeances_tva(_exercice_id uuid, _jour integer default 15)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  _ent uuid; _deb date; _fin date; _m date; _periode text; _ech date; _n int := 0;
begin
  select entreprise_id, date_debut, date_fin into _ent, _deb, _fin
  from public.exercices where id = _exercice_id;
  if _ent is null then raise exception 'Exercice introuvable'; end if;
  if not public.has_membership_role(auth.uid(), _ent, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé'; end if;
  if _jour < 1 or _jour > 28 then raise exception 'Jour d''échéance invalide (1 à 28)'; end if;

  for _m in
    select generate_series(date_trunc('month', _deb), date_trunc('month', _fin), interval '1 month')::date
  loop
    _periode := to_char(_m, 'MM/YYYY');
    _ech := (date_trunc('month', _m) + interval '1 month')::date + (_jour - 1);
    insert into public.declarations_fiscales (entreprise_id, exercice_id, code_impot, libelle, periode, date_echeance)
    select _ent, _exercice_id, 'TVA', 'Déclaration de TVA ' || _periode, _periode, _ech
    where not exists (
      select 1 from public.declarations_fiscales d
      where d.entreprise_id = _ent and d.code_impot = 'TVA' and d.periode = _periode
    );
    if found then _n := _n + 1; end if;
  end loop;
  return _n;
end; $$;

revoke execute on function public.generer_echeances_tva(uuid, integer) from public, anon;
grant execute on function public.generer_echeances_tva(uuid, integer) to authenticated;
