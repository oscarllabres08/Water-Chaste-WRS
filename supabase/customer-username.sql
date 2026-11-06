-- Customer usernames. Safe to run once in the Supabase SQL editor.
alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where coalesce(trim(username), '') <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_username text;
begin
  v_username := nullif(lower(trim(coalesce(new.raw_user_meta_data->>'username', ''))), '');
  insert into public.profiles(user_id, role, display_name, username)
  values (
    new.id,
    'customer',
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), new.email),
    v_username
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.customer_username_taken(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles
    where lower(username) = lower(trim(coalesce(p_username, '')))
      and coalesce(trim(username), '') <> ''
  );
$$;

revoke all on function public.customer_username_taken(text) from public;
grant execute on function public.customer_username_taken(text) to anon, authenticated;
