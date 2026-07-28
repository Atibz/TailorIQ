create table if not exists public.style_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'tailor',
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, mode, name)
);

alter table public.style_categories enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.style_categories to authenticated;

drop policy if exists "Users can view their style categories" on public.style_categories;
create policy "Users can view their style categories"
on public.style_categories
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their style categories" on public.style_categories;
create policy "Users can create their style categories"
on public.style_categories
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their style categories" on public.style_categories;
create policy "Users can update their style categories"
on public.style_categories
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their style categories" on public.style_categories;
create policy "Users can delete their style categories"
on public.style_categories
for delete
using (auth.uid() = user_id);

create index if not exists style_categories_user_mode_idx on public.style_categories(user_id, mode);
