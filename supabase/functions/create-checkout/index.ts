// Creates a Stripe Checkout session on the club's connected account for
// either a bar card top-up or a pro shop order. Fulfilment happens in
// stripe-webhook once Stripe confirms payment.
import { adminClient, handle, HttpError, json, safeReturnUrl, stripe, userClient, withQuery } from '../_shared/common.ts';

const MIN_TOPUP = 500;
const MAX_TOPUP = 50000;
const PLATFORM_FEE_PERCENT = Number(Deno.env.get('PLATFORM_FEE_PERCENT') ?? '0');

Deno.serve(
  handle(async (req) => {
    const { user } = await userClient(req);
    const body = await req.json();
    const clubId = String(body.club_id ?? '');
    const returnUrl = safeReturnUrl(body.return_url);
    const db = adminClient();

    const { data: member } = await db
      .from('club_members')
      .select('status')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (member?.status !== 'active') throw new HttpError(403, 'Not an active member of this club');

    const [{ data: club }, { data: acct }] = await Promise.all([
      db.from('clubs').select('name, currency').eq('id', clubId).single(),
      db.from('club_stripe_accounts').select('stripe_account_id, charges_enabled').eq('club_id', clubId).maybeSingle(),
    ]);
    if (!club || !acct?.charges_enabled) throw new HttpError(400, 'This club does not accept card payments yet');

    const fee = (amount: number) => Math.round((amount * PLATFORM_FEE_PERCENT) / 100);
    const common = {
      mode: 'payment' as const,
      customer_email: user.email,
      success_url: withQuery(returnUrl, { payment: 'success' }),
      cancel_url: withQuery(returnUrl, { payment: 'cancelled' }),
    };

    if (body.kind === 'topup') {
      const amount = Math.round(Number(body.amount_cents));
      if (!Number.isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
        throw new HttpError(400, 'Invalid top-up amount');
      }
      const session = await stripe.checkout.sessions.create(
        {
          ...common,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: club.currency,
                unit_amount: amount,
                product_data: { name: `${club.name} bar card top-up` },
              },
            },
          ],
          payment_intent_data: PLATFORM_FEE_PERCENT ? { application_fee_amount: fee(amount) } : undefined,
          metadata: { kind: 'topup', club_id: clubId, user_id: user.id, amount_cents: String(amount) },
        },
        { stripeAccount: acct.stripe_account_id },
      );
      return json({ url: session.url });
    }

    if (body.kind === 'order') {
      const items = (Array.isArray(body.items) ? body.items : []) as { product_id: string; quantity: number }[];
      if (!items.length) throw new HttpError(400, 'Basket is empty');
      const { data: products } = await db
        .from('products')
        .select('id, name, price_cents, stock')
        .eq('club_id', clubId)
        .eq('active', true)
        .in('id', items.map((i) => i.product_id));
      const lines = items.map((i) => {
        const p = products?.find((x) => x.id === i.product_id);
        const qty = Math.floor(Number(i.quantity));
        if (!p || qty <= 0) throw new HttpError(400, 'One or more items are unavailable');
        if (p.stock != null && p.stock < qty) throw new HttpError(400, `Not enough stock for ${p.name}`);
        return { p, qty };
      });
      const total = lines.reduce((s, l) => s + l.p.price_cents * l.qty, 0);

      const { data: order, error } = await db
        .from('orders')
        .insert({ club_id: clubId, user_id: user.id, status: 'pending', payment_method: 'card', total_cents: total })
        .select('id')
        .single();
      if (error) throw error;
      await db.from('order_items').insert(
        lines.map((l) => ({
          order_id: order.id,
          product_id: l.p.id,
          name: l.p.name,
          unit_price_cents: l.p.price_cents,
          quantity: l.qty,
        })),
      );

      const session = await stripe.checkout.sessions.create(
        {
          ...common,
          line_items: lines.map((l) => ({
            quantity: l.qty,
            price_data: { currency: club.currency, unit_amount: l.p.price_cents, product_data: { name: l.p.name } },
          })),
          payment_intent_data: PLATFORM_FEE_PERCENT ? { application_fee_amount: fee(total) } : undefined,
          metadata: { kind: 'order', club_id: clubId, user_id: user.id, order_id: order.id },
        },
        { stripeAccount: acct.stripe_account_id },
      );
      await db.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id);
      return json({ url: session.url });
    }

    throw new HttpError(400, 'Unknown checkout kind');
  }),
);
