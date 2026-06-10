\set ON_ERROR_STOP on
begin;

-- Deux utilisateurs et deux dossiers indépendants. Le test change les claims JWT
-- pour vérifier que les politiques RLS empêchent toute lecture inter-tenant.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@example.test', '', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@example.test', '', now(), now())
on conflict (id) do nothing;

insert into public.entreprises (id, raison_sociale, created_by)
values
  ('20000000-0000-0000-0000-000000000001', 'Dossier RLS A', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'Dossier RLS B', '10000000-0000-0000-0000-000000000002');
insert into public.memberships (entreprise_id, user_id, role)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
do $$
begin
  assert (select count(*) from public.entreprises) = 1, 'Un utilisateur voit un autre dossier';
  assert (select id from public.entreprises limit 1) = '20000000-0000-0000-0000-000000000001'::uuid,
    'Le dossier visible ne correspond pas au membre authentifié';
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
do $$
begin
  assert (select count(*) from public.entreprises) = 1, 'Un utilisateur voit un autre dossier';
  assert (select id from public.entreprises limit 1) = '20000000-0000-0000-0000-000000000002'::uuid,
    'Le dossier visible ne correspond pas au membre authentifié';
end $$;

reset role;
rollback;
