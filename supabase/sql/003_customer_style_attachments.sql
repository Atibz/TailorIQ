create table if not exists public.customer_styles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  style_id uuid not null references public.styles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, customer_id, style_id)
);

alter table public.customer_styles enable row level security;

drop policy if exists "Users can view their style attachments" on public.customer_styles;
create policy "Users can view their style attachments"
on public.customer_styles
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their style attachments" on public.customer_styles;
create policy "Users can create their style attachments"
on public.customer_styles
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their style attachments" on public.customer_styles;
create policy "Users can update their style attachments"
on public.customer_styles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their style attachments" on public.customer_styles;
create policy "Users can delete their style attachments"
on public.customer_styles
for delete
using (auth.uid() = user_id);

create index if not exists customer_styles_user_id_idx on public.customer_styles(user_id);
create index if not exists customer_styles_style_id_idx on public.customer_styles(style_id);
create index if not exists customer_styles_customer_id_idx on public.customer_styles(customer_id);
