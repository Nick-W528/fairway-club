// Club admins connect their club's Stripe (Express) account. Returns an
// onboarding link, or a dashboard login link once onboarding is complete.
import { adminClient, handle, HttpError, json, safeReturnUrl, stripe, userClient } from '../_shared/common.ts';

Deno.serve(
  handle(async (req) => {
    const { client } = await userClient(req);
    const body = await req.json();
    const clubId = String(body.club_id ?? '');
    const returnUrl = safeReturnUrl(body.return_url);

    const { data: isAdmin } = await client.rpc('is_club_admin', { p_club: clubId });
    if (!isAdmin) throw new HttpError(403, 'Only club admins can manage payments');

    const db = adminClient();
    const { data: club } = await db.from('clubs').select('name, email').eq('id', clubId).single();
    let { data: acct } = await db
      .from('club_stripe_accounts')
      .select('stripe_account_id')
      .eq('club_id', clubId)
      .maybeSingle();

    if (!acct) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: Deno.env.get('STRIPE_DEFAULT_COUNTRY') ?? 'GB',
        email: club?.email ?? undefined,
        business_profile: { name: club?.name },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { club_id: clubId },
      });
      acct = { stripe_account_id: account.id };
      await db.from('club_stripe_accounts').insert({ club_id: clubId, stripe_account_id: account.id });
    }

    // Sync status every time (covers the return from onboarding without needing the webhook).
    const account = await stripe.accounts.retrieve(acct.stripe_account_id);
    const enabled = !!account.charges_enabled;
    await db
      .from('club_stripe_accounts')
      .update({ charges_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('club_id', clubId);
    await db.from('clubs').update({ card_payments_enabled: enabled }).eq('id', clubId);

    if (account.details_submitted) {
      const login = await stripe.accounts.createLoginLink(account.id);
      return json({ url: login.url, charges_enabled: enabled });
    }

    const link = await stripe.accountLinks.create({
      account: account.id,
      type: 'account_onboarding',
      refresh_url: returnUrl,
      return_url: returnUrl,
    });
    return json({ url: link.url, charges_enabled: enabled });
  }),
);
