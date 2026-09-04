alter table public.share_links
  add column first_accessed_at timestamptz,
  add column access_count integer not null default 0 check (access_count >= 0);

update public.share_links
set first_accessed_at = last_accessed_at,
    access_count = case when last_accessed_at is null then 0 else 1 end;

create or replace function public.record_share_link_access(p_link_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.share_links
  set first_accessed_at = coalesce(first_accessed_at, now()),
      last_accessed_at = now(),
      access_count = access_count + 1
  where id = p_link_id;
$$;

revoke all on function public.record_share_link_access(uuid) from public, anon, authenticated;
grant execute on function public.record_share_link_access(uuid) to service_role;
