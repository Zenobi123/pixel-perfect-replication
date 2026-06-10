-- Enregistre intégralement un brouillon et ses lignes dans une seule transaction.
-- La validation optionnelle reste déléguée à validate_ecriture, qui applique les
-- contrôles comptables, la numérotation et l'audit.
create or replace function public.save_ecriture_brouillon(
  _entreprise_id uuid,
  _exercice_id uuid,
  _journal_id uuid,
  _date_piece date,
  _libelle text,
  _reference text,
  _lignes jsonb,
  _ecriture_id uuid default null,
  _validate boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
  _existing public.ecritures;
  _ligne jsonb;
  _ordre integer := 0;
begin
  if not public.has_membership_role(auth.uid(), _entreprise_id, array['owner','admin','comptable']::membership_role[]) then
    raise exception 'Accès refusé';
  end if;
  if not exists (select 1 from public.exercices where id = _exercice_id and entreprise_id = _entreprise_id) then
    raise exception 'Exercice invalide';
  end if;
  if not exists (select 1 from public.journaux where id = _journal_id and entreprise_id = _entreprise_id and actif) then
    raise exception 'Journal invalide ou inactif';
  end if;
  if _lignes is null or jsonb_typeof(_lignes) <> 'array' or jsonb_array_length(_lignes) < 2 then
    raise exception 'Au moins 2 lignes requises';
  end if;

  if _ecriture_id is null then
    insert into public.ecritures(
      entreprise_id, exercice_id, journal_id, date_piece, reference, libelle, created_by
    ) values (
      _entreprise_id, _exercice_id, _journal_id, _date_piece, nullif(_reference, ''), _libelle, auth.uid()
    ) returning id into _id;
  else
    select * into _existing from public.ecritures where id = _ecriture_id for update;
    if _existing.id is null or _existing.entreprise_id <> _entreprise_id then
      raise exception 'Écriture introuvable';
    end if;
    if _existing.statut <> 'brouillon' then
      raise exception 'Seul un brouillon peut être modifié';
    end if;

    update public.ecritures
      set exercice_id = _exercice_id,
          journal_id = _journal_id,
          date_piece = _date_piece,
          reference = nullif(_reference, ''),
          libelle = _libelle
      where id = _ecriture_id;
    delete from public.lignes_ecriture where ecriture_id = _ecriture_id;
    _id := _ecriture_id;
  end if;

  for _ligne in select value from jsonb_array_elements(_lignes)
  loop
    _ordre := _ordre + 1;
    if not exists (
      select 1 from public.comptes
      where id = (_ligne->>'compte_id')::uuid and entreprise_id = _entreprise_id and actif
    ) then
      raise exception 'Compte invalide à la ligne %', _ordre;
    end if;
    insert into public.lignes_ecriture(
      ecriture_id, entreprise_id, ordre, compte_id, libelle, debit, credit
    ) values (
      _id,
      _entreprise_id,
      _ordre,
      (_ligne->>'compte_id')::uuid,
      nullif(_ligne->>'libelle', ''),
      coalesce((_ligne->>'debit')::numeric, 0),
      coalesce((_ligne->>'credit')::numeric, 0)
    );
  end loop;

  if _validate then
    perform public.validate_ecriture(_id);
  end if;

  return _id;
end;
$$;

revoke execute on function public.save_ecriture_brouillon(uuid, uuid, uuid, date, text, text, jsonb, uuid, boolean) from public, anon;
grant execute on function public.save_ecriture_brouillon(uuid, uuid, uuid, date, text, text, jsonb, uuid, boolean) to authenticated;
