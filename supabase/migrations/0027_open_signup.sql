-- DC Legacy 0027: open sign-up. Anyone with a valid email can create an account (students, alumni, clubs, everyone).
-- The role still comes from the sign-up form (student by default, or alumni / faculty) and is written to app_metadata,
-- which users can't edit. Invited admins still become admins. Replaces the domain check from 0006; the function keeps
-- its old name so the existing trigger on auth.users keeps working.
create or replace function public.enforce_ewu_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare e text := lower(coalesce(new.email, '')); claimed text := coalesce(new.raw_user_meta_data ->> 'role', '');
begin
  if e = '' then raise exception 'An email address is required'; end if;
  if exists (select 1 from public.admin_invites where email = e) then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'; return new;
  end if;
  if e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Enter a valid email address'; end if;
  new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', case when claimed in ('alumni', 'faculty') then claimed else 'student' end);
  return new;
end $$;
revoke execute on function public.enforce_ewu_email() from public, anon, authenticated;

-- Faculty directory emails no longer have to end in the old university domain.
alter table public.faculty drop constraint if exists faculty_email_check;
