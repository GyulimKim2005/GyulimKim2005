begin;
create table if not exists public.personal_archive (
  id text primary key check (id = 'main'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision uuid not null default gen_random_uuid()
);
alter table public.personal_archive enable row level security;
revoke all on table public.personal_archive from public, anon, authenticated;
grant select, insert, update on table public.personal_archive to service_role;
comment on table public.personal_archive is 'Private personal website content. Access only through the authenticated server API.';
commit;
