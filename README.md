# Fairway Club (working name)

A golf club platform for members and club staff, with one codebase for **iOS, Android and the web**.

**Members** can:
- Join one or more clubs.
- Read club updates from each area of the club: Club Office, Competitions, Bar & Catering, Pro Shop, Golf Pro and Greenkeeping.
- Book tee times with playing partners and guests, and cancel them.
- Enter competitions from the competition tee sheet. Entry fees come off their bar card, and results are shown when published.
- Use a bar card: check the balance, see transactions and top up by card through Stripe.
- Browse the pro shop and order for click & collect, paying from their bar card or by card.
- See course information: live course status, buggy and trolley rules, and the scorecard.

**Club staff** see a *Club management* area. What they can do depends on their role:

| Area | Who |
|---|---|
| Members: approve, suspend, set roles and staff areas, membership numbers | Admin / Owner |
| Club updates: post as your department, pin, delete | Staff in that department |
| Competitions: create, open or close entries, enter results, withdraw groups | Competitions staff |
| Tee sheet: view all bookings, cancel, block out times | Competitions staff |
| Bar till: find a member, charge their card, take cash top-ups | Bar staff |
| Pro shop: products, stock, orders to fulfil | Pro shop staff |
| Course: status message, buggies, details, scorecard editor | Greenkeeping staff |
| Club settings: details, tee interval and booking window, Stripe | Admin / Owner |

## Tech stack

- **App:** Expo SDK 58 + Expo Router, React Native and React Native Web, TypeScript.
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions).
- **Payments:** Stripe Connect. Each club connects its own Stripe account and money goes straight to that club. The platform can optionally take a percentage.

```
src/app/                 Screens (Expo Router file-based routes)
  sign-in, sign-up, clubs  Auth + club picker / join / register
  (app)/(tabs)/            Member tabs: Home, Tee times, Competitions, Bar card, More
  (app)/admin/             Club management screens
src/components/          UI kit, tee sheet, booking modal
src/lib/                 Supabase client, queries, types, formatting, payments
src/providers/           Auth + current-club context (roles/permissions)
supabase/migrations/     Database schema, row-level security, business-rule RPCs
supabase/functions/      Stripe edge functions (checkout, connect onboarding, webhook)
supabase/tests/          Database tests (run in-memory with PGlite)
```

### Where the rules are enforced

All the important rules run **in the database**, so a modified app can't get around them:
- Row-level security keeps every club's data separate. Staff can only manage the departments they've been given.
- `book_tee_time` checks the booking window, the tee interval, blocked times, competition windows, capacity (with locking), double bookings, competition entry limits and fees.
- `cancel_tee_booking` refunds competition fees.
- `bar_card_transaction` and `place_wallet_order` lock the wallet ledger so a balance can't go negative.
- Card payments are only credited by the Stripe webhook, using the service role, and each payment is credited only once.

## Getting started

### 1. Install
```bash
npm install
```

### 2. Create a Supabase project
1. Create a free project at [supabase.com](https://supabase.com).
2. Apply the schema. Either paste `supabase/migrations/20261110000000_init.sql` into **SQL Editor** and run it, or use the CLI:
   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```
3. Optional: run `supabase/seed.sql` in the SQL editor to load the demo **Oakridge Golf Club**.
4. Copy `.env.example` to `.env` and fill in the project URL and anon key from **Settings → API**.

### 3. Run
```bash
npm run web       # browser
npm start         # then press i / a, or scan the QR code with Expo Go
```

### 4. Become a club admin
- **New club:** sign up and choose **Register club**. You become its owner automatically.
- **Demo club:** sign up, search for "Oakridge" and request to join. Then make yourself the owner in the SQL editor:
  ```sql
  update club_members set role = 'owner', status = 'active'
  where user_id = (select id from auth.users where email = 'you@example.com');
  ```

### 5. Card payments (optional)
1. Turn on **Connect** in your Stripe dashboard (test mode).
2. Copy `supabase/functions/.env.example` to `supabase/functions/.env`, fill it in, then deploy:
   ```bash
   npx supabase secrets set --env-file supabase/functions/.env
   npx supabase functions deploy create-checkout
   npx supabase functions deploy stripe-connect
   npx supabase functions deploy stripe-webhook --no-verify-jwt
   ```
3. In Stripe, add a **Connect** webhook endpoint at `https://<project>.supabase.co/functions/v1/stripe-webhook` for these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `account.updated`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. In the app, go to **More → Club management → Club settings → Connect Stripe**.

> Apple and Google allow third-party payment providers like Stripe for real-world goods and services, such as bar credit, merchandise and competition entries. In-app purchase isn't needed for these.

## Checks
```bash
npm run typecheck
npm run lint
npm run test:db   # 50 database tests: bookings, fees, refunds, wallet, shop, RLS
```

## Shipping to the app stores
Builds use [EAS](https://docs.expo.dev/eas/):
```bash
npx eas-cli@latest build --platform all
npx eas-cli@latest submit
```
Before submitting, change `ios.bundleIdentifier` and `android.package` in `app.json` (they are currently `com.example.golfapp`), and set the app name and icons.

For the web version, run `npx expo export --platform web` and host the `dist/` folder on any static host (Vercel, Netlify, Cloudflare Pages). Add that URL to `ALLOWED_RETURN_URLS`.

## Roadmap ideas (not built yet)
- **Handicaps & scoring:** WHS / England Golf (or other national body) integration, digital scorecards with live leaderboards, marker sign-off, automatic results.
- **Push notifications:** new posts, tee time reminders, competition results (expo-notifications).
- **Image uploads** for posts, products and course photos. The `club-media` storage bucket and its policies already exist.
- **Tee sheet rules:** member categories and booking restrictions, guest green fees, visitor and society bookings, ballot draws, waiting lists.
- **Paying competition fees by card**, and an option for each player to pay their own fee.
- **Club reporting:** revenue, bar card float, competition entries, membership stats. Data exports.
- **Platform billing** (charging clubs a subscription) and a super-admin console.
- Realtime tee sheet updates (Supabase Realtime), offline caching, accessibility review.
