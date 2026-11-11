import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Service-role client: bypasses RLS. Only use after checking permissions. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

/** Client acting as the calling user (RLS applies) plus their user id. */
export async function userClient(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
  if (error || !data.user) throw new HttpError(401, 'Not signed in');
  return { client, user: data.user };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Only redirect back to URLs we trust (prevents open redirects).
 * ALLOWED_RETURN_URLS is a comma-separated list of URL prefixes,
 * e.g. "https://app.example.com,golfapp://,http://localhost:8081".
 */
export function safeReturnUrl(url: unknown): string {
  const allowed = (Deno.env.get('ALLOWED_RETURN_URLS') ?? 'golfapp://,http://localhost:8081')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (typeof url === 'string' && allowed.some((p) => url.startsWith(p))) return url;
  return allowed[0];
}

export function withQuery(url: string, params: Record<string, string>) {
  const sep = url.includes('?') ? '&' : '?';
  return url + sep + new URLSearchParams(params).toString();
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Internal error' }, 500);
    }
  };
}
