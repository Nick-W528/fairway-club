import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type CheckoutRequest =
  | { kind: 'topup'; club_id: string; amount_cents: number }
  | { kind: 'order'; club_id: string; items: { product_id: string; quantity: number }[] };

/**
 * Starts a Stripe Checkout session via the `create-checkout` edge function and
 * opens it. The Stripe webhook credits the bar card / marks the order paid.
 */
export async function startCheckout(req: CheckoutRequest) {
  const returnUrl =
    Platform.OS === 'web' ? window.location.href : 'golfapp://payment-complete';
  const { data, error } = await supabase.functions.invoke<{ url: string }>('create-checkout', {
    body: { ...req, return_url: returnUrl },
  });
  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error('Could not start checkout');
  if (Platform.OS === 'web') {
    window.location.assign(data.url);
  } else {
    await WebBrowser.openAuthSessionAsync(data.url, returnUrl);
  }
}

/** Club admin: start / resume Stripe Connect onboarding. */
export async function startStripeOnboarding(clubId: string) {
  const returnUrl = Platform.OS === 'web' ? window.location.href : 'golfapp://stripe-return';
  const { data, error } = await supabase.functions.invoke<{ url: string }>('stripe-connect', {
    body: { club_id: clubId, return_url: returnUrl },
  });
  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error('Could not start Stripe onboarding');
  if (Platform.OS === 'web') window.location.assign(data.url);
  else await WebBrowser.openAuthSessionAsync(data.url, returnUrl);
}
