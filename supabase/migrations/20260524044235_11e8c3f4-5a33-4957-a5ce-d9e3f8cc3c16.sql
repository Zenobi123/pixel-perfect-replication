
-- =========================================================================
-- PHASE 3 — COMPTABILITÉ OHADA
-- =========================================================================

-- Enums
create type public.journal_type as enum ('achats','ventes','banque','caisse','od','an');
create type public.ecriture_statut as enum ('brouillon','validee','contrepassee');
create type public.tiers_type as enum ('client','fournisseur','salarie','autre');
create type public.compte_sens as enum ('debit','credit','mixte');

-- =========================================================================
-- TEMPLATE OHADA (partagé)
-- =========================================================================
create table public.comptes_ohada_template (
  numero      text primary key,
  libelle     text not null,
  classe      smallint not null check (classe between 1 and 9),
  sens        public.compte_sens not null default 'mixte',
  est_collectif boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.comptes_ohada_template enable row level security;
create policy "ohada_template_select_all" on public.comptes_ohada_template
  for select to authenticated using (true);

-- =========================================================================
-- COMPTES (par entreprise)
-- =========================================================================
create table public.comptes (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  numero        text not null,
  libelle       text not null,
  classe        smallint not null check (classe between 1 and 9),
  sens          public.compte_sens not null default 'mixte',
  est_collectif boolean not null default false,
  actif         boolean not null default true,
  parent_id     uuid references public.comptes(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (entreprise_id, numero)
);
create index idx_comptes_entreprise on public.comptes(entreprise_id);
create index idx_comptes_numero on public.comptes(entreprise_id, numero);
alter table public.comptes enable row level security;

create policy "comptes_select_members" on public.comptes
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "comptes_insert_admins" on public.comptes
  for insert to authenticated
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create policy "comptes_update_admins" on public.comptes
  for update to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create policy "comptes_delete_admins" on public.comptes
  for delete to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin']::membership_role[]));

create trigger trg_comptes_updated before update on public.comptes
  for each row execute function public.set_updated_at();

-- =========================================================================
-- JOURNAUX
-- =========================================================================
create table public.journaux (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  code          text not null,
  libelle       text not null,
  type          public.journal_type not null,
  compte_contrepartie_id uuid references public.comptes(id),
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (entreprise_id, code)
);
create index idx_journaux_entreprise on public.journaux(entreprise_id);
alter table public.journaux enable row level security;

create policy "journaux_select_members" on public.journaux
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "journaux_cud_admins" on public.journaux
  for all to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]))
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));

create trigger trg_journaux_updated before update on public.journaux
  for each row execute function public.set_updated_at();

-- =========================================================================
-- TIERS
-- =========================================================================
create table public.tiers (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  code          text not null,
  type          public.tiers_type not null,
  raison_sociale text not null,
  niu           text,
  email         text,
  telephone     text,
  adresse       text,
  compte_id     uuid references public.comptes(id),
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (entreprise_id, code)
);
create index idx_tiers_entreprise on public.tiers(entreprise_id);
alter table public.tiers enable row level security;

create policy "tiers_select_members" on public.tiers
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "tiers_cud_admins" on public.tiers
  for all to authenticated
  using (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]))
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));

create trigger trg_tiers_updated before update on public.tiers
  for each row execute function public.set_updated_at();

-- =========================================================================
-- ECRITURES + LIGNES
-- =========================================================================
create table public.ecritures (
  id            uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  exercice_id   uuid not null references public.exercices(id),
  journal_id    uuid not null references public.journaux(id),
  numero        integer not null,
  reference     text,
  date_piece    date not null,
  libelle       text not null,
  statut        public.ecriture_statut not null default 'brouillon',
  validee_le    timestamptz,
  validee_par   uuid,
  contrepasse_par uuid references public.ecritures(id),
  created_by    uuid not null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (entreprise_id, exercice_id, journal_id, numero)
);
create index idx_ecritures_ent_exo on public.ecritures(entreprise_id, exercice_id);
create index idx_ecritures_journal on public.ecritures(journal_id, date_piece);
alter table public.ecritures enable row level security;

create policy "ecritures_select_members" on public.ecritures
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "ecritures_insert_comptables" on public.ecritures
  for insert to authenticated
  with check (public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[]));
create policy "ecritures_update_brouillon" on public.ecritures
  for update to authenticated
  using (
    public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and statut = 'brouillon'
  );
create policy "ecritures_delete_brouillon" on public.ecritures
  for delete to authenticated
  using (
    public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and statut = 'brouillon'
  );

create trigger trg_ecritures_updated before update on public.ecritures
  for each row execute function public.set_updated_at();

-- Lignes
create table public.lignes_ecriture (
  id          uuid primary key default gen_random_uuid(),
  ecriture_id uuid not null references public.ecritures(id) on delete cascade,
  entreprise_id uuid not null references public.entreprises(id) on delete cascade,
  ordre       smallint not null default 1,
  compte_id   uuid not null references public.comptes(id),
  tiers_id    uuid references public.tiers(id),
  libelle     text,
  debit       numeric(18,2) not null default 0 check (debit >= 0),
  credit      numeric(18,2) not null default 0 check (credit >= 0),
  lettrage    text,
  created_at  timestamptz not null default now(),
  check ((debit = 0 and credit > 0) or (debit > 0 and credit = 0))
);
create index idx_lignes_ecriture on public.lignes_ecriture(ecriture_id);
create index idx_lignes_compte on public.lignes_ecriture(entreprise_id, compte_id);
alter table public.lignes_ecriture enable row level security;

create policy "lignes_select_members" on public.lignes_ecriture
  for select to authenticated using (public.is_member_of(auth.uid(), entreprise_id));
create policy "lignes_cud_with_ecriture" on public.lignes_ecriture
  for all to authenticated
  using (
    public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and exists (select 1 from public.ecritures e where e.id = ecriture_id and e.statut = 'brouillon')
  )
  with check (
    public.has_membership_role(auth.uid(), entreprise_id, array['owner','admin','comptable']::membership_role[])
    and exists (select 1 from public.ecritures e where e.id = ecriture_id and e.statut = 'brouillon')
  );

-- =========================================================================
-- VALIDATION ÉCRITURE (équilibre + transition)
-- =========================================================================
create or replace function public.validate_ecriture(_ecriture_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _ent uuid;
  _statut ecriture_statut;
  _debit numeric;
  _credit numeric;
  _nb int;
begin
  select entreprise_id, statut into _ent, _statut
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

  update public.ecritures
    set statut = 'validee', validee_le = now(), validee_par = auth.uid()
    where id = _ecriture_id;

  insert into public.audit_log(entreprise_id, user_id, action, table_name, record_id)
  values (_ent, auth.uid(), 'ecriture.validate', 'ecritures', _ecriture_id::text);
end; $$;

-- Contra-passation
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

  select coalesce(max(numero),0)+1 into _next
  from public.ecritures
  where entreprise_id = _src.entreprise_id and exercice_id = _src.exercice_id and journal_id = _src.journal_id;

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

-- Numéro auto d'écriture
create or replace function public.next_ecriture_numero(_entreprise_id uuid, _exercice_id uuid, _journal_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(numero),0)+1
  from public.ecritures
  where entreprise_id = _entreprise_id and exercice_id = _exercice_id and journal_id = _journal_id;
$$;

-- =========================================================================
-- SEED template OHADA (subset essentiel, ~150 comptes)
-- =========================================================================
insert into public.comptes_ohada_template (numero, libelle, classe, sens, est_collectif) values
-- Classe 1 — Ressources durables
('10','Capital','1','credit',false),
('101','Capital social','1','credit',false),
('1011','Capital souscrit non appelé','1','credit',false),
('1012','Capital souscrit appelé non versé','1','credit',false),
('1013','Capital souscrit appelé versé','1','credit',false),
('106','Réserves','1','credit',false),
('1061','Réserve légale','1','credit',false),
('1068','Autres réserves','1','credit',false),
('11','Report à nouveau','1','mixte',false),
('110','Report à nouveau créditeur','1','credit',false),
('119','Report à nouveau débiteur','1','debit',false),
('12','Résultat net de l''exercice','1','mixte',false),
('120','Résultat net : bénéfice','1','credit',false),
('129','Résultat net : perte','1','debit',false),
('13','Subventions d''investissement','1','credit',false),
('14','Provisions réglementées','1','credit',false),
('15','Provisions pour risques et charges','1','credit',false),
('16','Emprunts et dettes assimilées','1','credit',false),
('161','Emprunts obligataires','1','credit',false),
('162','Emprunts auprès des établissements de crédit','1','credit',false),
('163','Avances reçues de l''État','1','credit',false),
('17','Dettes de crédit-bail','1','credit',false),
('18','Dettes liées à des participations','1','credit',false),
-- Classe 2 — Immobilisations
('20','Charges immobilisées','2','debit',false),
('21','Immobilisations incorporelles','2','debit',false),
('211','Frais de recherche et développement','2','debit',false),
('212','Brevets, licences, logiciels','2','debit',false),
('213','Logiciels','2','debit',false),
('215','Fonds commercial','2','debit',false),
('22','Terrains','2','debit',false),
('23','Bâtiments, installations techniques','2','debit',false),
('231','Bâtiments industriels','2','debit',false),
('234','Installations techniques','2','debit',false),
('24','Matériel','2','debit',false),
('241','Matériel et outillage industriel','2','debit',false),
('244','Matériel et mobilier de bureau','2','debit',false),
('2441','Matériel de bureau','2','debit',false),
('2444','Mobilier de bureau','2','debit',false),
('245','Matériel de transport','2','debit',false),
('25','Avances et acomptes versés sur immobilisations','2','debit',false),
('26','Titres de participation','2','debit',false),
('27','Autres immobilisations financières','2','debit',false),
('275','Dépôts et cautionnements versés','2','debit',false),
('28','Amortissements','2','credit',false),
('281','Amortissements des immobilisations incorporelles','2','credit',false),
('283','Amortissements des bâtiments','2','credit',false),
('284','Amortissements du matériel','2','credit',false),
('29','Provisions pour dépréciation','2','credit',false),
-- Classe 3 — Stocks
('31','Marchandises','3','debit',false),
('32','Matières premières et fournitures liées','3','debit',false),
('33','Autres approvisionnements','3','debit',false),
('34','Produits en cours','3','debit',false),
('35','Services en cours','3','debit',false),
('36','Produits finis','3','debit',false),
('37','Produits intermédiaires et résiduels','3','debit',false),
('38','Stocks en cours de route','3','debit',false),
('39','Dépréciations des stocks','3','credit',false),
-- Classe 4 — Tiers
('40','Fournisseurs et comptes rattachés','4','credit',true),
('401','Fournisseurs','4','credit',true),
('4011','Fournisseurs','4','credit',true),
('408','Fournisseurs, factures non parvenues','4','credit',false),
('409','Fournisseurs débiteurs','4','debit',false),
('41','Clients et comptes rattachés','4','debit',true),
('411','Clients','4','debit',true),
('4111','Clients','4','debit',true),
('416','Créances clients litigieuses','4','debit',false),
('418','Clients, factures à établir','4','debit',false),
('419','Clients créditeurs, avances reçues','4','credit',false),
('42','Personnel','4','mixte',false),
('421','Personnel, avances et acomptes','4','debit',false),
('422','Personnel, rémunérations dues','4','credit',false),
('43','Organismes sociaux','4','credit',false),
('431','Sécurité sociale (CNPS)','4','credit',false),
('44','État et collectivités publiques','4','mixte',false),
('441','État, impôt sur les bénéfices','4','credit',false),
('4421','État, impôt sur le revenu','4','credit',false),
('443','État, TVA facturée','4','credit',false),
('4431','TVA facturée sur ventes','4','credit',false),
('445','État, TVA récupérable','4','debit',false),
('4451','TVA récupérable sur immobilisations','4','debit',false),
('4452','TVA récupérable sur achats','4','debit',false),
('4453','TVA récupérable sur services','4','debit',false),
('447','État, impôts retenus à la source','4','credit',false),
('4471','Précompte sur loyers','4','credit',false),
('4472','Acompte IS','4','debit',false),
('449','État, créances et dettes diverses','4','mixte',false),
('45','Organismes internationaux','4','mixte',false),
('46','Associés et groupe','4','mixte',false),
('47','Débiteurs et créditeurs divers','4','mixte',false),
('471','Compte d''attente','4','mixte',false),
('48','Créances et dettes hors activités ordinaires','4','mixte',false),
('49','Dépréciations et provisions des comptes de tiers','4','credit',false),
-- Classe 5 — Trésorerie
('50','Titres de placement','5','debit',false),
('51','Valeurs à encaisser','5','debit',false),
('52','Banques','5','mixte',false),
('521','Banques locales','5','mixte',false),
('5211','Banque principale','5','mixte',false),
('53','Établissements financiers et assimilés','5','mixte',false),
('531','Chèques postaux','5','mixte',false),
('54','Instruments de monnaie électronique','5','mixte',false),
('541','Mobile Money','5','mixte',false),
('5411','MTN Mobile Money','5','mixte',false),
('5412','Orange Money','5','mixte',false),
('56','Banques, crédits de trésorerie','5','credit',false),
('57','Caisse','5','debit',false),
('571','Caisse siège','5','debit',false),
('58','Régies d''avances, accréditifs et virements internes','5','mixte',false),
('585','Virements de fonds','5','mixte',false),
('59','Dépréciations et provisions pour risques à court terme','5','credit',false),
-- Classe 6 — Charges
('60','Achats et variations de stocks','6','debit',false),
('601','Achats de marchandises','6','debit',false),
('602','Achats de matières premières','6','debit',false),
('604','Achats stockés de matières et fournitures consommables','6','debit',false),
('605','Autres achats','6','debit',false),
('6051','Fournitures non stockables — Eau','6','debit',false),
('6052','Fournitures non stockables — Électricité','6','debit',false),
('6056','Achats de petit matériel et outillage','6','debit',false),
('608','Achats d''emballages','6','debit',false),
('61','Transports','6','debit',false),
('611','Transports sur achats','6','debit',false),
('612','Transports sur ventes','6','debit',false),
('614','Transports du personnel','6','debit',false),
('62','Services extérieurs A','6','debit',false),
('621','Sous-traitance générale','6','debit',false),
('622','Locations et charges locatives','6','debit',false),
('623','Redevances de crédit-bail','6','debit',false),
('624','Entretien, réparations et maintenance','6','debit',false),
('625','Primes d''assurance','6','debit',false),
('626','Études, recherches et documentation','6','debit',false),
('627','Publicité, publications, relations publiques','6','debit',false),
('628','Frais de télécommunications','6','debit',false),
('6281','Téléphone','6','debit',false),
('6282','Internet','6','debit',false),
('63','Services extérieurs B','6','debit',false),
('631','Frais bancaires','6','debit',false),
('632','Rémunérations d''intermédiaires et conseils','6','debit',false),
('6324','Honoraires','6','debit',false),
('633','Frais de formation du personnel','6','debit',false),
('64','Impôts et taxes','6','debit',false),
('641','Impôts et taxes directs','6','debit',false),
('646','Droits d''enregistrement','6','debit',false),
('65','Autres charges','6','debit',false),
('658','Charges diverses','6','debit',false),
('66','Charges de personnel','6','debit',false),
('661','Rémunérations directes versées au personnel national','6','debit',false),
('6611','Appointements salaires et commissions','6','debit',false),
('664','Charges sociales','6','debit',false),
('6641','Charges sociales sur rémunérations du personnel national','6','debit',false),
('67','Frais financiers et charges assimilées','6','debit',false),
('671','Intérêts des emprunts','6','debit',false),
('676','Pertes de change','6','debit',false),
('68','Dotations aux amortissements','6','debit',false),
('681','Dotations aux amortissements d''exploitation','6','debit',false),
('69','Dotations aux provisions','6','debit',false),
-- Classe 7 — Produits
('70','Ventes','7','credit',false),
('701','Ventes de marchandises','7','credit',false),
('702','Ventes de produits finis','7','credit',false),
('706','Services vendus','7','credit',false),
('707','Produits accessoires','7','credit',false),
('71','Subventions d''exploitation','7','credit',false),
('72','Production immobilisée','7','credit',false),
('73','Variations des stocks de biens et services produits','7','mixte',false),
('75','Autres produits','7','credit',false),
('758','Produits divers','7','credit',false),
('77','Revenus financiers et produits assimilés','7','credit',false),
('771','Intérêts de prêts','7','credit',false),
('776','Gains de change','7','credit',false),
('78','Transferts de charges','7','credit',false),
('79','Reprises de provisions','7','credit',false),
-- Classe 8 — Autres charges et produits HAO
('81','Valeurs comptables des cessions d''immobilisations','8','debit',false),
('82','Produits des cessions d''immobilisations','8','credit',false),
('83','Charges hors activités ordinaires','8','debit',false),
('84','Produits hors activités ordinaires','8','credit',false),
('87','Participation des travailleurs','8','debit',false),
('89','Impôts sur le résultat','8','debit',false)
on conflict (numero) do nothing;

-- =========================================================================
-- SEED par entreprise + intégration onboarding
-- =========================================================================
create or replace function public.seed_plan_ohada(_entreprise_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _banque_id uuid; _caisse_id uuid; _achats_id uuid; _ventes_id uuid;
begin
  if not public.is_member_of(auth.uid(), _entreprise_id) then
    raise exception 'Accès refusé';
  end if;

  -- Copie du template si vide
  insert into public.comptes (entreprise_id, numero, libelle, classe, sens, est_collectif)
  select _entreprise_id, numero, libelle, classe, sens, est_collectif
  from public.comptes_ohada_template
  on conflict (entreprise_id, numero) do nothing;

  -- Récup comptes contrepartie
  select id into _banque_id from public.comptes where entreprise_id=_entreprise_id and numero='5211' limit 1;
  select id into _caisse_id from public.comptes where entreprise_id=_entreprise_id and numero='571' limit 1;
  select id into _achats_id from public.comptes where entreprise_id=_entreprise_id and numero='4011' limit 1;
  select id into _ventes_id from public.comptes where entreprise_id=_entreprise_id and numero='4111' limit 1;

  -- Journaux standards
  insert into public.journaux (entreprise_id, code, libelle, type, compte_contrepartie_id) values
    (_entreprise_id, 'AC', 'Journal des achats', 'achats', _achats_id),
    (_entreprise_id, 'VE', 'Journal des ventes', 'ventes', _ventes_id),
    (_entreprise_id, 'BQ', 'Journal de banque', 'banque', _banque_id),
    (_entreprise_id, 'CA', 'Journal de caisse', 'caisse', _caisse_id),
    (_entreprise_id, 'OD', 'Opérations diverses', 'od', null),
    (_entreprise_id, 'AN', 'À-nouveaux', 'an', null)
  on conflict (entreprise_id, code) do nothing;
end; $$;

-- Mise à jour de create_entreprise_with_owner pour seeder automatiquement
create or replace function public.create_entreprise_with_owner(
  _raison_sociale text,
  _niu text default null,
  _regime regime_fiscal default 'reel',
  _devise text default 'XAF',
  _exercice_debut date default null,
  _exercice_fin date default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _ent_id uuid;
  _uid uuid := auth.uid();
  _deb date := coalesce(_exercice_debut, date_trunc('year', current_date)::date);
  _fin date := coalesce(_exercice_fin, (date_trunc('year', current_date) + interval '1 year - 1 day')::date);
begin
  if _uid is null then raise exception 'Non authentifié'; end if;

  insert into public.entreprises (raison_sociale, niu, regime_fiscal, devise, created_by)
  values (_raison_sociale, _niu, _regime, _devise, _uid)
  returning id into _ent_id;

  insert into public.memberships (entreprise_id, user_id, role)
  values (_ent_id, _uid, 'owner');

  insert into public.exercices (entreprise_id, libelle, date_debut, date_fin)
  values (_ent_id, 'Exercice ' || extract(year from _deb)::text, _deb, _fin);

  perform public.seed_plan_ohada(_ent_id);

  insert into public.audit_log (entreprise_id, user_id, action, table_name, record_id)
  values (_ent_id, _uid, 'entreprise.create', 'entreprises', _ent_id::text);

  return _ent_id;
end; $$;
