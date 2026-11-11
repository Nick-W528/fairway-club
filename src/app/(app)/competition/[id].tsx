import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { TeeSheet } from '@/components/tee-sheet';
import { Badge, Card, Chip, EmptyState, ErrorBanner, Loading, Row, Screen, SectionHeader, Txt } from '@/components/ui';
import { isPointsBased, rankEntries } from '@/lib/competitions';
import { hhmm, money, prettyDate, prettyDateTime } from '@/lib/format';
import { fetchEntries } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import { COMP_STATUS_TONE, FORMAT_LABELS, type Competition } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useAuth } from '@/providers/auth';
import { useCurrentClub } from '@/providers/club';
import { space, useColors } from '@/theme';

export default function CompetitionDetail() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { club } = useCurrentClub();
  const [view, setView] = useState<'tee' | 'entrants'>('tee');

  const data = useData(async () => {
    const [comp, entries] = await Promise.all([
      supabase.from('competitions').select('*, courses(name)').eq('id', id).single(),
      fetchEntries(id),
    ]);
    return {
      comp: unwrap(comp) as Competition & { courses: { name: string } | null },
      entries,
    };
  }, [id]);

  if (data.loading && !data.data) return <Loading />;
  if (data.error || !data.data) return <Screen><ErrorBanner message={data.error ?? 'Not found'} /></Screen>;
  const { comp, entries } = data.data;
  const entered = entries.some((e) => e.user_id === session!.user.id);
  const hasResults = entries.some((e) => e.points != null || e.net_score != null || e.position != null);
  const ranked = rankEntries(comp, entries);
  const pointsBased = isPointsBased(comp);

  return (
    <Screen refreshing={data.loading} onRefresh={data.reload}>
      <Stack.Screen options={{ title: comp.name }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="title" style={{ flex: 1 }}>
            {comp.name}
          </Txt>
          <Badge label={comp.status} tone={COMP_STATUS_TONE[comp.status]} />
        </Row>
        <Txt variant="muted">
          {prettyDate(comp.play_date, { weekday: 'long', month: 'long' })} · {comp.courses?.name}
        </Txt>
        <Row wrap gap={space.lg}>
          <Info label="Format" value={FORMAT_LABELS[comp.format]} />
          <Info label="Tee times" value={`${hhmm(comp.first_tee)}–${hhmm(comp.last_tee)}`} />
          <Info label="Entry" value={comp.entry_fee_cents ? money(comp.entry_fee_cents, club.currency) : 'Free'} />
          <Info label="Allowance" value={`${comp.handicap_allowance}%`} />
          <Info label="Entrants" value={`${entries.length}${comp.max_entries ? ` / ${comp.max_entries}` : ''}`} />
        </Row>
        {comp.eligibility && <Txt variant="small">Eligibility: {comp.eligibility}</Txt>}
        {comp.entries_close_at && <Txt variant="small">Entries close {prettyDateTime(comp.entries_close_at)}</Txt>}
        {comp.description && <Txt>{comp.description}</Txt>}
        {entered && <Badge label="You're entered" tone="success" />}
      </Card>

      {hasResults ? (
        <>
          <SectionHeader title="Results" />
          <Card>
            {ranked.map((e, i) => (
              <Row key={e.user_id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderColor: c.border }}>
                <Txt variant="heading" style={{ width: 32 }}>
                  {e.position ?? i + 1}
                </Txt>
                <Txt style={{ flex: 1 }}>{e.profiles?.full_name}</Txt>
                <Txt style={{ fontWeight: '700' }}>
                  {pointsBased ? `${e.points ?? '–'} pts` : `${e.net_score ?? '–'} net`}
                </Txt>
              </Row>
            ))}
          </Card>
        </>
      ) : (
        <>
          <Row>
            <Chip label="Tee sheet" selected={view === 'tee'} onPress={() => setView('tee')} />
            <Chip label={`Entrants (${entries.length})`} selected={view === 'entrants'} onPress={() => setView('entrants')} />
          </Row>
          {view === 'tee' ? (
            comp.status === 'open' ? (
              <TeeSheet club={club} courseId={comp.course_id} date={comp.play_date} competition={comp} />
            ) : (
              <Txt variant="muted">Entries are {comp.status}.</Txt>
            )
          ) : entries.length === 0 ? (
            <EmptyState icon="people-outline" title="No entrants yet" />
          ) : (
            <Card>
              {entries.map((e) => (
                <Row key={e.user_id} style={{ justifyContent: 'space-between' }}>
                  <Txt>{e.profiles?.full_name}</Txt>
                  <Txt variant="small">HCP {e.profiles?.handicap_index ?? '–'}</Txt>
                </Row>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Txt variant="label">{label}</Txt>
      <Txt style={{ fontWeight: '600' }}>{value}</Txt>
    </View>
  );
}
