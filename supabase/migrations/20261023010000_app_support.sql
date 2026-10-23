-- Support for the Supabase-backed app: destination rating, public catalogue, and atomic helpers.

alter table public.destinations add column rating double precision not null default 0;

-- The catalogue is public (the destinations pages work signed out).
drop policy categories_select on public.categories;
drop policy destinations_select on public.destinations;
create policy categories_select on public.categories for select to anon, authenticated using (true);
create policy destinations_select on public.destinations for select to anon, authenticated using (true);
grant select on public.categories, public.destinations to anon;

-- INSERT ... RETURNING cannot see the new row through the helper function, so the owner check is direct.
drop policy trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated using (owner_id = auth.uid() or public.can_view_trip(id));

-- Owner removes a member, or a member leaves. Also drops them from this trip's votes and cost splitting.
create function public.remove_trip_member(p_trip uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (public.is_trip_owner(p_trip) or p_user = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.trip_members where trip_id = p_trip and user_id = p_user;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  update public.expenses set paid_by = null where trip_id = p_trip and paid_by = p_user;
  delete from public.expense_shares s using public.expenses e where s.expense_id = e.id and e.trip_id = p_trip and s.user_id = p_user;
  delete from public.trip_item_votes v using public.trip_items i where v.item_id = i.id and i.trip_id = p_trip and v.user_id = p_user;
  return true;
end $$;

-- Bulk reorder in one statement (RLS applies: security invoker). p_items = [{"id","day","position"}].
create function public.reorder_trip_items(p_trip uuid, p_items jsonb) returns integer
language sql security invoker set search_path = public as $$
  with u as (
    update public.trip_items i set day = r.day, position = r.position
    from jsonb_to_recordset(p_items) as r(id uuid, day integer, position integer)
    where i.id = r.id and i.trip_id = p_trip
    returning 1
  ) select count(*)::integer from u
$$;

-- Replace the split of an expense atomically. p_rows = [{"user_id","amount"}] (amount null = equal part).
create function public.replace_expense_shares(p_expense uuid, p_rows jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  delete from public.expense_shares where expense_id = p_expense;
  insert into public.expense_shares (expense_id, user_id, amount)
  select p_expense, r.user_id, r.amount from jsonb_to_recordset(p_rows) as r(user_id uuid, amount integer);
end $$;

revoke all on function public.remove_trip_member(uuid, uuid), public.reorder_trip_items(uuid, jsonb), public.replace_expense_shares(uuid, jsonb) from public, anon;
grant execute on function public.remove_trip_member(uuid, uuid), public.reorder_trip_items(uuid, jsonb), public.replace_expense_shares(uuid, jsonb) to authenticated;

-- Editors may change title/budget; only the owner may touch ownership or the invite link.
drop policy trips_update on public.trips;
create policy trips_update on public.trips for update to authenticated using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));

create function public.trips_guard() returns trigger language plpgsql as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'owner cannot be changed' using errcode = '42501'; end if;
  if (new.invite_token is distinct from old.invite_token or new.invite_role <> old.invite_role) and old.owner_id <> auth.uid() then
    raise exception 'only the owner can change the invite link' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trips_guard before update on public.trips for each row execute function public.trips_guard();

-- Richer invite preview (needs the owner's name and whether the caller already belongs).
drop function public.preview_invite(text);
create function public.preview_invite(p_token text)
returns table (trip_id uuid, title text, start_date date, end_date date, owner_name text, role public.trip_role, already_member boolean)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.start_date, t.end_date, p.name, t.invite_role,
         (t.owner_id = auth.uid() or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
  from public.trips t join public.profiles p on p.id = t.owner_id
  where t.invite_token = p_token and length(p_token) >= 16
$$;
revoke all on function public.preview_invite(text) from public, anon;
grant execute on function public.preview_invite(text) to authenticated;
