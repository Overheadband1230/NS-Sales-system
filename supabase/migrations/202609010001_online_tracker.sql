create extension if not exists pgcrypto with schema extensions;

create type public.staff_role as enum ('admin', 'editor');
create type public.shipment_status as enum ('active', 'delivered', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role public.staff_role not null default 'editor',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  train_id text not null,
  customer_name text not null,
  origin_name text not null,
  destination_name text not null,
  status public.shipment_status not null default 'active',
  draft_data jsonb not null,
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_published_at timestamptz,
  constraint shipments_route_v2 check ((draft_data ->> 'schemaVersion')::integer = 2),
  constraint shipments_stop_count check (jsonb_typeof(draft_data -> 'stops') = 'array' and jsonb_array_length(draft_data -> 'stops') between 2 and 100)
);

create table public.shipment_publications (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  published_by uuid not null references public.profiles(id),
  published_at timestamptz not null default now(),
  unique (shipment_id, version),
  constraint publications_route_v2 check ((snapshot ->> 'schemaVersion')::integer = 2),
  constraint publications_no_internal_notes check (not jsonb_path_exists(snapshot, '$.stops[*].internalNote'))
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  constraint share_expiration_after_creation check (expires_at is null or expires_at > created_at)
);

create unique index one_active_share_link_per_shipment
  on public.share_links (shipment_id)
  where revoked_at is null;
create index shipments_status_updated_idx on public.shipments (status, updated_at desc);
create index shipments_search_idx on public.shipments using gin (to_tsvector('simple', train_id || ' ' || customer_name || ' ' || origin_name || ' ' || destination_name));
create index publications_shipment_version_idx on public.shipment_publications (shipment_id, version desc);

alter table public.profiles enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_publications enable row level security;
alter table public.share_links enable row level security;

revoke all on public.profiles, public.shipments, public.shipment_publications, public.share_links from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.shipments to authenticated;
grant select on public.shipment_publications, public.share_links to authenticated;

create or replace function public.is_active_staff(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = p_user_id and active = true);
$$;

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = p_user_id and active = true and role = 'admin');
$$;

revoke all on function public.is_active_staff(uuid), public.is_admin(uuid) from public;
grant execute on function public.is_active_staff(uuid), public.is_admin(uuid) to authenticated;

create policy "active staff read profiles" on public.profiles for select to authenticated using (public.is_active_staff());
create policy "active staff read shipments" on public.shipments for select to authenticated using (public.is_active_staff());
create policy "active staff create shipments" on public.shipments for insert to authenticated
  with check (public.is_active_staff() and created_by = auth.uid() and updated_by = auth.uid() and status = 'active');
create policy "active staff read publications" on public.shipment_publications for select to authenticated using (public.is_active_staff());
create policy "active staff read share metadata" on public.share_links for select to authenticated using (public.is_active_staff());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, active)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', ''), false)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.validate_route_v2(p_route jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_route is null or p_route ->> 'schemaVersion' <> '2' then raise exception 'Route schema must be version 2'; end if;
  if nullif(btrim(p_route ->> 'trainId'), '') is null then raise exception 'Train or shipment ID is required'; end if;
  if nullif(btrim(p_route ->> 'customer'), '') is null then raise exception 'Customer is required'; end if;
  if jsonb_typeof(p_route -> 'stops') <> 'array' or jsonb_array_length(p_route -> 'stops') not between 2 and 100 then
    raise exception 'Route must contain between 2 and 100 stops';
  end if;
end;
$$;

create or replace function public.customer_snapshot(p_route jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_set(
    p_route,
    '{stops}',
    coalesce((select jsonb_agg(stop - 'internalNote') from jsonb_array_elements(p_route -> 'stops') stop), '[]'::jsonb),
    true
  );
$$;

create or replace function public.save_shipment_draft(
  p_shipment_id uuid,
  p_expected_revision integer,
  p_draft jsonb,
  p_status public.shipment_status
)
returns public.shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  current_revision integer;
  saved public.shipments;
begin
  if not public.is_active_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
  perform public.validate_route_v2(p_draft);
  select revision into current_revision from public.shipments where id = p_shipment_id for update;
  if current_revision is null then raise exception 'Shipment not found' using errcode = 'P0002'; end if;
  if current_revision <> p_expected_revision then raise exception 'Revision conflict' using errcode = '40001'; end if;
  update public.shipments set
    train_id = p_draft ->> 'trainId',
    customer_name = p_draft ->> 'customer',
    origin_name = p_draft #>> '{stops,0,name}',
    destination_name = p_draft #>> array['stops', (jsonb_array_length(p_draft -> 'stops') - 1)::text, 'name'],
    status = p_status,
    draft_data = p_draft,
    revision = revision + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_shipment_id
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.publish_shipment_snapshot(p_shipment_id uuid, p_expected_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  shipment public.shipments;
  publication public.shipment_publications;
  next_version integer;
begin
  if not public.is_active_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
  select * into shipment from public.shipments where id = p_shipment_id for update;
  if shipment.id is null then raise exception 'Shipment not found' using errcode = 'P0002'; end if;
  if shipment.status = 'archived' then raise exception 'Archived shipments cannot be published'; end if;
  if shipment.revision <> p_expected_revision then raise exception 'Revision conflict' using errcode = '40001'; end if;
  perform public.validate_route_v2(shipment.draft_data);
  select coalesce(max(version), 0) + 1 into next_version from public.shipment_publications where shipment_id = p_shipment_id;
  insert into public.shipment_publications (shipment_id, version, snapshot, published_by)
  values (p_shipment_id, next_version, public.customer_snapshot(shipment.draft_data), auth.uid())
  returning * into publication;
  update public.shipments set last_published_at = publication.published_at where id = p_shipment_id;
  return jsonb_build_object('version', publication.version, 'publishedAt', publication.published_at);
end;
$$;

create or replace function public.set_shipment_status(p_shipment_id uuid, p_status public.shipment_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_staff() then raise exception 'Staff access required' using errcode = '42501'; end if;
  update public.shipments set status = p_status, updated_by = auth.uid(), updated_at = now()
  where id = p_shipment_id;
  if not found then raise exception 'Shipment not found' using errcode = 'P0002'; end if;
  if p_status = 'archived' then update public.share_links set revoked_at = now() where shipment_id = p_shipment_id and revoked_at is null; end if;
end;
$$;

revoke all on function public.validate_route_v2(jsonb), public.customer_snapshot(jsonb) from public;
revoke all on function public.save_shipment_draft(uuid, integer, jsonb, public.shipment_status), public.publish_shipment_snapshot(uuid, integer), public.set_shipment_status(uuid, public.shipment_status) from public;
grant execute on function public.save_shipment_draft(uuid, integer, jsonb, public.shipment_status), public.publish_shipment_snapshot(uuid, integer), public.set_shipment_status(uuid, public.shipment_status) to authenticated;
