create or replace function public.delete_current_user_account()
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not signed in';
  end if;

  delete from storage.objects
  where bucket_id = 'style-images'
    and name like current_user_id::text || '/%';

  delete from public.shared_measurements
  where sender_user_id = current_user_id
     or receiver_user_id = current_user_id;

  delete from public.reminders
  where user_id = current_user_id;

  delete from public.styles
  where user_id = current_user_id;

  delete from public.measurement_drafts
  where user_id = current_user_id;

  delete from public.measurements
  where user_id = current_user_id;

  delete from public.customers
  where user_id = current_user_id;

  delete from public.profiles
  where id = current_user_id;

  delete from auth.users
  where id = current_user_id;
end;
$$;

revoke all on function public.delete_current_user_account() from public;
grant execute on function public.delete_current_user_account() to authenticated;
