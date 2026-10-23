-- TripMate on Supabase: schema + Row Level Security.
-- Auth lives in auth.users; `profiles` mirrors it for display names. Access is decided by RLS, not by app code.

create type public.trip_role as enum ('EDITOR', 'VIEWER');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null,
  city text not null,
  region text not null,
  lat double precision not null,
  lng double precision not null,
  image_url text,
  search_text text not null default '',
  avg_cost integer not null default 0, -- VND per person
  category_id uuid not null references public.categories (id),
  created_at timestamptz not null default now()
);
create index on public.destinations (city);
create index on public.destinations (category_id);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_date date not null,
  end_date date not null,
  budget integer not null default 0, -- VND
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  invite_token text unique, -- set => anyone signed in with the link can join as invite_role
  invite_role public.trip_role not null default 'EDITOR',
  created_at timestamptz not null default now()
);
create index on public.trips (owner_id);

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.trip_role not null default 'EDITOR',
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index on public.trip_members (user_id);

create table public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  destination_id uuid not null references public.destinations (id),
  day integer not null, -- 1-based
  position integer not null, -- order within the day
  note text
);
create index on public.trip_items (trip_id, day, position);

create table public.trip_item_votes (
  item_id uuid not null references public.trip_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (item_id, user_id)
);

create table public.trip_item_comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.trip_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.trip_item_comments (item_id, created_at);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null,
  category text not null, -- transport | food | lodging | tickets | other
  planned integer not null default 0,
  actual integer not null default 0,
  paid_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.expenses (trip_id);

create table public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer, -- exact share in VND; null = equal part
  primary key (expense_id, user_id)
);

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER so policies can look at trips/trip_members without recursing into their own RLS.
create function public.trip_role_of(p_trip uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when t.owner_id = auth.uid() then 'OWNER'
    else (select m.role::text from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
  end
  from public.trips t where t.id = p_trip
$$;

create function public.can_view_trip(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.trip_role_of(p_trip) is not null
$$;

create function public.can_edit_trip(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.trip_role_of(p_trip) in ('OWNER', 'EDITOR')
$$;

create function public.is_trip_owner(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.trip_role_of(p_trip) = 'OWNER'
$$;

create function public.item_trip(p_item uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select trip_id from public.trip_items where id = p_item
$$;

create function public.expense_trip(p_expense uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select trip_id from public.expenses where id = p_expense
$$;

-- Everyone in a trip may see each other's profile (needed to list members, payers, commenters).
create function public.shares_trip_with(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or exists (
    select 1 from public.trips t
    where (t.owner_id = auth.uid() or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
      and (t.owner_id = p_user or exists (select 1 from public.trip_members m2 where m2.trip_id = t.id and m2.user_id = p_user))
  )
$$;

-- ---------------------------------------------------------------- profile on sign-up
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)), new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- invite links
-- The invite token is the credential, so joining goes through this function instead of a policy on trip_members.
create function public.preview_invite(p_token text) returns table (trip_id uuid, title text, role public.trip_role)
language sql stable security definer set search_path = public as $$
  select id, title, invite_role from public.trips where invite_token = p_token and length(p_token) >= 16
$$;

create function public.join_trip(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.trips;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into t from public.trips where invite_token = p_token and length(p_token) >= 16;
  if not found then raise exception 'Invite link is invalid or has been turned off' using errcode = 'P0002'; end if;
  if t.owner_id <> auth.uid() then
    insert into public.trip_members (trip_id, user_id, role) values (t.id, auth.uid(), t.invite_role)
    on conflict do nothing; -- existing members keep their role
  end if;
  return t.id;
end $$;

revoke all on function public.preview_invite(text), public.join_trip(text) from public, anon;
grant execute on function public.preview_invite(text), public.join_trip(text) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.destinations enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_items enable row level security;
alter table public.trip_item_votes enable row level security;
alter table public.trip_item_comments enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;

-- profiles: see yourself and people you travel with; edit only yourself
create policy profiles_select on public.profiles for select to authenticated using (public.shares_trip_with(id));
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- catalogue: readable by signed-in users, written only with the service role (seed)
create policy categories_select on public.categories for select to authenticated using (true);
create policy destinations_select on public.destinations for select to authenticated using (true);

-- trips
create policy trips_select on public.trips for select to authenticated using (public.can_view_trip(id));
create policy trips_insert on public.trips for insert to authenticated with check (owner_id = auth.uid());
create policy trips_update on public.trips for update to authenticated using (public.is_trip_owner(id)) with check (owner_id = auth.uid());
create policy trips_delete on public.trips for delete to authenticated using (public.is_trip_owner(id));

-- members: everyone in the trip sees the list; the owner manages roles/removal; a member may leave
create policy members_select on public.trip_members for select to authenticated using (public.can_view_trip(trip_id));
create policy members_update on public.trip_members for update to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy members_delete on public.trip_members for delete to authenticated using (public.is_trip_owner(trip_id) or user_id = auth.uid());

-- itinerary: editors/owner write, viewers read
create policy items_select on public.trip_items for select to authenticated using (public.can_view_trip(trip_id));
create policy items_insert on public.trip_items for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy items_update on public.trip_items for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy items_delete on public.trip_items for delete to authenticated using (public.can_edit_trip(trip_id));

-- votes: editors/owner vote as themselves (viewer voting is an open idea)
create policy votes_select on public.trip_item_votes for select to authenticated using (public.can_view_trip(public.item_trip(item_id)));
create policy votes_insert on public.trip_item_votes for insert to authenticated with check (user_id = auth.uid() and public.can_edit_trip(public.item_trip(item_id)));
create policy votes_update on public.trip_item_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_edit_trip(public.item_trip(item_id)));
create policy votes_delete on public.trip_item_votes for delete to authenticated using (user_id = auth.uid());

-- comments: editors/owner write as themselves; author or trip owner deletes
create policy comments_select on public.trip_item_comments for select to authenticated using (public.can_view_trip(public.item_trip(item_id)));
create policy comments_insert on public.trip_item_comments for insert to authenticated with check (user_id = auth.uid() and public.can_edit_trip(public.item_trip(item_id)));
create policy comments_delete on public.trip_item_comments for delete to authenticated using (user_id = auth.uid() or public.is_trip_owner(public.item_trip(item_id)));

-- expenses and shares: editors/owner write, viewers read
create policy expenses_select on public.expenses for select to authenticated using (public.can_view_trip(trip_id));
create policy expenses_insert on public.expenses for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy expenses_update on public.expenses for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy expenses_delete on public.expenses for delete to authenticated using (public.can_edit_trip(trip_id));

create policy shares_select on public.expense_shares for select to authenticated using (public.can_view_trip(public.expense_trip(expense_id)));
create policy shares_insert on public.expense_shares for insert to authenticated with check (public.can_edit_trip(public.expense_trip(expense_id)));
create policy shares_update on public.expense_shares for update to authenticated using (public.can_edit_trip(public.expense_trip(expense_id))) with check (public.can_edit_trip(public.expense_trip(expense_id)));
create policy shares_delete on public.expense_shares for delete to authenticated using (public.can_edit_trip(public.expense_trip(expense_id)));
