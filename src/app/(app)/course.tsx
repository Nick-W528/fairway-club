import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Badge, Card, Chip, ChipScroller, ErrorBanner, Loading, Row, Screen, Txt } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { fetchCourses } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import type { Hole } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';
import { space, useColors } from '@/theme';

const TONE = { open: 'success', restricted: 'warning', closed: 'danger' } as const;

export default function CourseInfo() {
  const c = useColors();
  const { club } = useCurrentClub();
  const [courseId, setCourseId] = useState<string | null>(null);

  const data = useData(async () => {
    const courses = await fetchCourses(club.id);
    const holes = courses.length
      ? (unwrap(
          await supabase
            .from('holes')
            .select('*')
            .in(
              'course_id',
              courses.map((x) => x.id),
            )
            .order('number'),
        ) as Hole[])
      : [];
    return { courses, holes };
  }, [club.id]);

  if (data.loading && !data.data) return <Loading />;
  const courses = data.data?.courses ?? [];
  const course = courses.find((x) => x.id === courseId) ?? courses[0];
  if (!course) return <Screen><Txt variant="muted">No course information yet.</Txt></Screen>;
  const holes = (data.data?.holes ?? []).filter((h) => h.course_id === course.id);
  const sum = (hs: Hole[], k: 'par' | 'yards_white' | 'yards_yellow' | 'yards_red') =>
    hs.reduce((s, h) => s + (h[k] ?? 0), 0);
  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number > 9);

  const cell = { width: 56, paddingVertical: 6, textAlign: 'center' as const };

  return (
    <Screen refreshing={data.loading} onRefresh={data.reload}>
      <ErrorBanner message={data.error} />
      {courses.length > 1 && (
        <ChipScroller>
          {courses.map((x) => (
            <Chip key={x.id} label={x.name} selected={x.id === course.id} onPress={() => setCourseId(x.id)} />
          ))}
        </ChipScroller>
      )}
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="title" style={{ flex: 1 }}>{course.name}</Txt>
          <Badge label={course.status} tone={TONE[course.status]} />
        </Row>
        {course.status_note && <Txt>{course.status_note}</Txt>}
        <Row wrap gap={space.sm}>
          <Badge label={course.buggies_allowed ? 'Buggies allowed' : 'No buggies'} tone={course.buggies_allowed ? 'success' : 'danger'} />
          <Badge label={course.trolleys_allowed ? 'Trolleys allowed' : 'No trolleys'} tone={course.trolleys_allowed ? 'success' : 'danger'} />
        </Row>
        <Txt variant="small">Status updated {timeAgo(course.status_updated_at)}</Txt>
      </Card>
      <Card>
        <Row wrap gap={space.xl}>
          {course.par != null && <Stat label="Par" value={course.par} />}
          {course.yardage != null && <Stat label="Yards" value={course.yardage} />}
          {course.course_rating != null && <Stat label="Rating" value={course.course_rating} />}
          {course.slope_rating != null && <Stat label="Slope" value={course.slope_rating} />}
        </Row>
        {course.description && <Txt>{course.description}</Txt>}
      </Card>

      {holes.length > 0 && (
        <Card style={{ paddingHorizontal: 0 }}>
          <Txt variant="heading" style={{ paddingHorizontal: space.lg }}>Scorecard</Txt>
          <ScrollView horizontal>
            <View>
              <Row gap={0} style={{ backgroundColor: c.surfaceAlt }}>
                {['Hole', 'Par', 'SI', 'White', 'Yellow', 'Red'].map((h) => (
                  <Txt key={h} variant="label" style={cell}>{h}</Txt>
                ))}
              </Row>
              {[...front, ...(front.length ? [null] : []), ...back, ...(back.length ? ['back' as const] : [])].map((h, i) => {
                if (h === null || h === 'back') {
                  const part = h === null ? front : back;
                  return (
                    <Row key={`t${i}`} gap={0} style={{ backgroundColor: c.primarySoft }}>
                      <Txt style={[cell, { fontWeight: '700' }]}>{h === null ? 'Out' : 'In'}</Txt>
                      <Txt style={[cell, { fontWeight: '700' }]}>{sum(part, 'par')}</Txt>
                      <Txt style={cell}> </Txt>
                      <Txt style={cell}>{sum(part, 'yards_white')}</Txt>
                      <Txt style={cell}>{sum(part, 'yards_yellow')}</Txt>
                      <Txt style={cell}>{sum(part, 'yards_red')}</Txt>
                    </Row>
                  );
                }
                return (
                  <Row key={h.id} gap={0} style={{ borderBottomWidth: 1, borderColor: c.border }}>
                    <Txt style={[cell, { fontWeight: '700' }]}>{h.number}</Txt>
                    <Txt style={cell}>{h.par}</Txt>
                    <Txt style={cell}>{h.stroke_index ?? ''}</Txt>
                    <Txt style={cell}>{h.yards_white ?? ''}</Txt>
                    <Txt style={cell}>{h.yards_yellow ?? ''}</Txt>
                    <Txt style={cell}>{h.yards_red ?? ''}</Txt>
                  </Row>
                );
              })}
            </View>
          </ScrollView>
        </Card>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <View>
      <Txt variant="label">{label}</Txt>
      <Txt variant="title">{value}</Txt>
    </View>
  );
}
