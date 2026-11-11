// Run with: npm run test:db
// Runs the GolfApp migration + seed in PGlite with stubbed Supabase schemas,
// then exercises RPCs and RLS policies as different users.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? process.cwd();
const migDir = path.join(root, 'supabase/migrations');
const migrations = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort().map((f) => fs.readFileSync(path.join(migDir, f), 'utf8'));
const seed = fs.readFileSync(path.join(root, 'supabase/seed.sql'), 'utf8');

const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql as
    $$ select string_to_array(name, '/') $$;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
for (const m of migrations) await db.exec(m);
console.log('✔ migration applied');
await db.exec(seed);
console.log('✔ seed applied');
await db.exec("update clubs set latitude = 51.75, longitude = -1.26 where slug = 'oakridge'");

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass++;
    console.log('  ✔', msg);
  } else {
    fail++;
    console.log('  ✘', msg);
  }
};

const A = '11111111-1111-1111-1111-111111111111'; // club owner
const B = '22222222-2222-2222-2222-222222222222'; // member
const C = '33333333-3333-3333-3333-333333333333'; // staff (bar)
const D = '44444444-4444-4444-4444-444444444444'; // outsider

for (const [id, name] of [[A, 'Alice Owner'], [B, 'Bob Member'], [C, 'Cara Barstaff'], [D, 'Dan Outsider']]) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${name.split(' ')[0].toLowerCase()}@test`,
    { full_name: name },
  ]);
}
ok((await db.query('select count(*)::int n from profiles')).rows[0].n === 4, 'profiles auto-created by trigger');

/** Run a query as an authenticated user (RLS applies). */
async function as(uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('test.uid', $1, true)`, [uid ?? '']);
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
    return tx.query(sql, params);
  });
}
async function expectError(promise, pattern, msg) {
  try {
    await promise;
    ok(false, `${msg} (expected error ${pattern})`);
  } catch (e) {
    ok(pattern.test(e.message), `${msg} → "${e.message}"`);
  }
}

console.log('\nClubs & membership');
const club = (await as(A, `select public.create_club('Test Club', 'testclub') id`)).rows[0].id;
ok(!!club, 'owner creates club');
const course = (await as(A, `select id from courses where club_id = $1`, [club])).rows[0].id;
ok(!!course, 'default course created');

await as(B, `insert into club_members (club_id, user_id) values ($1, $2)`, [club, B]);
await as(C, `insert into club_members (club_id, user_id) values ($1, $2)`, [club, C]);
await expectError(
  as(D, `insert into club_members (club_id, user_id, role, status) values ($1, $2, 'admin', 'active')`, [club, D]),
  /row-level security/,
  'outsider cannot self-insert as active admin',
);
const pendingSeen = await as(B, `select * from club_members where club_id = $1`, [club]);
ok(pendingSeen.rows.length === 1, 'pending member only sees own membership row');

await as(A, `update club_members set status = 'active', membership_number = 'M100' where club_id = $1 and user_id = $2`, [club, B]);
await as(A, `update club_members set status = 'active', role = 'staff', departments = '{bar}' where club_id = $1 and user_id = $2`, [club, C]);
const bRow = (await as(A, `select status from club_members where club_id = $1 and user_id = $2`, [club, B])).rows[0];
ok(bRow.status === 'active', 'admin approves member');

const selfPromote = await as(B, `update club_members set role = 'admin' where club_id = $1 and user_id = $2`, [club, B]);
ok(selfPromote.affectedRows === 0, 'member cannot promote themselves');
const demoteOwner = await as(B, `update club_members set role = 'member' where club_id = $1 and user_id = $2`, [club, A]);
ok(demoteOwner.affectedRows === 0, 'member cannot demote owner');

ok((await as(B, `select * from profiles`)).rows.length === 3, 'member sees club-mates profiles but not outsiders');
ok((await as(D, `select * from profiles`)).rows.length === 1, 'outsider sees only own profile');

console.log('\nPosts');
await as(A, `insert into posts (club_id, department, title) values ($1, 'club', 'Hello')`, [club]);
await as(C, `insert into posts (club_id, department, title) values ($1, 'bar', 'Bar news')`, [club]);
await expectError(
  as(C, `insert into posts (club_id, department, title) values ($1, 'greenkeeping', 'Nope')`, [club]),
  /row-level security/,
  'bar staff cannot post as greenkeeping',
);
await expectError(
  as(B, `insert into posts (club_id, department, title) values ($1, 'club', 'Nope')`, [club]),
  /row-level security/,
  'member cannot post',
);
ok((await as(B, `select * from posts where club_id = $1`, [club])).rows.length === 2, 'member reads club posts');
ok((await as(D, `select * from posts where club_id = $1`, [club])).rows.length === 0, 'outsider cannot read posts');

console.log('\nTee sheet');
const tomorrow = (await db.query(`select (current_date + 1)::text d`)).rows[0].d;
const book = (uid, time, opts = {}) =>
  as(uid, `select public.book_tee_time($1, $2::date, $3::time, $4, $5::uuid[], $6::text[]) id`, [
    course,
    opts.date ?? tomorrow,
    time,
    opts.comp ?? null,
    opts.partners ?? [],
    opts.guests ?? [],
  ]);
const b1 = (await book(B, '08:00', { guests: ['Guest One'] })).rows[0].id;
ok(!!b1, 'member books 08:00 with a guest');
await expectError(book(C, '08:00', { guests: ['g1', 'g2', 'g3'] }), /Not enough space/, 'over-capacity booking rejected');
await expectError(book(C, '08:05'), /Invalid tee time/, 'off-interval time rejected');
await expectError(book(D, '08:30'), /not an active member/, 'outsider cannot book');
await expectError(book(C, '08:30', { date: '2000-01-01' }), /booking window/, 'past date rejected');
await expectError(book(B, '10:00'), /already has a booking/, 'same player cannot double-book the day');
ok((await as(C, `select * from tee_booking_players where booking_id = $1`, [b1])).rows.length === 2, 'club-mates can see tee sheet');

await as(A, `insert into tee_sheet_blocks (club_id, course_id, play_date, start_time, end_time, reason) values ($1, $2, $3, '12:00', '13:00', 'Society')`, [club, course, tomorrow]);
await expectError(book(C, '12:30'), /not available/, 'blocked time rejected');

console.log('\nCompetitions & bar card');
const comp = (
  await as(A, `insert into competitions (club_id, course_id, name, play_date, first_tee, last_tee, entry_fee_cents, status)
               values ($1, $2, 'Medal', $3, '09:00', '10:00', 500, 'open') returning id`, [club, course, tomorrow])
).rows[0].id;
await expectError(book(C, '09:30'), /reserved for a competition/, 'general play blocked during competition');
await expectError(book(C, '09:30', { comp, guests: ['x'] }), /Guests cannot/, 'guests cannot enter competition');
await expectError(book(C, '09:30', { comp }), /Insufficient bar card balance/, 'entry needs bar card funds');

await expectError(
  as(B, `insert into wallet_transactions (club_id, user_id, amount_cents, type) values ($1, $2, 99999, 'topup')`, [club, B]),
  /row-level security/,
  'member cannot credit own wallet',
);
await expectError(as(B, `select public.bar_card_transaction($1, $2, 1000)`, [club, B]), /Not allowed/, 'member cannot use bar till');
const bal1 = (await as(C, `select public.bar_card_transaction($1, $2, 2000, 'Cash') b`, [club, C])).rows[0].b;
ok(bal1 === 2000, 'bar staff cash top-up → 2000');
await expectError(as(C, `select public.bar_card_transaction($1, $2, -5000)`, [club, C]), /Insufficient/, 'cannot overdraw bar card');
await expectError(as(B, `select public._wallet_balance($1, $2)`, [club, C]), /permission denied/, 'internal balance fn not callable');
await expectError(as(B, `select public.member_wallet_balance($1, $2)`, [club, C]), /Not allowed/, 'member cannot read others balance');

// Cara enters the comp and pays for Alice too.
const cb = (await book(C, '09:30', { comp, partners: [A] })).rows[0].id;
ok(!!cb, 'staff enters competition with a partner');
const balAfter = (await as(C, `select public.my_wallet_balance($1) b`, [club])).rows[0].b;
ok(balAfter === 1000, `two entry fees deducted (balance ${balAfter})`);
ok((await as(B, `select * from competition_entries where competition_id = $1`, [comp])).rows.length === 2, 'entries visible to members');
await expectError(book(A, '09:40', { comp }), /already entered|already has a booking/, 'cannot enter twice');
ok((await as(B, `select * from wallet_transactions where club_id = $1`, [club])).rows.length === 0, 'member cannot see others transactions');

await expectError(as(B, `select public.cancel_tee_booking($1)`, [cb]), /Not allowed/, 'cannot cancel someone else’s booking');
await as(C, `select public.cancel_tee_booking($1)`, [cb]);
const balRefund = (await as(C, `select public.my_wallet_balance($1) b`, [club])).rows[0].b;
ok(balRefund === 2000, `cancel refunds fees (balance ${balRefund})`);
ok((await db.query(`select count(*)::int n from competition_entries where competition_id = $1`, [comp])).rows[0].n === 0, 'entries removed on cancel');

const resultUpd = await as(B, `update competition_entries set points = 40 where competition_id = $1`, [comp]);
ok(resultUpd.affectedRows === 0, 'member cannot edit results');

console.log('\nPro shop');
const prod = (await as(A, `insert into products (club_id, name, price_cents, stock) values ($1, 'Polo', 1500, 1) returning id`, [club])).rows[0].id;
await expectError(
  as(C, `select public.place_wallet_order($1, $2::jsonb)`, [club, JSON.stringify([{ product_id: prod, quantity: 2 }])]),
  /Not enough stock/,
  'stock enforced',
);
const order = (await as(C, `select public.place_wallet_order($1, $2::jsonb) id`, [club, JSON.stringify([{ product_id: prod, quantity: 1 }])])).rows[0].id;
ok(!!order, 'wallet order placed');
ok((await as(C, `select public.my_wallet_balance($1) b`, [club])).rows[0].b === 500, 'order charged to bar card');
ok((await db.query(`select stock from products where id = $1`, [prod])).rows[0].stock === 0, 'stock decremented');
await expectError(
  as(C, `select public.place_wallet_order($1, $2::jsonb)`, [club, JSON.stringify([{ product_id: prod, quantity: 1 }])]),
  /Not enough stock/,
  'sold-out product rejected',
);
ok((await as(B, `select * from orders`)).rows.length === 0, 'member cannot see others orders');
ok((await as(A, `select * from orders`)).rows.length === 1, 'admin sees orders');
await expectError(as(B, `select public.mark_card_order_paid($1)`, [order]), /permission denied/, 'mark_card_order_paid is service-only');

console.log('\nSeed club');
ok((await db.query(`select count(*)::int n from holes`)).rows[0].n === 18, 'seed has 18 holes');
ok((await as(D, `select * from clubs`)).rows.length === 2, 'club directory is public');

console.log('\nBranding');
await db.exec(`update clubs set brand_color = '#1F4A33', latitude = 51.75, longitude = -1.26 where slug = 'oakridge'`);
ok((await db.query(`select brand_color from clubs where slug = 'oakridge'`)).rows[0].brand_color === '#1F4A33', 'brand colour saved');
await expectError(db.query(`update clubs set brand_color = 'green' where slug = 'oakridge'`), /check constraint/, 'invalid brand colour rejected');
const selfBrand = await as(B, `update clubs set brand_color = '#000000' where id = $1`, [club]);
ok(selfBrand.affectedRows === 0, 'member cannot change club branding');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
