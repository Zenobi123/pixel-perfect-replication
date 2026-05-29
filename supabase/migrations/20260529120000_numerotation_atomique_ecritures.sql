-- =========================================================================
-- NUMÉROTATION ATOMIQUE DES ÉCRITURES
-- Cahier des charges v1.1 — Moteur comptable §Numérotation,
-- règle de développement n°19 et test de recette « deux validations
-- simultanées dans le même journal => numéros distincts et consécutifs ».
--
-- Avant : le numéro était calculé par `max(numero)+1` AU MOMENT DE LA CRÉATION
-- (brouillon). Deux validations concurrentes pouvaient produire un doublon ou
-- un trou, et un brouillon jamais validé « consommait » un numéro.
--
-- Après : le numéro définitif est attribué UNIQUEMENT à la validation, de
-- façon atomique via une table de compteurs verrouillée ligne par ligne.
-- =========================================================================

-- 1) Le numéro devient nullable (un brouillon n'en a pas) et l'unicité ne
--    porte plus que sur les écritures effectivement numérotées.
alter table public.ecritures alter column numero drop not null;

alter table public.ecritures
  drop constraint if exists ecritures_entreprise_id_exercice_id_journal_id_numero_key;

create unique index if not exists uq_ecritures_numero
  on public.ecritures (entreprise_id, exercice_id, journal_id, numero)
  where numero is not null;

-- 2) Table de compteurs : une ligne par (entreprise, exercice, journal).
create table if not exists public.compteurs_ecriture (
  entreprise_id  uuid not null references public.entreprises(id) on delete cascade,
  exercice_id    uuid not null references public.exercices(id) on delete cascade,
  journal_id     uuid not null references public.journaux(id) on delete cascade,
  dernier_numero integer not null default 0,
  primary key (entreprise_id, exercice_id, journal_id)
);
alter table public.compteurs_ecriture enable row level security;

-- Lecture seule pour les membres ; toute écriture passe par la fonction
-- SECURITY DEFINER ci-dessous (jamais d'UPDATE direct côté client).
create policy "compteurs_select_members" on public.compteurs_ecriture
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));

-- 3) Amorçage des compteurs à partir des écritures déjà numérotées, afin de
--    ne JAMAIS réémettre un numéro existant après le déploiement.
insert into public.compteurs_ecriture (entreprise_id, exercice_id, journal_id, dernier_numero)
select entreprise_id, exercice_id, journal_id, max(numero)
from public.ecritures
where numero is not null
group by entreprise_id, exercice_id, journal_id
on conflict (entreprise_id, exercice_id, journal_id) do update
  set dernier_numero = greatest(public.compteurs_ecriture.dernier_numero, excluded.dernier_numero);

-- 4) Attribution atomique du prochain numéro.
--    L'upsert prend un verrou de ligne : une validation concurrente attend la
--    fin de la transaction précédente, puis lit la valeur à jour. Les numéros
--    sont donc consécutifs et sans doublon, garantis aussi par uq_ecritures_numero.
create or replace function public.attribuer_numero_ecriture(
  _entreprise_id uuid, _exercice_id uuid, _journal_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare _num integer;
begin
  insert into public.compteurs_ecriture (entreprise_id, exercice_id, journal_id, dernier_numero)
  values (_entreprise_id, _exercice_id, _journal_id, 1)
  on conflict (entreprise_id, exercice_id, journal_id)
    do update set dernier_numero = public.compteurs_ecriture.dernier_numero + 1
  returning dernier_numero into _num;
  return _num;
end; $$;

-- Fonction interne uniquement : appelée depuis validate_ecriture /
-- contrepasser_ecriture (elles-mêmes SECURITY DEFINER). Aucun accès direct.
revoke execute on function public.attribuer_numero_ecriture(uuid, uuid, uuid) from public, anon, authenticated;

-- 5) Validation : le numéro définitif n'est posé qu'ici.
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
  from public.ecritures where id = _ecriture_id;
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

  -- Numéro définitif attribué de façon atomique, uniquement à la validation.
  _num := public.attribuer_numero_ecriture(_ent, _exo, _jou);

  update public.ecritures
    set statut = 'validee', numero = _num, validee_le = now(), validee_par = auth.uid()
    where id = _ecriture_id;

  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_ent, auth.uid(), 'ecriture.validate', 'ecritures', _ecriture_id::text);
end; $$;

-- 6) Contrepassation : utilise désormais le compteur atomique (et non max+1).
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
  select * into _src from public.ecritures where id = _ecriture_id;
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

-- 7) `next_ecriture_numero` est conservée pour compatibilité mais ne sert plus
--    à attribuer un numéro (elle renvoie une simple prévisualisation indicative).
--    L'attribution réelle est faite par attribuer_numero_ecriture à la validation.
comment on function public.next_ecriture_numero(uuid, uuid, uuid)
  is 'Obsolète : prévisualisation indicative. Le numéro définitif est attribué atomiquement par attribuer_numero_ecriture lors de la validation.';
