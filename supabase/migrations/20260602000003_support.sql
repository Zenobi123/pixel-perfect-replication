-- =========================================================================
-- SUPPORT CLIENT — TICKETING INTERNE (MVP)
-- Cahier des charges v1.1 : §Services transverses (« Ticketing interne au
-- MVP »), Module 20 (support client) et table support_tickets du modèle de
-- données. Fil de discussion simple par ticket, scopé par entreprise.
-- =========================================================================

create type public.ticket_statut as enum ('ouvert', 'en_cours', 'resolu', 'ferme');
create type public.ticket_priorite as enum ('basse', 'normale', 'haute');

create table public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  sujet         text not null,
  description   text,
  statut        public.ticket_statut not null default 'ouvert',
  priorite      public.ticket_priorite not null default 'normale',
  created_by    uuid not null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_support_tickets_ent on public.support_tickets(entreprise_id, statut);
alter table public.support_tickets enable row level security;

create policy "support_tickets_select_members" on public.support_tickets
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
-- Tout membre peut ouvrir un ticket.
create policy "support_tickets_insert_members" on public.support_tickets
  for insert to authenticated
  with check (public.is_member_of(auth.uid(), entreprise_id));
-- Mise à jour (statut, priorité) réservée aux responsables du dossier.
create policy "support_tickets_update_admins" on public.support_tickets
  for update to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));

create trigger trg_support_tickets_updated before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table public.support_messages (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.support_tickets(id) on delete cascade,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  auteur        uuid not null default auth.uid(),
  message       text not null,
  created_at    timestamptz not null default now()
);
create index idx_support_messages_ticket on public.support_messages(ticket_id, created_at);
alter table public.support_messages enable row level security;

create policy "support_messages_select_members" on public.support_messages
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "support_messages_insert_members" on public.support_messages
  for insert to authenticated
  with check (public.is_member_of(auth.uid(), entreprise_id));
