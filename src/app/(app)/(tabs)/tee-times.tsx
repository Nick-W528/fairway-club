import { router } from 'expo-router';
import { useState } from 'react';

import { DateStrip, TeeSheet } from '@/components/tee-sheet';
import { Button, Chip, ChipScroller, Loading, Row, Screen, Toggle, Txt } from '@/components/ui';
import { addDays, hhmm, isoDate, teeSlots } from '@/lib/format';
import { fetchCourses } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';
import { space, useColors } from '@/theme';

export default function TeeTimes() {
  const c = useColors();
  const { club } = useCurrentClub();
  const courses = useData(() => fetchCourses(club.id), [club.id]);
  const [date, setDate] = useState(isoDate(new Date()));
  const [courseId, setCourseId] = useState<string | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const list = courses.data ?? [];
  const selected = list.find((x) => x.id === courseId) ?? list[0];

  // How full each day is, for the dots on the date strip.
  const busy = useData(async () => {
    if (!selected) return {};
    const { data } = await supabase
      .from('tee_bookings')
      .select('play_date, tee_booking_players(count)')
      .eq('course_id', selected.id)
      .gte('play_date', isoDate(new Date()))
      .lte('play_date', isoDate(addDays(new Date(), club.booking_window_days)));
    const capacity = teeSlots(hhmm(club.first_tee), hhmm(club.last_tee), club.tee_interval_minutes).length * club.max_players_per_tee;
    const totals: Record<string, number> = {};
    for (const row of (data ?? []) as { play_date: string; tee_booking_players: { count: number }[] }[]) {
      totals[row.play_date] = (totals[row.play_date] ?? 0) + (row.tee_booking_players[0]?.count ?? 0);
    }
    return Object.fromEntries(Object.entries(totals).map(([d, n]) => [d, capacity ? n / capacity : 0]));
  }, [selected?.id]);

  if (courses.loading && !courses.data) return <Loading hero={false} rows={6} />;

  return (
    <Screen>
      {list.length > 1 && (
        <ChipScroller>
          {list.map((course) => (
            <Chip key={course.id} label={course.name} selected={course.id === selected?.id} onPress={() => setCourseId(course.id)} />
          ))}
        </ChipScroller>
      )}
      <DateStrip value={date} onChange={setDate} days={club.booking_window_days + 1} busy={busy.data} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={space.md}>
          {[
            { label: 'Quiet', color: c.success },
            { label: 'Busy', color: c.warning },
            { label: 'Nearly full', color: c.danger },
          ].map((l) => (
            <Row key={l.label} gap={4}>
              <Txt variant="small" color={l.color}>
                ●
              </Txt>
              <Txt variant="small">{l.label}</Txt>
            </Row>
          ))}
        </Row>
        <Button small variant="ghost" icon="calendar-outline" title="My bookings" onPress={() => router.push('/(app)/my-bookings')} />
      </Row>
      <Toggle label="Only show available times" value={onlyAvailable} onValueChange={setOnlyAvailable} />
      {selected?.status === 'closed' && <Txt variant="muted">The course is currently closed: {selected.status_note}</Txt>}
      {selected ? (
        <TeeSheet key={`${selected.id}-${date}`} club={club} courseId={selected.id} date={date} onlyAvailable={onlyAvailable} />
      ) : (
        <Txt variant="muted">No courses set up yet.</Txt>
      )}
    </Screen>
  );
}
