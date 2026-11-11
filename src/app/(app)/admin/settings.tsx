import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  attempt,
  Badge,
  Button,
  Card,
  Field,
  notify,
  PressableScale,
  Row,
  Screen,
  SectionHeader,
  Stack,
  Txt,
} from '@/components/ui';
import { DateField } from '@/components/date-field';
import { hhmm, isValidTime } from '@/lib/format';
import { startStripeOnboarding } from '@/lib/payments';
import { supabase, unwrap } from '@/lib/supabase';
import { useData } from '@/lib/use-data';
import { useClub, useCurrentClub } from '@/providers/club';
import { useColors } from '@/theme';

const BRAND_SWATCHES = [
  { label: 'Default lime', value: '' },
  { label: 'Fairway green', value: '#1F7A4D' },
  { label: 'Racing green', value: '#1F4A33' },
  { label: 'Navy', value: '#1E3A6E' },
  { label: 'Royal blue', value: '#2F5BD3' },
  { label: 'Claret', value: '#7A1F3D' },
  { label: 'Gold', value: '#C9A227' },
  { label: 'Orange', value: '#E07A1F' },
];

export default function ClubSettings() {
  const c = useColors();
  const { club, isAdmin } = useCurrentClub();
  const { reload } = useClub();
  const [f, setF] = useState({
    name: club.name,
    tagline: club.tagline ?? '',
    address: club.address ?? '',
    phone: club.phone ?? '',
    email: club.email ?? '',
    website: club.website ?? '',
    logo_url: club.logo_url ?? '',
    first_tee: hhmm(club.first_tee),
    last_tee: hhmm(club.last_tee),
    tee_interval_minutes: String(club.tee_interval_minutes),
    max_players_per_tee: String(club.max_players_per_tee),
    booking_window_days: String(club.booking_window_days),
    brand_color: club.brand_color ?? '',
    latitude: club.latitude?.toString() ?? '',
    longitude: club.longitude?.toString() ?? '',
  });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const [busy, setBusy] = useState<string | null>(null);

  const stripe = useData(async () => {
    const { data } = await supabase.from('club_stripe_accounts').select('charges_enabled').eq('club_id', club.id).maybeSingle();
    return data as { charges_enabled: boolean } | null;
  }, [club.id]);

  if (!isAdmin) return <Screen><Txt>Only club admins can change settings.</Txt></Screen>;

  const save = () =>
    attempt(async () => {
      if (!isValidTime(f.first_tee) || !isValidTime(f.last_tee)) throw new Error('Choose the first and last tee times');
      if (f.brand_color && !/^#[0-9A-Fa-f]{6}$/.test(f.brand_color)) throw new Error('Brand colour must look like #1F5C3A');
      const lat = f.latitude.trim() ? Number(f.latitude) : null;
      const lon = f.longitude.trim() ? Number(f.longitude) : null;
      if ((lat != null && Number.isNaN(lat)) || (lon != null && Number.isNaN(lon))) throw new Error('Location must be numbers');
      setBusy('save');
      try {
        unwrap(
          await supabase
            .from('clubs')
            .update({
              name: f.name.trim(),
              tagline: f.tagline.trim() || null,
              address: f.address.trim() || null,
              phone: f.phone.trim() || null,
              email: f.email.trim() || null,
              website: f.website.trim() || null,
              logo_url: f.logo_url.trim() || null,
              first_tee: f.first_tee,
              last_tee: f.last_tee,
              tee_interval_minutes: Number(f.tee_interval_minutes),
              max_players_per_tee: Number(f.max_players_per_tee),
              booking_window_days: Number(f.booking_window_days),
              brand_color: f.brand_color || null,
              latitude: lat,
              longitude: lon,
            })
            .eq('id', club.id),
        );
        await reload();
        notify('Settings saved');
      } finally {
        setBusy(null);
      }
    });

  const connect = () =>
    attempt(async () => {
      setBusy('stripe');
      try {
        await startStripeOnboarding(club.id);
        await stripe.reload();
        await reload();
      } finally {
        setBusy(null);
      }
    });

  const half = (children: ReactNode) => <View style={{ flex: 1 }}>{children}</View>;

  return (
    <Screen>
      <SectionHeader title="Club details" />
      <Card>
        <Stack>
          <Field label="Club name" value={f.name} onChangeText={(name) => set({ name })} />
          <Field label="Tagline" value={f.tagline} onChangeText={(tagline) => set({ tagline })} />
          <Field label="Address" value={f.address} onChangeText={(address) => set({ address })} />
          <Row style={{ alignItems: 'flex-start' }}>
            {half(<Field label="Phone" value={f.phone} onChangeText={(phone) => set({ phone })} />)}
            {half(<Field label="Email" value={f.email} onChangeText={(email) => set({ email })} autoCapitalize="none" />)}
          </Row>
          <Field label="Website" value={f.website} onChangeText={(website) => set({ website })} autoCapitalize="none" />
          <Field label="Logo URL" value={f.logo_url} onChangeText={(logo_url) => set({ logo_url })} autoCapitalize="none" />
        </Stack>
      </Card>

      <SectionHeader title="Branding" />
      <Card>
        <Stack>
          <Txt variant="muted">Your club's colour is used for buttons, highlights and the bar card across the app.</Txt>
          <Row wrap>
            {BRAND_SWATCHES.map((sw) => (
              <PressableScale
                key={sw.label}
                onPress={() => set({ brand_color: sw.value })}
                accessibilityLabel={sw.label}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: sw.value || '#C6F432',
                  borderWidth: f.brand_color === sw.value ? 3 : 1,
                  borderColor: f.brand_color === sw.value ? c.text : c.border,
                }}
              />
            ))}
          </Row>
          <Field label="Custom colour" value={f.brand_color} onChangeText={(v) => set({ brand_color: v.trim() })} autoCapitalize="none" placeholder="#1F5C3A (blank = default lime)" />
          <Txt variant="label">Club location (for the weather)</Txt>
          <Row style={{ alignItems: 'flex-start' }}>
            {half(<Field placeholder="Latitude, e.g. 51.75" value={f.latitude} onChangeText={(latitude) => set({ latitude })} keyboardType="numbers-and-punctuation" />)}
            {half(<Field placeholder="Longitude, e.g. -1.26" value={f.longitude} onChangeText={(longitude) => set({ longitude })} keyboardType="numbers-and-punctuation" />)}
          </Row>
        </Stack>
      </Card>

      <SectionHeader title="Tee sheet rules" />
      <Card>
        <Stack>
          <Row style={{ alignItems: 'flex-start' }}>
            {half(<DateField mode="time" label="First tee" value={f.first_tee} onChange={(first_tee) => set({ first_tee })} />)}
            {half(<DateField mode="time" label="Last tee" value={f.last_tee} onChange={(last_tee) => set({ last_tee })} />)}
          </Row>
          <Row style={{ alignItems: 'flex-start' }}>
            {half(<Field label="Interval (min)" value={f.tee_interval_minutes} onChangeText={(v) => set({ tee_interval_minutes: v })} keyboardType="number-pad" />)}
            {half(<Field label="Players per tee" value={f.max_players_per_tee} onChangeText={(v) => set({ max_players_per_tee: v })} keyboardType="number-pad" />)}
            {half(<Field label="Book ahead (days)" value={f.booking_window_days} onChangeText={(v) => set({ booking_window_days: v })} keyboardType="number-pad" />)}
          </Row>
        </Stack>
      </Card>
      <Button title="Save settings" onPress={save} loading={busy === 'save'} />

      <SectionHeader title="Online payments" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="heading">Stripe</Txt>
          <Badge
            label={stripe.data?.charges_enabled ? 'Active' : stripe.data ? 'Setup incomplete' : 'Not connected'}
            tone={stripe.data?.charges_enabled ? 'success' : 'warning'}
          />
        </Row>
        <Txt variant="muted">
          Connect your club's Stripe account so members can top up bar cards and buy from the shop by card. Money goes straight to your club's account.
        </Txt>
        <Button
          title={stripe.data ? 'Continue Stripe setup' : 'Connect Stripe'}
          variant="secondary"
          onPress={connect}
          loading={busy === 'stripe'}
        />
      </Card>
    </Screen>
  );
}
