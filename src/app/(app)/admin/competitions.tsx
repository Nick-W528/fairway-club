import { router } from 'expo-router';
import { useState } from 'react';

import { Badge, Button, Card, Chip, EmptyState, ErrorBanner, Loading, Row, Screen, Txt } from '@/components/ui';
import { hhmm, isoDate, prettyDate } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { COMP_STATUS_TONE, FORMAT_LABELS, type Competition } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';

export default function AdminCompetitions() {
  const { club, canManage } = useCurrentClub();
  const [past, setPast] = useState(false);
  const today = isoDate(new Date());

  const data = useData(async () => {
    const q = supabase.from('competitions').select('*').eq('club_id', club.id);
    const res = past
      ? await q.lt('play_date', today).order('play_date', { ascending: false }).limit(50)
      : await q.gte('play_date', today).order('play_date');
    return unwrap(res) as Competition[];
  }, [club.id, past]);

  if (!canManage('competitions')) return <Screen><Txt>You don't have access to competitions.</Txt></Screen>;

  return (
    <Screen refreshing={data.loading} onRefresh={data.reload}>
      <Button title="New competition" icon="add" onPress={() => router.push('/(app)/admin/competition/new')} />
      <Row>
        <Chip label="Upcoming" selected={!past} onPress={() => setPast(false)} />
        <Chip label="Past" selected={past} onPress={() => setPast(true)} />
      </Row>
      <ErrorBanner message={data.error} />
      {data.loading && !data.data && <Loading />}
      {data.data?.length === 0 && <EmptyState icon="trophy-outline" title="No competitions" />}
      {data.data?.map((comp) => (
        <Card key={comp.id} onPress={() => router.push(`/(app)/admin/competition/${comp.id}`)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="heading" style={{ flex: 1 }}>{comp.name}</Txt>
            <Badge label={comp.status} tone={COMP_STATUS_TONE[comp.status]} />
          </Row>
          <Txt variant="muted">
            {prettyDate(comp.play_date)} · {hhmm(comp.first_tee)}–{hhmm(comp.last_tee)} · {FORMAT_LABELS[comp.format]}
          </Txt>
        </Card>
      ))}
    </Screen>
  );
}
