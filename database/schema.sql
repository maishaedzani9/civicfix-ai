-- CivicFix AI Phase 1 schema for PostgreSQL 15+ / Supabase.
-- Apply to a new development database. Review policies before production use.

create extension if not exists pgcrypto;

create type public.app_role as enum ('resident', 'staff', 'manager', 'admin');
create type public.incident_status as enum (
  'submitted', 'acknowledged', 'assigned', 'in_progress',
  'resolved', 'closed', 'rejected'
);
create type public.urgency_level as enum ('low', 'medium', 'high', 'critical');
create type public.update_visibility as enum ('public', 'internal');

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 120),
  role public.app_role not null default 'resident',
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'resident' and department_id is null) or role <> 'resident')
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  description text not null default '',
  default_urgency public.urgency_level not null default 'medium',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.department_categories (
  department_id uuid not null references public.departments(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (department_id, category_id)
);

create sequence public.incident_reference_sequence start 1000;

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique default (
    'CF-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.incident_reference_sequence')::text, 6, '0')
  ),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  title text not null check (char_length(title) between 8 and 140),
  description text not null check (char_length(description) between 20 and 4000),
  urgency public.urgency_level not null default 'medium',
  status public.incident_status not null default 'submitted',
  address_text text check (address_text is null or char_length(address_text) <= 500),
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  ai_triage_id uuid,
  version integer not null default 1 check (version > 0),
  submitted_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null))
);

create table public.incident_evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique check (storage_path <> ''),
  media_type text not null check (media_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create table public.incident_assignments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  assignee_id uuid references public.profiles(id) on delete set null,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  check (unassigned_at is null or unassigned_at >= assigned_at)
);

create unique index one_active_assignment_per_incident
  on public.incident_assignments (incident_id)
  where unassigned_at is null;

create table public.incident_status_history (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  from_status public.incident_status,
  to_status public.incident_status not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now(),
  check (from_status is null or from_status <> to_status)
);

create table public.incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  visibility public.update_visibility not null default 'public',
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.triage_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'confirmed', 'expired', 'cancelled')),
  structured_draft jsonb,
  schema_version text not null default '1.0',
  model_config_id text,
  confirmed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.incidents
  add constraint incidents_ai_triage_fk
  foreign key (ai_triage_id) references public.triage_sessions(id) on delete set null;

create table public.triage_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.triage_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action ~ '^[a-z0-9_.-]+$'),
  entity_type text not null,
  entity_id text not null,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index incidents_reporter_created_idx on public.incidents (reporter_id, created_at desc);
create index incidents_department_status_idx on public.incidents (department_id, status, created_at desc);
create index incidents_category_created_idx on public.incidents (category_id, created_at desc);
create index status_history_incident_idx on public.incident_status_history (incident_id, created_at);
create index updates_incident_created_idx on public.incident_updates (incident_id, created_at);
create index triage_messages_session_idx on public.triage_messages (session_id, created_at);
create index audit_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger departments_set_updated_at before update on public.departments
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger incidents_set_updated_at before update on public.incidents
for each row execute function public.set_updated_at();
create trigger updates_set_updated_at before update on public.incident_updates
for each row execute function public.set_updated_at();
create trigger triage_sessions_set_updated_at before update on public.triage_sessions
for each row execute function public.set_updated_at();

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.department_categories enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_evidence enable row level security;
alter table public.incident_assignments enable row level security;
alter table public.incident_status_history enable row level security;
alter table public.incident_updates enable row level security;
alter table public.triage_sessions enable row level security;
alter table public.triage_messages enable row level security;
alter table public.audit_logs enable row level security;

-- Safe initial policies. Privileged staff operations should use the backend service
-- after explicit role checks; the service-role key must never reach the browser.
create policy categories_public_read on public.categories
for select using (is_active = true);

create policy profiles_self_read on public.profiles
for select using (id = auth.uid());

create policy incidents_resident_read on public.incidents
for select using (reporter_id = auth.uid());

create policy incidents_resident_insert on public.incidents
for insert with check (reporter_id = auth.uid());

create policy triage_sessions_owner_all on public.triage_sessions
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy triage_messages_owner_read on public.triage_messages
for select using (
  exists (
    select 1 from public.triage_sessions s
    where s.id = session_id and s.owner_id = auth.uid()
  )
);
