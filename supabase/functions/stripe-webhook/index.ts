// Stripe Connect webhook. Configure in Stripe as a *Connect* endpoint
// ("Listen to events on connected accounts") for:
//   checkout.session.completed, checkout.session.async_payment_succeeded, account.updated
// Deploy with --no-verify-jwt (Stripe doesn't send a Supabase JWT).
import Stripe from 'npm:stripe@17';

import { adminClient, stripe } from '../_shared/common.ts';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature ?? '',
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
      undefined,
      cryptoProvider,
    );
  } catch (e) {
    return new Response(`Invalid signature: ${(e as Error).message}`, { status: 400 });
  }

  const db = adminClient();

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== 'paid') return new Response('pending');
    const meta = session.metadata ?? {};

    if (meta.kind === 'topup') {
      const { error } = await db.from('wallet_transactions').insert({
        club_id: meta.club_id,
        user_id: meta.user_id,
        amount_cents: session.amount_total ?? Number(meta.amount_cents),
        type: 'topup',
        description: 'Card top-up',
        reference: session.id, // unique → retries are idempotent
      });
      if (error && error.code !== '23505') {
        console.error(error);
        return new Response('db error', { status: 500 });
      }
    } else if (meta.kind === 'order') {
      const { error } = await db.rpc('mark_card_order_paid', { p_order: meta.order_id });
      if (error) {
        console.error(error);
        return new Response('db error', { status: 500 });
      }
    }
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    const { data: row } = await db
      .from('club_stripe_accounts')
      .select('club_id')
      .eq('stripe_account_id', account.id)
      .maybeSingle();
    if (row) {
      const enabled = !!account.charges_enabled;
      await db
        .from('club_stripe_accounts')
        .update({ charges_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('club_id', row.club_id);
      await db.from('clubs').update({ card_payments_enabled: enabled }).eq('id', row.club_id);
    }
  }

  return new Response('ok');
});
