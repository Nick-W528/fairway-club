-- =====================================================================
-- GolfApp – initial schema
-- Multi-club platform: every club-owned row carries club_id and is
-- protected by row level security (RLS).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.club_role as enum ('member', 'staff', 'admin', 'owner');
create type public.membership_status as enum ('pending', 'active', 'suspended');
-- Areas of the club. Staff are granted one or more of these.
create type public.department as enum (
  'club',          -- business / general management
  'bar',           -- bar & catering
  'pro_shop',      -- shop & retail
  'golf_pro',      -- coaching / teaching pro
  'greenkeeping',  -- course & greenkeepers
  'competitions'   -- competition secretary / committee
);
create type public.competition_format as enum (
  'stableford', 'medal', 'par', 'matchplay', 'texas_scramble', 'fourball', 'other'
);
create type public.competition_status as enum ('draft', 'open', 'closed', 'completed', 'cancelled');
create type public.course_status as enum ('open', 'restricted', 'closed');
create type public.wallet_tx_type as enum (
  'topup', 'bar_purchase', 'competition_fee', 'shop_purchase', 'refund', 'adjustment'
);
create type public.order_status as enum ('pending', 'paid', 'ready', 'collected', 'cancelled');

-- ---------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  handicap_index numeric(3, 1),
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Clubs & membership
-- ---------------------------------------------------------------------
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  tagline text,
  logo_url text,
  cover_url text,
  address text,
  phone text,
  email text,
  website text,
  timezone text not null default 'Europe/London',
  currency text not null default 'gbp',
  -- Tee sheet configuration (club-local times)
  first_tee time not null default '07:00',
  last_tee time not null default '17:00',
  tee_interval_minutes int not null default 10 check (tee_interval_minutes between 5 and 30),
  max_players_per_tee int not null default 4 check (max_players_per_tee between 1 and 4),
  booking_window_days int not null default 14 check (booking_window_days between 1 and 60),
  card_payments_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Stripe Connect details: admin-readable, only written by edge functions (service role).
create table public.club_stripe_accounts (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  stripe_account_id text not null,
  charges_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.club_role not null default 'member',
  status public.membership_status not null default 'pending',
  departments public.department[] not null default '{}',
  membership_number text,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index on public.club_members (user_id);

-- Permission helpers (security definer so policies don't recurse) -------
create function public.is_club_member(p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from club_members
    where club_id = p_club and user_id = auth.uid() and status = 'active'
  );
$$;

create function public.is_club_admin(p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from club_members
    where club_id = p_club and user_id = auth.uid() and status = 'active'
      and role in ('admin', 'owner')
  );
$$;

-- Admins can manage everything; staff only the departments they were given.
create function public.can_manage(p_club uuid, p_dept public.department)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from club_members
    where club_id = p_club and user_id = auth.uid() and status = 'active'
      and (role in ('admin', 'owner') or (role = 'staff' and p_dept = any (departments)))
  );
$$;

-- True when the caller and p_user belong to a common club (caller active).
create function public.shares_club(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from club_members me
    join club_members other on other.club_id = me.club_id
    where me.user_id = auth.uid() and me.status = 'active' and other.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  par int,
  yardage int,
  course_rating numeric(4, 1),
  slope_rating int,
  status public.course_status not null default 'open',
  status_note text,
  buggies_allowed boolean not null default true,
  trolleys_allowed boolean not null default true,
  status_updated_at timestamptz not null default now(),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.courses (club_id);

create table public.holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  number int not null check (number between 1 and 36),
  par int not null check (par between 3 and 6),
  stroke_index int check (stroke_index between 1 and 36),
  yards_white int,
  yards_yellow int,
  yards_red int,
  description text,
  unique (course_id, number)
);

-- ---------------------------------------------------------------------
-- Club updates / news feed
-- ---------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  department public.department not null,
  title text not null,
  body text not null default '',
  image_url text,
  pinned boolean not null default false,
  author_id uuid references public.profiles (id) on delete set null default auth.uid(),
  published_at timestamptz not null default now()
);
create index on public.posts (club_id, published_at desc);

-- ---------------------------------------------------------------------
-- Competitions & tee sheet
-- ---------------------------------------------------------------------
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  description text,
  format public.competition_format not null default 'stableford',
  play_date date not null,
  first_tee time not null,
  last_tee time not null,
  entry_fee_cents int not null default 0 check (entry_fee_cents >= 0),
  max_entries int check (max_entries > 0),
  handicap_allowance int not null default 95 check (handicap_allowance between 0 and 100),
  eligibility text,
  status public.competition_status not null default 'draft',
  entries_close_at timestamptz,
  created_at timestamptz not null default now(),
  check (last_tee >= first_tee)
);
create index on public.competitions (club_id, play_date);

-- Times the tee sheet is closed (maintenance, society days, etc.)
create table public.tee_sheet_blocks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  play_date date not null,
  start_time time not null,
  end_time time not null,
  reason text not null default 'Unavailable',
  check (end_time > start_time)
);
create index on public.tee_sheet_blocks (course_id, play_date);

create table public.tee_bookings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  play_date date not null,
  tee_time time not null,
  competition_id uuid references public.competitions (id) on delete cascade,
  booked_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.tee_bookings (course_id, play_date, tee_time);

create table public.tee_booking_players (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.tee_bookings (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  guest_name text,
  check ((user_id is null) <> (guest_name is null))
);
create index on public.tee_booking_players (booking_id);

create table public.competition_entries (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.tee_bookings (id) on delete cascade,
  fee_paid_cents int not null default 0,
  paid_by uuid references public.profiles (id) on delete set null,
  -- Results (entered by the competition secretary)
  gross_score int,
  net_score int,
  points int,
  position int,
  created_at timestamptz not null default now(),
  primary key (competition_id, user_id)
);

-- ---------------------------------------------------------------------
-- Bar card / member wallet (ledger – balance is the sum of amounts)
-- ---------------------------------------------------------------------
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents int not null check (amount_cents <> 0),
  type public.wallet_tx_type not null,
  description text,
  reference text unique, -- e.g. Stripe checkout session id (idempotency)
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.wallet_transactions (club_id, user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Pro shop
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'General',
  price_cents int not null check (price_cents >= 0),
  image_url text,
  stock int check (stock >= 0), -- null = not tracked
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.products (club_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.order_status not null default 'pending',
  payment_method text not null check (payment_method in ('wallet', 'card')),
  total_cents int not null,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);
create index on public.orders (club_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  unit_price_cents int not null,
  quantity int not null check (quantity > 0)
);

-- =====================================================================
-- Row level security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_stripe_accounts enable row level security;
alter table public.club_members enable row level security;
alter table public.courses enable row level security;
alter table public.holes enable row level security;
alter table public.posts enable row level security;
alter table public.competitions enable row level security;
alter table public.tee_sheet_blocks enable row level security;
alter table public.tee_bookings enable row level security;
alter table public.tee_booking_players enable row level security;
alter table public.competition_entries enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Profiles
create policy "profiles: read self or club-mates" on public.profiles
  for select using (id = auth.uid() or public.shares_club(id));
create policy "profiles: update self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Clubs: public directory, admins edit
create policy "clubs: anyone can read" on public.clubs for select using (true);
create policy "clubs: admins update" on public.clubs
  for update using (public.is_club_admin(id)) with check (public.is_club_admin(id));

create policy "stripe: admins read" on public.club_stripe_accounts
  for select using (public.is_club_admin(club_id));

-- Membership
create policy "members: read own, club-mates, or as admin" on public.club_members
  for select using (
    user_id = auth.uid() or public.is_club_member(club_id) or public.is_club_admin(club_id)
  );
create policy "members: request to join" on public.club_members
  for insert with check (
    user_id = auth.uid() and role = 'member' and status = 'pending' and departments = '{}'
  );
-- Admins manage members but cannot touch or create owners.
create policy "members: admins update" on public.club_members
  for update using (public.is_club_admin(club_id) and role <> 'owner')
  with check (public.is_club_admin(club_id) and role <> 'owner');
create policy "members: leave or admin remove" on public.club_members
  for delete using (
    (user_id = auth.uid() and role <> 'owner')
    or (public.is_club_admin(club_id) and role <> 'owner')
  );

-- Courses & holes: public info, greenkeeping/admin manage
create policy "courses: anyone can read" on public.courses for select using (true);
create policy "courses: greenkeeping manage" on public.courses
  for all using (public.can_manage(club_id, 'greenkeeping'))
  with check (public.can_manage(club_id, 'greenkeeping'));

create policy "holes: anyone can read" on public.holes for select using (true);
create policy "holes: greenkeeping manage" on public.holes
  for all using (
    exists (select 1 from public.courses c where c.id = course_id and public.can_manage(c.club_id, 'greenkeeping'))
  ) with check (
    exists (select 1 from public.courses c where c.id = course_id and public.can_manage(c.club_id, 'greenkeeping'))
  );

-- Posts: members read, the matching department manages
create policy "posts: members read" on public.posts
  for select using (public.is_club_member(club_id));
create policy "posts: department manage" on public.posts
  for all using (public.can_manage(club_id, department))
  with check (public.can_manage(club_id, department));

-- Competitions
create policy "competitions: members read published" on public.competitions
  for select using (
    (public.is_club_member(club_id) and status <> 'draft')
    or public.can_manage(club_id, 'competitions')
  );
create policy "competitions: committee manage" on public.competitions
  for all using (public.can_manage(club_id, 'competitions'))
  with check (public.can_manage(club_id, 'competitions'));

create policy "blocks: members read" on public.tee_sheet_blocks
  for select using (public.is_club_member(club_id));
create policy "blocks: committee manage" on public.tee_sheet_blocks
  for all using (public.can_manage(club_id, 'competitions'))
  with check (public.can_manage(club_id, 'competitions'));

-- Bookings are created/cancelled via RPCs below; members can see the tee sheet.
create policy "bookings: members read" on public.tee_bookings
  for select using (public.is_club_member(club_id));
create policy "booking players: members read" on public.tee_booking_players
  for select using (public.is_club_member(club_id));

create policy "entries: members read" on public.competition_entries
  for select using (public.is_club_member(club_id));
create policy "entries: committee update results" on public.competition_entries
  for update using (public.can_manage(club_id, 'competitions'))
  with check (public.can_manage(club_id, 'competitions'));

-- Wallet: own transactions, or bar staff/admin. Writes via RPC / service role only.
create policy "wallet: read own or as bar staff" on public.wallet_transactions
  for select using (user_id = auth.uid() or public.can_manage(club_id, 'bar'));

-- Shop
create policy "products: members read active" on public.products
  for select using (
    (public.is_club_member(club_id) and active) or public.can_manage(club_id, 'pro_shop')
  );
create policy "products: pro shop manage" on public.products
  for all using (public.can_manage(club_id, 'pro_shop'))
  with check (public.can_manage(club_id, 'pro_shop'));

create policy "orders: read own or as pro shop" on public.orders
  for select using (user_id = auth.uid() or public.can_manage(club_id, 'pro_shop'));
create policy "orders: pro shop update status" on public.orders
  for update using (public.can_manage(club_id, 'pro_shop'))
  with check (public.can_manage(club_id, 'pro_shop'));

create policy "order items: via order" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.can_manage(o.club_id, 'pro_shop'))
    )
  );

-- =====================================================================
-- RPCs (all business rules that must not be bypassed live here)
-- =====================================================================

-- Create a club; the caller becomes its owner.
create function public.create_club(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_club uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into clubs (name, slug) values (p_name, lower(p_slug)) returning id into v_club;
  insert into club_members (club_id, user_id, role, status)
  values (v_club, auth.uid(), 'owner', 'active');
  insert into courses (club_id, name) values (v_club, 'Main Course');
  return v_club;
end $$;

-- Serialises all writes to one member's wallet.
create function public._lock_wallet(p_club uuid, p_user uuid)
returns void language sql as $$
  select pg_advisory_xact_lock(hashtext('wallet:' || p_club::text || ':' || p_user::text));
$$;
revoke execute on function public._lock_wallet(uuid, uuid) from public, anon, authenticated;

create function public._wallet_balance(p_club uuid, p_user uuid)
returns int language sql stable as $$
  select coalesce(sum(amount_cents), 0)::int
  from public.wallet_transactions where club_id = p_club and user_id = p_user;
$$;
revoke execute on function public._wallet_balance(uuid, uuid) from public, anon, authenticated;

-- Caller's own balance at a club.
create function public.my_wallet_balance(p_club uuid)
returns int language sql stable security definer set search_path = public as $$
  select public._wallet_balance(p_club, auth.uid());
$$;

-- Balance for any member – bar staff/admin only.
create function public.member_wallet_balance(p_club uuid, p_user uuid)
returns int language plpgsql stable security definer set search_path = public as $$
begin
  if not can_manage(p_club, 'bar') then raise exception 'Not allowed'; end if;
  return _wallet_balance(p_club, p_user);
end $$;

-- Bar staff: negative amount = charge a purchase, positive = cash top-up.
create function public.bar_card_transaction(
  p_club uuid, p_user uuid, p_amount_cents int, p_description text default null
)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_balance int;
begin
  if not can_manage(p_club, 'bar') then raise exception 'Not allowed'; end if;
  if p_amount_cents = 0 then raise exception 'Amount must not be zero'; end if;
  if not exists (select 1 from club_members where club_id = p_club and user_id = p_user and status = 'active') then
    raise exception 'Not an active member of this club';
  end if;
  perform _lock_wallet(p_club, p_user);
  v_balance := _wallet_balance(p_club, p_user);
  if p_amount_cents < 0 and v_balance + p_amount_cents < 0 then
    raise exception 'Insufficient bar card balance';
  end if;
  insert into wallet_transactions (club_id, user_id, amount_cents, type, description, created_by)
  values (
    p_club, p_user, p_amount_cents,
    case when p_amount_cents < 0 then 'bar_purchase'::wallet_tx_type else 'topup'::wallet_tx_type end,
    coalesce(p_description, case when p_amount_cents < 0 then 'Bar purchase' else 'Cash top-up' end),
    auth.uid()
  );
  return v_balance + p_amount_cents;
end $$;

-- Book a tee time (optionally as a competition entry).
-- The caller is always included; p_partner_ids are other club members.
create function public.book_tee_time(
  p_course uuid,
  p_date date,
  p_time time,
  p_competition uuid default null,
  p_partner_ids uuid[] default '{}',
  p_guest_names text[] default '{}'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_club uuid;
  v_cfg clubs;
  v_comp competitions;
  v_members uuid[];
  v_guests text[];
  v_players int;
  v_taken int;
  v_booking uuid;
  v_total_fee int := 0;
begin
  select club_id into v_club from courses where id = p_course;
  if v_club is null then raise exception 'Course not found'; end if;
  if not is_club_member(v_club) then raise exception 'You are not an active member of this club'; end if;
  select * into v_cfg from clubs where id = v_club;

  v_members := array(select distinct x from unnest(coalesce(p_partner_ids, '{}') || v_uid) as x);
  v_guests := array(select trim(g) from unnest(coalesce(p_guest_names, '{}')) as g where trim(g) <> '');
  v_players := cardinality(v_members) + cardinality(v_guests);

  if exists (
    select 1 from unnest(v_members) as m
    where not exists (select 1 from club_members cm where cm.club_id = v_club and cm.user_id = m and cm.status = 'active')
  ) then
    raise exception 'All playing partners must be active club members';
  end if;

  if p_date < current_date or p_date > current_date + v_cfg.booking_window_days then
    raise exception 'Date is outside the booking window';
  end if;
  if p_time < v_cfg.first_tee or p_time > v_cfg.last_tee
     or (extract(epoch from (p_time - v_cfg.first_tee))::int % (v_cfg.tee_interval_minutes * 60)) <> 0 then
    raise exception 'Invalid tee time';
  end if;
  if exists (
    select 1 from tee_sheet_blocks b
    where b.course_id = p_course and b.play_date = p_date and p_time >= b.start_time and p_time < b.end_time
  ) then
    raise exception 'This tee time is not available';
  end if;

  if p_competition is null then
    if exists (
      select 1 from competitions c
      where c.course_id = p_course and c.play_date = p_date
        and c.status in ('open', 'closed', 'completed')
        and p_time between c.first_tee and c.last_tee
    ) then
      raise exception 'This tee time is reserved for a competition';
    end if;
  else
    select * into v_comp from competitions
    where id = p_competition and course_id = p_course and play_date = p_date;
    if not found then raise exception 'Competition not found for this course and date'; end if;
    if v_comp.status <> 'open' or (v_comp.entries_close_at is not null and now() > v_comp.entries_close_at) then
      raise exception 'Entries for this competition are closed';
    end if;
    if p_time not between v_comp.first_tee and v_comp.last_tee then
      raise exception 'Tee time is outside the competition window';
    end if;
    if cardinality(v_guests) > 0 then raise exception 'Guests cannot enter club competitions'; end if;
    perform pg_advisory_xact_lock(hashtext('comp:' || p_competition::text));
    if exists (select 1 from competition_entries e where e.competition_id = p_competition and e.user_id = any (v_members)) then
      raise exception 'A player in this group is already entered';
    end if;
    if v_comp.max_entries is not null
       and (select count(*) from competition_entries e where e.competition_id = p_competition) + cardinality(v_members) > v_comp.max_entries then
      raise exception 'This competition is full';
    end if;
  end if;

  -- Capacity check, serialised per tee time.
  perform pg_advisory_xact_lock(hashtext('tee:' || p_course::text || p_date::text || p_time::text));
  select count(*) into v_taken
  from tee_booking_players bp join tee_bookings b on b.id = bp.booking_id
  where b.course_id = p_course and b.play_date = p_date and b.tee_time = p_time;
  if v_taken + v_players > v_cfg.max_players_per_tee then
    raise exception 'Not enough space at this tee time';
  end if;
  if exists (
    select 1 from tee_booking_players bp join tee_bookings b on b.id = bp.booking_id
    where b.course_id = p_course and b.play_date = p_date and bp.user_id = any (v_members)
  ) then
    raise exception 'A player in this group already has a booking on this course that day';
  end if;

  insert into tee_bookings (club_id, course_id, play_date, tee_time, competition_id, booked_by)
  values (v_club, p_course, p_date, p_time, p_competition, v_uid)
  returning id into v_booking;

  insert into tee_booking_players (booking_id, club_id, user_id)
  select v_booking, v_club, m from unnest(v_members) as m;
  insert into tee_booking_players (booking_id, club_id, guest_name)
  select v_booking, v_club, g from unnest(v_guests) as g;

  if p_competition is not null then
    -- The person booking pays every entry fee in the group from their bar card.
    v_total_fee := v_comp.entry_fee_cents * cardinality(v_members);
    if v_total_fee > 0 then
      perform _lock_wallet(v_club, v_uid);
      if _wallet_balance(v_club, v_uid) < v_total_fee then
        raise exception 'Insufficient bar card balance to pay entry fees';
      end if;
      insert into wallet_transactions (club_id, user_id, amount_cents, type, description, created_by)
      values (v_club, v_uid, -v_total_fee, 'competition_fee', 'Entry: ' || v_comp.name, v_uid);
    end if;
    insert into competition_entries (competition_id, club_id, user_id, booking_id, fee_paid_cents, paid_by)
    select p_competition, v_club, m, v_booking, v_comp.entry_fee_cents, v_uid from unnest(v_members) as m;
  end if;

  return v_booking;
end $$;

-- Cancel a booking. Members may cancel their own future bookings; admins any.
-- Competition fees are refunded while entries are still open.
create function public.cancel_tee_booking(p_booking uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_b tee_bookings;
  v_comp competitions;
  v_is_admin boolean;
  v_refund int;
begin
  select * into v_b from tee_bookings where id = p_booking;
  if not found then raise exception 'Booking not found'; end if;
  v_is_admin := can_manage(v_b.club_id, 'competitions');
  if v_b.booked_by <> auth.uid() and not v_is_admin then raise exception 'Not allowed'; end if;
  if not v_is_admin and v_b.play_date < current_date then
    raise exception 'Past bookings cannot be cancelled';
  end if;

  if v_b.competition_id is not null then
    select * into v_comp from competitions where id = v_b.competition_id;
    if not v_is_admin and v_comp.status <> 'open' then
      raise exception 'Entries are closed – contact the competition secretary';
    end if;
    select coalesce(sum(fee_paid_cents), 0) into v_refund
    from competition_entries where booking_id = p_booking and paid_by = v_b.booked_by;
    if v_refund > 0 then
      perform _lock_wallet(v_b.club_id, v_b.booked_by);
      insert into wallet_transactions (club_id, user_id, amount_cents, type, description, created_by)
      values (v_b.club_id, v_b.booked_by, v_refund, 'refund', 'Refund: ' || v_comp.name, auth.uid());
    end if;
  end if;

  delete from tee_bookings where id = p_booking; -- cascades players & entries
end $$;

-- Buy pro shop items using the bar card balance.
-- p_items: [{"product_id": "...", "quantity": 1}, ...]
create function public.place_wallet_order(p_club uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_order uuid;
  v_total int := 0;
  v_item record;
begin
  if not is_club_member(p_club) then raise exception 'You are not an active member of this club'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Basket is empty'; end if;

  create temp table _basket on commit drop as
  select p.id, p.name, p.price_cents, p.stock, sum((i ->> 'quantity')::int)::int as quantity
  from jsonb_array_elements(p_items) as i
  join products p on p.id = (i ->> 'product_id')::uuid and p.club_id = p_club and p.active
  group by p.id, p.name, p.price_cents, p.stock;

  if (select count(*) from _basket) <> (select count(distinct i ->> 'product_id') from jsonb_array_elements(p_items) i) then
    raise exception 'One or more items are unavailable';
  end if;
  if exists (select 1 from _basket where quantity <= 0) then raise exception 'Invalid quantity'; end if;

  -- Lock and check stock
  for v_item in select b.* from _basket b join products p on p.id = b.id for update of p loop
    if v_item.stock is not null and v_item.stock < v_item.quantity then
      raise exception 'Not enough stock for %', v_item.name;
    end if;
  end loop;

  select sum(price_cents * quantity) into v_total from _basket;

  perform _lock_wallet(p_club, v_uid);
  if _wallet_balance(p_club, v_uid) < v_total then
    raise exception 'Insufficient bar card balance';
  end if;

  insert into orders (club_id, user_id, status, payment_method, total_cents)
  values (p_club, v_uid, 'paid', 'wallet', v_total) returning id into v_order;
  insert into order_items (order_id, product_id, name, unit_price_cents, quantity)
  select v_order, id, name, price_cents, quantity from _basket;
  update products p set stock = p.stock - b.quantity from _basket b where p.id = b.id and p.stock is not null;
  if v_total > 0 then
    insert into wallet_transactions (club_id, user_id, amount_cents, type, description, reference, created_by)
    values (p_club, v_uid, -v_total, 'shop_purchase', 'Pro shop order', 'order:' || v_order, v_uid);
  end if;
  return v_order;
end $$;

-- Called by the Stripe webhook (service role only) when a card order is paid.
create function public.mark_card_order_paid(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'paid' where id = p_order and status = 'pending';
  if found then
    update products p set stock = greatest(p.stock - i.quantity, 0)
    from order_items i
    where i.order_id = p_order and p.id = i.product_id and p.stock is not null;
  end if;
end $$;
revoke execute on function public.mark_card_order_paid(uuid) from public, anon, authenticated;
grant execute on function public.mark_card_order_paid(uuid) to service_role;

-- =====================================================================
-- Storage: public bucket for club images, writable by club admins.
-- Object paths must start with the club id: <club_id>/filename.jpg
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('club-media', 'club-media', true)
on conflict (id) do nothing;

create policy "club media: admins write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'club-media' and public.is_club_admin(((storage.foldername(name))[1])::uuid));
create policy "club media: admins update" on storage.objects
  for update to authenticated
  using (bucket_id = 'club-media' and public.is_club_admin(((storage.foldername(name))[1])::uuid));
create policy "club media: admins delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'club-media' and public.is_club_admin(((storage.foldername(name))[1])::uuid));
