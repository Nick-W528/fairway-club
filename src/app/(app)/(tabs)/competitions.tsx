import { router } from 'expo-router';
import { useState } from 'react';

import { Badge, Card, Chip, EmptyState, ErrorBanner, Loading, Row, Screen, Txt } from '@/components/ui';
import { hhmm, isoDate, money, prettyDate } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { COMP_STATUS_TONE, FORMAT_LABELS, type Competition } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';

export default function Competitions() {
  const { club } = useCurrentClub();
  const [tab, setTab] = useState<'upcoming' | 'results'>('upcoming');
  const today = isoDate(new Date());

  const data = useData(async () => {
    let q = supabase.from('competitions').select('*').eq('club_id', club.id).neq('status', 'draft');
    q =
      tab === 'upcoming'
        ? q.gte('play_date', today).neq('status', 'completed').order('play_date')
        : q.or(`status.eq.completed,play_date.lt.${today}`).order('play_date', { ascending: false }).limit(40);
    return unwrap(await q) as Competition[];
  }, [club.id, tab]);

  return (
    <Screen refreshing={data.loading} onRefresh={data.reload}>
      <Row>
        <Chip label="Upcoming" selected={tab === 'upcoming'} onPress={() => setTab('upcoming')} />
        <Chip label="Results" selected={tab === 'results'} onPress={() => setTab('results')} />
      </Row>
      <ErrorBanner message={data.error} />
      {data.loading && !data.data && <Loading />}
      {data.data?.length === 0 && (
        <EmptyState icon="trophy-outline" title={tab === 'upcoming' ? 'No competitions scheduled' : 'No results yet'} />
      )}
      {data.data?.map((comp) => (
        <Card key={comp.id} onPress={() => router.push(`/(app)/competition/${comp.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="heading" style={{ flex: 1 }}>
              {comp.name}
            </Txt>
            <Badge label={comp.status} tone={COMP_STATUS_TONE[comp.status]} />
          </Row>
          <Txt variant="muted">
            {prettyDate(comp.play_date, { weekday: 'long' })} · {hhmm(comp.first_tee)}–{hhmm(comp.last_tee)}
          </Txt>
          <Txt variant="small">
            {FORMAT_LABELS[comp.format]} · {comp.entry_fee_cents ? money(comp.entry_fee_cents, club.currency) : 'Free entry'}
          </Txt>
        </Card>
      ))}
    </Screen>
  );
}
