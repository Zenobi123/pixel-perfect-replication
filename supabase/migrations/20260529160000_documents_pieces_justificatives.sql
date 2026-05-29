-- =========================================================================
-- MODULE 16 — GESTION DOCUMENTAIRE / PIÈCES JUSTIFICATIVES
-- Cahier des charges v1.1, §Module 16, §Sécurité (Stockage) et checklist
-- production : « Buckets de stockage privés et URLs signées vérifiés ».
--
-- Point de vigilance plateforme : les buckets Lovable/Supabase sont PUBLICS
-- par défaut. Ce bucket est créé explicitement PRIVÉ ; l'accès aux fichiers
-- passe par des URLs signées à durée de vie courte. Les objets sont préfixés
-- par `entreprise_id/` et l'isolation est imposée par RLS sur storage.objects.
-- =========================================================================

-- Bucket privé, taille limitée et types contrôlés (cahier : upload contrôlé,
-- limitation des tailles).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pieces', 'pieces', false, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Types de pièces (cahier §Module 16 — Types de documents).
create type public.document_type as enum (
  'facture_client', 'facture_fournisseur', 'recu', 'releve_bancaire',
  'contrat', 'declaration', 'quittance', 'document_social', 'autre'
);

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  ecriture_id   uuid references public.ecritures(id) on delete set null,
  type          public.document_type not null default 'autre',
  nom_fichier   text not null,
  chemin        text not null unique, -- chemin dans le bucket : entreprise_id/...
  taille        bigint,
  mime          text,
  created_by    uuid not null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index idx_documents_ent on public.documents(entreprise_id);
create index idx_documents_ecriture on public.documents(ecriture_id);
alter table public.documents enable row level security;

create policy "documents_select_members" on public.documents
  for select to authenticated
  using (public.is_member_of(auth.uid(), entreprise_id));
create policy "documents_insert_members" on public.documents
  for insert to authenticated
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create policy "documents_delete_admins" on public.documents
  for delete to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin']::membership_role[]));

-- =========================================================================
-- RLS sur storage.objects pour le bucket privé `pieces`.
-- Le premier segment du chemin est l'entreprise_id ; un utilisateur ne peut
-- lire / déposer / supprimer un objet que s'il est membre de cette entreprise.
-- C'est la barrière qui cloisonne physiquement les fichiers par tenant.
-- =========================================================================
create policy "pieces_select_members" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pieces'
    and public.is_member_of(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

create policy "pieces_insert_members" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pieces'
    and public.has_membership_role(
      auth.uid(), ((storage.foldername(name))[1])::uuid,
      array['owner','admin','comptable']::membership_role[]
    )
  );

create policy "pieces_delete_admins" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pieces'
    and public.has_membership_role(
      auth.uid(), ((storage.foldername(name))[1])::uuid,
      array['owner','admin']::membership_role[]
    )
  );
