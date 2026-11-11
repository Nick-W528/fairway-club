import { useState } from 'react';
import { View } from 'react-native';

import { DateStrip, TeeSheet } from '@/components/tee-sheet';
import {
  attempt,
  Button,
  Card,
  Chip,
  ChipScroller,
  Field,
  Loading,
  Row,
  Screen,
  SectionHeader,
  Stack,
  Txt,
} from '@/components/ui';
import { DateField } from '@/components/date-field';
import { hhmm, isoDate, isValidTime } from '@/lib/format';
import { fetchCourses } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import type { TeeBlock } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';

export default function AdminTeeSheet() {
  const { club, canManage } = useCurrentClub();
  const courses = useData(() => fetchCourses(club.id), [club.id]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [date, setDate] = useState(isoDate(new Date()));
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [version, setVersion] = useState(0);

  const course = (courses.data ?? []).find((x) => x.id === courseId) ?? courses.data?.[0];

  const blocks = useData(async () => {
    if (!course) return [];
    return unwrap(
      await supabase.from('tee_sheet_blocks').select('*').eq('course_id', course.id).eq('play_date', date).order('start_time'),
    ) as TeeBlock[];
  }, [course?.id, date, version]);

  if (!canManage('competitions')) return <Screen><Txt>You don't have access to the tee sheet.</Txt></Screen>;
  if (courses.loading && !courses.data) return <Loading />;
  if (!course) return <Screen><Txt>Add a course first.</Txt></Screen>;

  const addBlock = () =>
    attempt(async () => {
      if (!isValidTime(start) || !isValidTime(end)) throw new Error('Choose a start and end time');
      unwrap(
        await supabase.from('tee_sheet_blocks').insert({
          club_id: club.id,
          course_id: course.id,
          play_date: date,
          start_time: start,
          end_time: end,
          reason: reason.trim() || 'Unavailable',
        }),
      );
      setStart('');
      setEnd('');
      setReason('');
      setVersion((v) => v + 1);
    });

  const removeBlock = (id: string) =>
    attempt(async () => {
      unwrap(await supabase.from('tee_sheet_blocks').delete().eq('id', id));
      setVersion((v) => v + 1);
    });

  return (
    <Screen>
      {(courses.data?.length ?? 0) > 1 && (
        <ChipScroller>
          {courses.data!.map((x) => (
            <Chip key={x.id} label={x.name} selected={x.id === course.id} onPress={() => setCourseId(x.id)} />
          ))}
        </ChipScroller>
      )}
      <DateStrip value={date} onChange={setDate} days={60} startOffset={-7} />

      <SectionHeader title="Block out times" />
      <Card>
        <Stack>
          {blocks.data?.map((b) => (
            <Row key={b.id} style={{ justifyContent: 'space-between' }}>
              <Txt>
                {hhmm(b.start_time)}–{hhmm(b.end_time)} · {b.reason}
              </Txt>
              <Button small variant="danger" title="Remove" onPress={() => removeBlock(b.id)} />
            </Row>
          ))}
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <DateField mode="time" label="From" value={start} onChange={setStart} placeholder="Pick a time" />
            </View>
            <View style={{ flex: 1 }}>
              <DateField mode="time" label="Until" value={end} onChange={setEnd} placeholder="Pick a time" />
            </View>
          </Row>
          <Field label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Society booking, maintenance" />
          <Button title="Add block" variant="secondary" icon="ban-outline" onPress={addBlock} />
        </Stack>
      </Card>

      <SectionHeader title="Bookings" />
      <TeeSheet key={`${course.id}-${date}-${version}`} club={club} courseId={course.id} date={date} admin />
    </Screen>
  );
}
