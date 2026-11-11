import { useState } from 'react';
import { View } from 'react-native';

import {
  attempt,
  Button,
  Card,
  Chip,
  ChipScroller,
  ErrorBanner,
  Field,
  Loading,
  notify,
  Row,
  Screen,
  SectionHeader,
  Stack,
  Toggle,
  Txt,
} from '@/components/ui';
import { fetchCourses } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import type { Course, CourseStatus, Hole } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';
import { space } from '@/theme';

type HoleDraft = { number: number; par: string; stroke_index: string; yards_white: string; yards_yellow: string; yards_red: string };

export default function AdminCourse() {
  const { club, canManage } = useCurrentClub();
  const [courseId, setCourseId] = useState<string | null>(null);

  const data = useData(async () => {
    const courses = await fetchCourses(club.id);
    const holes = courses.length
      ? (unwrap(await supabase.from('holes').select('*').in('course_id', courses.map((c) => c.id)).order('number')) as Hole[])
      : [];
    return { courses, holes };
  }, [club.id]);

  if (!canManage('greenkeeping')) return <Screen><Txt>You don't have access to course management.</Txt></Screen>;
  if (data.loading && !data.data) return <Loading />;

  const courses = data.data?.courses ?? [];
  const course = courses.find((c) => c.id === courseId) ?? courses[0];

  const addCourse = () =>
    attempt(async () => {
      const created = unwrap(
        await supabase.from('courses').insert({ club_id: club.id, name: `Course ${courses.length + 1}`, sort_order: courses.length }).select('id').single(),
      ) as { id: string };
      await data.reload();
      setCourseId(created.id);
    });

  return (
    <Screen refreshing={data.loading} onRefresh={data.reload}>
      <ErrorBanner message={data.error} />
      <ChipScroller>
        {courses.map((c) => (
          <Chip key={c.id} label={c.name} selected={c.id === course?.id} onPress={() => setCourseId(c.id)} />
        ))}
        <Chip label="Add course" icon="add" onPress={addCourse} />
      </ChipScroller>
      {course && (
        <CourseEditor
          key={course.id}
          course={course}
          holes={(data.data?.holes ?? []).filter((h) => h.course_id === course.id)}
          onSaved={data.reload}
        />
      )}
    </Screen>
  );
}

function CourseEditor({ course, holes, onSaved }: { course: Course; holes: Hole[]; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState<CourseStatus>(course.status);
  const [note, setNote] = useState(course.status_note ?? '');
  const [buggies, setBuggies] = useState(course.buggies_allowed);
  const [trolleys, setTrolleys] = useState(course.trolleys_allowed);
  const [details, setDetails] = useState({
    name: course.name,
    description: course.description ?? '',
    par: course.par?.toString() ?? '',
    yardage: course.yardage?.toString() ?? '',
    course_rating: course.course_rating?.toString() ?? '',
    slope_rating: course.slope_rating?.toString() ?? '',
  });
  const [busy, setBusy] = useState<string | null>(null);

  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  const run = (key: string, fn: () => Promise<void>) =>
    attempt(async () => {
      setBusy(key);
      try {
        await fn();
        await onSaved();
        notify('Saved');
      } finally {
        setBusy(null);
      }
    });

  const saveStatus = () =>
    run('status', async () => {
      unwrap(
        await supabase
          .from('courses')
          .update({
            status,
            status_note: note.trim() || null,
            buggies_allowed: buggies,
            trolleys_allowed: trolleys,
            status_updated_at: new Date().toISOString(),
          })
          .eq('id', course.id),
      );
    });

  const saveDetails = () =>
    run('details', async () => {
      unwrap(
        await supabase
          .from('courses')
          .update({
            name: details.name.trim() || course.name,
            description: details.description.trim() || null,
            par: num(details.par),
            yardage: num(details.yardage),
            course_rating: num(details.course_rating),
            slope_rating: num(details.slope_rating),
          })
          .eq('id', course.id),
      );
    });

  return (
    <>
      <SectionHeader title="Course status" />
      <Card>
        <Stack>
          <Row>
            {(['open', 'restricted', 'closed'] as const).map((s) => (
              <Chip key={s} label={s} selected={status === s} onPress={() => setStatus(s)} />
            ))}
          </Row>
          <Field label="Message to members" value={note} onChangeText={setNote} multiline placeholder="e.g. Temporary greens on 4 and 12, winter mats in use" />
          <Toggle label="Buggies allowed" value={buggies} onValueChange={setBuggies} />
          <Toggle label="Trolleys allowed" value={trolleys} onValueChange={setTrolleys} />
          <Button title="Update status" onPress={saveStatus} loading={busy === 'status'} />
        </Stack>
      </Card>

      <SectionHeader title="Course details" />
      <Card>
        <Stack>
          <Field label="Name" value={details.name} onChangeText={(name) => setDetails((d) => ({ ...d, name }))} />
          <Field label="Description" value={details.description} onChangeText={(description) => setDetails((d) => ({ ...d, description }))} multiline />
          <Row style={{ alignItems: 'flex-start' }}>
            {(['par', 'yardage', 'course_rating', 'slope_rating'] as const).map((k) => (
              <View key={k} style={{ flex: 1 }}>
                <Field
                  label={{ par: 'Par', yardage: 'Yards', course_rating: 'Rating', slope_rating: 'Slope' }[k]}
                  value={details[k]}
                  onChangeText={(v) => setDetails((d) => ({ ...d, [k]: v }))}
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </Row>
          <Button title="Save details" variant="secondary" onPress={saveDetails} loading={busy === 'details'} />
        </Stack>
      </Card>

      <SectionHeader title="Scorecard" />
      <HolesEditor key={JSON.stringify(holes)} courseId={course.id} holes={holes} onSaved={onSaved} />
    </>
  );
}

function HolesEditor({ courseId, holes, onSaved }: { courseId: string; holes: Hole[]; onSaved: () => Promise<void> }) {
  const [drafts, setDrafts] = useState<HoleDraft[]>(() =>
    holes.map((h) => ({
      number: h.number,
      par: String(h.par),
      stroke_index: h.stroke_index?.toString() ?? '',
      yards_white: h.yards_white?.toString() ?? '',
      yards_yellow: h.yards_yellow?.toString() ?? '',
      yards_red: h.yards_red?.toString() ?? '',
    })),
  );
  const [busy, setBusy] = useState(false);
  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  const saveHoles = () =>
    attempt(async () => {
      setBusy(true);
      try {
      const rows = drafts.map((d) => ({
        course_id: courseId,
        number: d.number,
        par: Number(d.par) || 4,
        stroke_index: num(d.stroke_index),
        yards_white: num(d.yards_white),
        yards_yellow: num(d.yards_yellow),
        yards_red: num(d.yards_red),
      }));
      unwrap(await supabase.from('holes').upsert(rows, { onConflict: 'course_id,number' }));
        await onSaved();
        notify('Scorecard saved');
      } finally {
        setBusy(false);
      }
    });

  const setHole = (i: number, patch: Partial<HoleDraft>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const generate = (n: 9 | 18) =>
    setDrafts(
      Array.from({ length: n }, (_, i) => ({
        number: i + 1,
        par: '4',
        stroke_index: String(i + 1),
        yards_white: '',
        yards_yellow: '',
        yards_red: '',
      })),
    );


  return (
    <>
      {drafts.length === 0 ? (
        <Card>
          <Txt variant="muted">No holes set up yet.</Txt>
          <Row>
            <Button small title="Create 18 holes" onPress={() => generate(18)} />
            <Button small variant="secondary" title="Create 9 holes" onPress={() => generate(9)} />
          </Row>
        </Card>
      ) : (
        <Card>
          <Row gap={space.xs}>
            {['#', 'Par', 'SI', 'White', 'Yellow', 'Red'].map((h) => (
              <Txt key={h} variant="label" style={{ flex: 1 }}>
                {h}
              </Txt>
            ))}
          </Row>
          {drafts.map((d, i) => (
            <Row key={d.number} gap={space.xs}>
              <Txt style={{ flex: 1, fontWeight: '700' }}>{d.number}</Txt>
              {(['par', 'stroke_index', 'yards_white', 'yards_yellow', 'yards_red'] as const).map((k) => (
                <View key={k} style={{ flex: 1 }}>
                  <Field value={d[k]} onChangeText={(v) => setHole(i, { [k]: v })} keyboardType="number-pad" style={{ paddingHorizontal: 6, paddingVertical: 6 }} />
                </View>
              ))}
            </Row>
          ))}
          <Button title="Save scorecard" onPress={saveHoles} loading={busy} />
        </Card>
      )}
    </>
  );
}
