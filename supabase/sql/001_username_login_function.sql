create or replace function public.get_email_by_username(login_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.profiles
  where lower(username) = lower(trim(login_username))
  limit 1;
$$;

grant execute on function public.get_email_by_username(text) to anon, authenticated;
