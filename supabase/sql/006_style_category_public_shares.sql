create table if not exists public.style_category_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'tailor' check (mode in ('tailor', 'client')),
  category text not null,
  token text not null unique,
  tailor_name text,
  tailor_username text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mode, category)
);

alter table public.style_category_shares enable row level security;

drop policy if exists "Users manage own style category shares" on public.style_category_shares;
create policy "Users manage own style category shares"
on public.style_category_shares
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.get_public_style_category_share(share_token text)
returns table (
  user_id uuid,
  mode text,
  category text,
  tailor_name text,
  tailor_username text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    style_category_shares.user_id,
    style_category_shares.mode,
    style_category_shares.category,
    style_category_shares.tailor_name,
    style_category_shares.tailor_username,
    style_category_shares.updated_at
  from public.style_category_shares
  where style_category_shares.token = share_token
    and style_category_shares.is_active = true
  limit 1;
$$;

revoke all on function public.get_public_style_category_share(text) from public;
grant execute on function public.get_public_style_category_share(text) to anon, authenticated;

drop policy if exists "Public can view styles in shared categories" on public.styles;
create policy "Public can view styles in shared categories"
on public.styles
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.style_category_shares
    where style_category_shares.user_id = styles.user_id
      and style_category_shares.mode = styles.mode
      and style_category_shares.category = styles.category
      and style_category_shares.is_active = true
  )
);

drop policy if exists "Public can view shared style images" on storage.objects;
create policy "Public can view shared style images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'style-images'
  and exists (
    select 1
    from public.styles
    join public.style_category_shares
      on style_category_shares.user_id = styles.user_id
      and style_category_shares.mode = styles.mode
      and style_category_shares.category = styles.category
      and style_category_shares.is_active = true
    where styles.image_path = storage.objects.name
  )
);
