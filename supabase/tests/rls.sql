-- RLS permission matrix. Run against a database where the migrations are applied (local Supabase: `psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql`).
-- Everything runs in one transaction that is rolled back. Raises an exception on the first failed expectation.
begin;

create function pg_temp.expect(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_name; end if;
end $$;
-- helper to act as a user (RLS applies because the role is `authenticated`)
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.reset_role() returns void language plpgsql as $$ begin execute 'reset role'; end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@x.com'), ('00000000-0000-0000-0000-0000000000a2', 'editor@x.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'viewer@x.com'), ('00000000-0000-0000-0000-0000000000a4', 'outsider@x.com');
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000c1', 'Biển', 'bien');
insert into public.destinations (id, name, slug, description, city, region, lat, lng, category_id)
  values ('00000000-0000-0000-0000-0000000000d1', 'HA', 'ha', 'd', 'c', 'r', 1, 1, '00000000-0000-0000-0000-0000000000c1');
insert into public.trips (id, title, start_date, end_date, owner_id)
  values ('00000000-0000-0000-0000-0000000000b1', 'T', '2026-12-01', '2026-12-03', '00000000-0000-0000-0000-0000000000a1');
insert into public.trip_members (trip_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2', 'EDITOR'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a3', 'VIEWER');
insert into public.trip_items (id, trip_id, destination_id, day, position)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 0);

-- outsider sees nothing and cannot write
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select pg_temp.expect('outsider sees no trips', (select count(*) from public.trips) = 0);
select pg_temp.expect('outsider sees no items', (select count(*) from public.trip_items) = 0);
select pg_temp.expect('outsider cannot join without token', (select count(*) from public.trip_members) = 0);
select pg_temp.reset_role();

-- viewer reads but cannot write
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.expect('viewer sees the trip', (select count(*) from public.trips) = 1);
select pg_temp.expect('viewer sees items', (select count(*) from public.trip_items) = 1);
do $$ begin
  begin
    insert into public.trip_items (trip_id, destination_id, day, position) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 1);
    raise exception 'FAILED: viewer inserted an item';
  exception when insufficient_privilege then null; end;
end $$;
with u as (update public.trips set title = 'pwn' returning 1) select pg_temp.expect('viewer cannot update trip', (select count(*) from u) = 0);
with d as (delete from public.trips returning 1) select pg_temp.expect('viewer cannot delete trip', (select count(*) from d) = 0);
select pg_temp.reset_role();

-- editor edits but cannot delete the trip or touch members
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
insert into public.trip_items (trip_id, destination_id, day, position) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 1);
insert into public.trip_item_votes (item_id, value) values ('00000000-0000-0000-0000-0000000000e1', 1);
insert into public.expenses (trip_id, title, category) values ('00000000-0000-0000-0000-0000000000b1', 'x', 'food');
with d as (delete from public.trips returning 1) select pg_temp.expect('editor cannot delete trip', (select count(*) from d) = 0);
with u as (update public.trip_members set role = 'VIEWER' returning 1) select pg_temp.expect('editor cannot change roles', (select count(*) from u) = 0);
select pg_temp.expect('editor cannot read invite token via preview', (select count(*) from public.preview_invite('x')) = 0);
with u as (update public.trips set budget = 5 returning 1) select pg_temp.expect('editor can change the budget', (select count(*) from u) = 1);
do $$ begin
  begin
    update public.trips set invite_token = 'abcdefghijklmnopqrstuvwxyz';
    raise exception 'FAILED: editor changed the invite link';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.reset_role();

-- owner creates a trip (insert + returning) and manages members
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
with t as (insert into public.trips (title, start_date, end_date, owner_id, invite_token) values ('T2', '2026-01-01', '2026-01-02', '00000000-0000-0000-0000-0000000000a1', 'abcdefghijklmnopqrstuv') returning id)
  select pg_temp.expect('owner can insert and read back own trip', (select count(*) from t) = 1);
with u as (update public.trip_members set role = 'VIEWER' where user_id = '00000000-0000-0000-0000-0000000000a2' returning 1)
  select pg_temp.expect('owner can change roles', (select count(*) from u) = 1);
select pg_temp.reset_role();

-- invite link: outsider joins with the token and then sees the trip
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select pg_temp.expect('join_trip returns the trip', public.join_trip('abcdefghijklmnopqrstuv') is not null);
select pg_temp.expect('outsider now sees the invited trip', (select count(*) from public.trips) = 1);
select pg_temp.expect('invalid token is rejected', (select count(*) from public.preview_invite('short')) = 0);
select pg_temp.reset_role();

-- leaving a trip clears votes
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect('editor can leave', public.remove_trip_member('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2'));
select pg_temp.reset_role();
select pg_temp.expect('votes of the leaver are gone', (select count(*) from public.trip_item_votes where user_id = '00000000-0000-0000-0000-0000000000a2') = 0);

rollback;
