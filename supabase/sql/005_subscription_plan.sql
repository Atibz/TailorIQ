alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists plan_status text not null default 'active',
  add column if not exists plan_updated_at timestamptz not null default now();

update public.profiles
set
  plan = coalesce(nullif(plan, ''), 'free'),
  plan_status = coalesce(nullif(plan_status, ''), 'active'),
  plan_updated_at = coalesce(plan_updated_at, now());
