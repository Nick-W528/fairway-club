import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  attempt,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  HeroCard,
  Loading,
  PressableScale,
  Row,
  Screen,
  SectionHeader,
  Txt,
  type IconName,
} from '@/components/ui';
import { money, parseMoney, prettyDateTime } from '@/lib/format';
import { memberCode } from '@/lib/member-code';
import { startCheckout } from '@/lib/payments';
import { supabase, unwrap } from '@/lib/supabase';
import type { WalletTransaction } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useAuth } from '@/providers/auth';
import { useCurrentClub } from '@/providers/club';
import { fonts, radius, space, useColors } from '@/theme';

const PRESETS = [1000, 2000, 5000, 10000];

const TX_META: Record<string, { icon: IconName; label: string }> = {
  topup: { icon: 'add-circle-outline', label: 'Top-up' },
  bar_purchase: { icon: 'beer-outline', label: 'Bar' },
  competition_fee: { icon: 'trophy-outline', label: 'Competition' },
  shop_purchase: { icon: 'bag-handle-outline', label: 'Pro shop' },
  refund: { icon: 'return-up-back-outline', label: 'Refund' },
  adjustment: { icon: 'create-outline', label: 'Adjustment' },
};

export default function BarCard() {
  const c = useColors();
  const { session, profile } = useAuth();
  const { club, membership } = useCurrentClub();
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);

  const data = useData(async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [balance, tx] = await Promise.all([
      supabase.rpc('my_wallet_balance', { p_club: club.id }),
      supabase
        .from('wallet_transactions')
        .select('id, amount_cents, type, description, created_at')
        .eq('club_id', club.id)
        .eq('user_id', session!.user.id)
        .order('created_at', { ascending: false })
        .limit(60),
    ]);
    const list = unwrap(tx) as WalletTransaction[];
    const month = list.filter((t) => new Date(t.created_at) >= monthStart && t.amount_cents < 0);
    const spend = (types: string[]) => -month.filter((t) => types.includes(t.type)).reduce((s, t) => s + t.amount_cents, 0);
    return {
      balance: unwrap(balance) as number,
      tx: list,
      month: { bar: spend(['bar_purchase']), shop: spend(['shop_purchase']), comps: spend(['competition_fee']) },
    };
  }, [club.id]);

  const topUp = (amount: number) =>
    attempt(async () => {
      setBusy(amount);
      try {
        await startCheckout({ kind: 'topup', club_id: club.id, amount_cents: amount });
        await data.reload();
      } finally {
        setBusy(null);
      }
    });

  if (data.loading && !data.data) return <Loading />;
  const customCents = parseMoney(custom);
  const m = data.data?.month ?? { bar: 0, shop: 0, comps: 0 };
  const monthTotal = m.bar + m.shop + m.comps;

  return (
    <Screen refreshing={data.loading} onRefresh={data.reload}>
      <ErrorBanner message={data.error} />

      <HeroCard style={{ padding: space.xl }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="label" color={c.accent}>
            Bar card
          </Txt>
          <Txt variant="small" color={c.heroMuted}>
            {club.name}
          </Txt>
        </Row>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="display" color={c.heroText} style={{ fontSize: 48, lineHeight: 50 }}>
              {money(data.data?.balance ?? 0, club.currency)}
            </Txt>
            <Txt color={c.heroText} style={{ fontFamily: fonts.medium }}>
              {profile?.full_name}
            </Txt>
            <Txt variant="small" color={c.heroMuted} style={{ letterSpacing: 1 }}>
              {membership.membership_number ? `No. ${membership.membership_number}` : 'Member'}
            </Txt>
          </View>
          <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: radius.sm }}>
            <QRCode value={memberCode(club.id, session!.user.id)} size={96} color="#0B1310" backgroundColor="#fff" />
          </View>
        </Row>
      </HeroCard>
      <Txt variant="small" style={{ textAlign: 'center' }}>
        Show this code at the bar or pro shop to pay from your card.
      </Txt>

      {club.card_payments_enabled ? (
        showTopUp ? (
          <Card>
            <Txt variant="label">Top up by card</Txt>
            <Row gap={space.sm}>
              {PRESETS.map((p) => (
                <PressableScale
                  key={p}
                  onPress={() => topUp(p)}
                  disabled={busy !== null}
                  style={{
                    flex: 1,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.surfaceAlt,
                    paddingVertical: space.lg,
                    alignItems: 'center',
                    opacity: busy !== null && busy !== p ? 0.5 : 1,
                  }}>
                  <Txt variant="title">{money(p, club.currency).replace('.00', '')}</Txt>
                </PressableScale>
              ))}
            </Row>
            <Row style={{ alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Field label="Other amount" keyboardType="decimal-pad" placeholder="25.00" value={custom} onChangeText={setCustom} />
              </View>
              <Button
                title="Pay"
                variant="accent"
                disabled={!customCents || customCents < 500}
                loading={busy === customCents}
                onPress={() => customCents && topUp(customCents)}
              />
            </Row>
            <Txt variant="small">Minimum {money(500, club.currency)}. Paid securely via Stripe.</Txt>
          </Card>
        ) : (
          <Button title="Top up" icon="add" variant="accent" onPress={() => setShowTopUp(true)} />
        )
      ) : (
        <Card>
          <Txt variant="muted">Online top-ups aren't switched on at {club.name} yet. You can top up with cash or card behind the bar.</Txt>
        </Card>
      )}

      <SectionHeader title="This month" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="label">Spent</Txt>
          <Txt variant="title">{money(monthTotal, club.currency)}</Txt>
        </Row>
        {[
          { label: 'Bar', value: m.bar },
          { label: 'Pro shop', value: m.shop },
          { label: 'Competitions', value: m.comps },
        ].map((r) => (
          <View key={r.label} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="small">{r.label}</Txt>
              <Txt variant="small" style={{ fontFamily: fonts.semibold }}>
                {money(r.value, club.currency)}
              </Txt>
            </Row>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
              <View style={{ height: 6, width: `${monthTotal ? Math.round((r.value / monthTotal) * 100) : 0}%`, backgroundColor: c.accent }} />
            </View>
          </View>
        ))}
      </Card>

      <SectionHeader title="Activity" />
      {data.data?.tx.length === 0 && <EmptyState icon="receipt-outline" title="No activity yet" message="Top-ups and purchases will show here." />}
      {!!data.data?.tx.length && (
        <Card style={{ paddingVertical: space.sm }}>
          {data.data.tx.map((t, i) => {
            const meta = TX_META[t.type] ?? TX_META.adjustment;
            return (
              <Row key={t.id} gap={space.md} style={{ paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderColor: c.border }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={meta.icon} size={18} color={c.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontFamily: fonts.medium }} numberOfLines={1}>
                    {t.description ?? meta.label}
                  </Txt>
                  <Txt variant="small">{prettyDateTime(t.created_at)}</Txt>
                </View>
                <Txt style={{ fontFamily: fonts.semibold }} color={t.amount_cents > 0 ? c.success : c.text}>
                  {t.amount_cents > 0 ? '+' : ''}
                  {money(t.amount_cents, club.currency)}
                </Txt>
              </Row>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
