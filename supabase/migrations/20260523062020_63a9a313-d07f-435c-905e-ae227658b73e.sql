
-- search_path sur triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql
security invoker
set search_path = public
as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.prevent_audit_mutation()
returns trigger language plpgsql
security invoker
set search_path = public
as $$
begin raise exception 'audit_log is immutable'; end; $$;

-- Révoque l'exécution publique des fonctions SECURITY DEFINER
revoke execute on function public.has_role(uuid, app_role) from public, anon;
revoke execute on function public.is_member_of(uuid, uuid) from public, anon;
revoke execute on function public.membership_role_of(uuid, uuid) from public, anon;
revoke execute on function public.has_membership_role(uuid, uuid, membership_role[]) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_entreprise_with_owner(text, text, regime_fiscal, text, date, date) from public, anon;

grant execute on function public.create_entreprise_with_owner(text, text, regime_fiscal, text, date, date) to authenticated;
