-- =========================================================================
-- ABONNEMENT — PAIEMENT MANUEL VALIDÉ PAR ADMINISTRATEUR + GATING
-- Cahier des charges v1.1 : backlog P0 (« Abonnements simples avec paiement
-- manuel validé par administrateur »), §Modèle économique (cycle de vie,
-- règles de suspension) et Parcours 4 (suspension d'abonnement).
--
-- v0 sans agrégateur de paiement : l'encaissement réel se fait hors
-- application (Mobile Money, virement, espèces) puis un super administrateur
-- active ou prolonge l'abonnement. Conséquences appliquées ici :
--  - une date d'échéance d'abonnement ;
--  - une activation/suspension réservée au super_admin (SECURITY DEFINER) ;
--  - le blocage de la CRÉATION de nouvelles écritures quand l'abonnement est
--    suspendu ou expiré, sans jamais bloquer les consultations ni les exports
--    (« Ne jamais supprimer les données ; garder l'accès aux exports »).
-- =========================================================================

alter table public.entreprises
  add column if not exists abonnement_jusqu_au timestamptz;

-- Activation/prolongation/suspension manuelle, réservée au super administrateur.
create or replace function public.activer_abonnement(
  _entreprise_id uuid,
  _statut public.subscription_status,
  _jusqu_au timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Réservé à l''administrateur de la plateforme';
  end if;
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

-- Blocage de la création de nouvelles écritures quand l'abonnement n'est plus
-- actif. On ne bloque que l'INSERT : les consultations, exports, et la gestion
-- des écritures existantes restent possibles.
create or replace function public.check_abonnement_actif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _st public.subscription_status;
begin
  select subscription_status into _st from public.entreprises where id = new.entreprise_id;
  if _st in ('suspendu', 'expire') then
    raise exception 'Abonnement % : la création de nouvelles écritures est bloquée. Les consultations et exports restent disponibles.', _st;
  end if;
  return new;
end; $$;

create trigger trg_ecritures_abonnement
  before insert on public.ecritures
  for each row execute function public.check_abonnement_actif();
