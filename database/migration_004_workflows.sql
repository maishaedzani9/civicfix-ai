-- Apply after schema.sql (also safe for existing Phase 1 databases).
begin;
create table if not exists public.creation_requests (
  key varchar(200) primary key,
  fingerprint varchar(64) not null,
  incident_id uuid not null references public.incidents(id) on delete cascade
);
alter table public.creation_requests enable row level security;
-- Browser writes must go through the API so department routing, audit and validation run.
drop policy if exists incidents_resident_insert on public.incidents;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, case when length(trim(coalesce(new.raw_user_meta_data->>'display_name', ''))) >= 2 then left(trim(new.raw_user_meta_data->>'display_name'), 120) else 'Resident' end, 'resident')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
-- Backfill existing accounts. Privileges are assigned only by a trusted administrator.
insert into public.profiles (id, display_name, role)
select id, case when length(trim(coalesce(raw_user_meta_data->>'display_name', ''))) >= 2
  then left(trim(raw_user_meta_data->>'display_name'), 120) else 'Resident' end, 'resident'
from auth.users on conflict (id) do nothing;
commit;
