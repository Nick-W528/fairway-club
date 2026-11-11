import { router } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';

import { Badge, Card, ListItem, Row, Screen, SectionHeader, Skeleton, Txt } from '@/components/ui';
import { visibleSections } from '@/lib/admin-nav';
import { isoDate, money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';
import { space, useColors } from '@/theme';

interface Stat {
  label: string;
  value: string;
  href?: Parameters<typeof router.push>[0];
  alert?: boolean;
}

export default function AdminOverview() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const { club, isAdmin, membership, canManage } = useCurrentClub();
  const today = isoDate(new Date());

  const stats = useData(async () => {
    const out: Stat[] = [];
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const jobs: Promise<void>[] = [];
    if (canManage('competitions')) {
      jobs.push(
        (async () => {
          const { data } = await supabase
            .from('tee_bookings')
            .select('id, tee_booking_players(count)')
            .eq('club_id', club.id)
            .eq('play_date', today);
          const players = ((data ?? []) as { tee_booking_players: { count: number }[] }[]).reduce(
            (s, b) => s + (b.tee_booking_players[0]?.count ?? 0),
            0,
          );
          out.push({ label: 'Golfers today', value: String(players), href: '/(app)/admin/tee-sheet' });
        })(),
      );
    }
    if (canManage('bar')) {
      jobs.push(
        (async () => {
          const { data } = await supabase
            .from('wallet_transactions')
            .select('amount_cents')
            .eq('club_id', club.id)
            .eq('type', 'bar_purchase')
            .gte('created_at', startOfDay.toISOString());
          const total = -((data ?? []) as { amount_cents: number }[]).reduce((s, t) => s + t.amount_cents, 0);
          out.push({ label: 'Bar card sales today', value: money(total, club.currency), href: '/(app)/admin/bar' });
        })(),
      );
    }
    if (canManage('pro_shop')) {
      jobs.push(
        (async () => {
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('club_id', club.id)
            .in('status', ['paid', 'ready']);
          out.push({ label: 'Orders to fulfil', value: String(count ?? 0), href: '/(app)/admin/shop', alert: !!count });
        })(),
      );
    }
    if (isAdmin) {
      jobs.push(
        (async () => {
          const { count } = await supabase
            .from('club_members')
            .select('*', { count: 'exact', head: true })
            .eq('club_id', club.id)
            .eq('status', 'pending');
          out.push({ label: 'Pending members', value: String(count ?? 0), href: '/(app)/admin/members', alert: !!count });
        })(),
      );
    }
    await Promise.all(jobs);
    const order = ['Golfers today', 'Bar card sales today', 'Orders to fulfil', 'Pending members'];
    return out.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  }, [club.id]);

  const sections = visibleSections(isAdmin, membership.departments, canManage).filter((s) => s.segment !== '');
  const columns = width >= 1200 ? 4 : width >= 600 ? 2 : 2;

  return (
    <Screen maxWidth={1100} refreshing={stats.loading} onRefresh={stats.reload}>
      <Txt variant="muted">
        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · signed in as {membership.role}
      </Txt>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {stats.loading && !stats.data
          ? Array.from({ length: 4 }, (_, i) => (
              <View key={i} style={{ flexBasis: `${100 / columns - 3}%`, flexGrow: 1 }}>
                <Skeleton height={92} radius={14} />
              </View>
            ))
          : stats.data?.map((s) => (
              <Card
                key={s.label}
                onPress={s.href ? () => router.push(s.href!) : undefined}
                style={{ flexBasis: `${100 / columns - 3}%`, flexGrow: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="label">{s.label}</Txt>
                  {s.alert && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.warning }} />}
                </Row>
                <Txt variant="display">{s.value}</Txt>
              </Card>
            ))}
      </View>

      <SectionHeader title="Manage" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {sections.map((s) => (
          <View key={s.title} style={{ flexBasis: width >= 900 ? '48%' : '100%', flexGrow: 1 }}>
            <ListItem
              icon={s.icon}
              title={s.title}
              subtitle={s.subtitle}
              onPress={() => router.push(s.href)}
              right={
                s.segment === 'members' && stats.data?.find((x) => x.label === 'Pending members' && x.value !== '0') ? (
                  <Badge label="Action needed" tone="warning" />
                ) : undefined
              }
            />
          </View>
        ))}
      </View>
    </Screen>
  );
}
