-- Run this in Supabase SQL Editor.
-- Create this user in Authentication > Users: saberprepararte@gmail.com

create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  simulation_url text not null,
  guide_url text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists simulations_set_updated_at on public.simulations;
create trigger simulations_set_updated_at
before update on public.simulations
for each row
execute function public.set_updated_at();

alter table public.simulations enable row level security;

drop policy if exists "Anyone can read simulations" on public.simulations;
create policy "Anyone can read simulations"
on public.simulations
for select
to anon, authenticated
using (true);

drop policy if exists "Admin can insert simulations" on public.simulations;
create policy "Admin can insert simulations"
on public.simulations
for insert
to authenticated
with check ((auth.jwt() ->> 'email') = 'saberprepararte@gmail.com');

drop policy if exists "Admin can update simulations" on public.simulations;
create policy "Admin can update simulations"
on public.simulations
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'saberprepararte@gmail.com')
with check ((auth.jwt() ->> 'email') = 'saberprepararte@gmail.com');

drop policy if exists "Admin can delete simulations" on public.simulations;
create policy "Admin can delete simulations"
on public.simulations
for delete
to authenticated
using ((auth.jwt() ->> 'email') = 'saberprepararte@gmail.com');
