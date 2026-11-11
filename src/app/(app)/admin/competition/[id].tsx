import { router, Stack as RouterStack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import {
  attempt,
  Button,
  Card,
  Chip,
  confirm,
  ErrorBanner,
  Field,
  Loading,
  notify,
  Row,
  Screen,
  SectionHeader,
  Stack,
  Txt,
} from '@/components/ui';
import { DateField } from '@/components/date-field';
import { isPointsBased, rankEntries } from '@/lib/competitions';
import { addDays, hhmm, isoDate, isValidDate, isValidTime, money, parseMoney } from '@/lib/format';
import { fetchCourses, fetchEntries } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import {
  FORMAT_LABELS,
  type Competition,
  type CompetitionEntry,
  type CompetitionFormat,
  type CompetitionStatus,
  type Course,
} from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';
import { space } from '@/theme';

const STATUSES: { key: CompetitionStatus; label: string }[] = [
  { key: 'draft', label: 'Draft (hidden)' },
  { key: 'open', label: 'Entries open' },
  { key: 'closed', label: 'Entries closed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function EditCompetition() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { club, canManage } = useCurrentClub();

  const data = useData(async () => {
    const courses = await fetchCourses(club.id);
    if (isNew) return { courses, comp: null, entries: [] as CompetitionEntry[] };
    const [comp, entries] = await Promise.all([
      supabase.from('competitions').select('*').eq('id', id).single(),
      fetchEntries(id),
    ]);
    return { courses, comp: unwrap(comp) as Competition, entries };
  }, [id]);

  if (!canManage('competitions')) return <Screen><Txt>You don't have access to competitions.</Txt></Screen>;
  if (data.loading && !data.data) return <Loading />;
  if (!data.data) return <Screen><ErrorBanner message={data.error ?? 'Not found'} /></Screen>;
  return <CompetitionEditor key={data.data.comp?.id ?? 'new'} id={id} data={data.data} reload={data.reload} />;
}

type EditorData = { courses: Course[]; comp: Competition | null; entries: CompetitionEntry[] };

function initialForm(d: EditorData) {
  const comp = d.comp;
  return {
    name: comp?.name ?? '',
    description: comp?.description ?? '',
    course_id: comp?.course_id ?? d.courses[0]?.id ?? '',
    format: (comp?.format ?? 'stableford') as CompetitionFormat,
    play_date: comp?.play_date ?? isoDate(addDays(new Date(), 7)),
    first_tee: comp ? hhmm(comp.first_tee) : '08:00',
    last_tee: comp ? hhmm(comp.last_tee) : '11:00',
    fee: comp?.entry_fee_cents ? (comp.entry_fee_cents / 100).toFixed(2) : '',
    max_entries: comp?.max_entries?.toString() ?? '',
    handicap_allowance: comp?.handicap_allowance.toString() ?? '95',
    eligibility: comp?.eligibility ?? '',
    entries_close: comp?.entries_close_at ? toLocalInput(comp.entries_close_at) : '',
    status: (comp?.status ?? 'draft') as CompetitionStatus,
  };
}

function CompetitionEditor({ id, data, reload }: { id: string; data: EditorData; reload: () => Promise<void> }) {
  const isNew = id === 'new';
  const { club } = useCurrentClub();
  const [form, setForm] = useState(() => initialForm(data));
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const [busy, setBusy] = useState(false);

  const save = () =>
    attempt(async () => {
      if (!form.name.trim()) throw new Error('Enter a competition name');
      if (!isValidDate(form.play_date)) throw new Error('Choose a date');
      if (!isValidTime(form.first_tee) || !isValidTime(form.last_tee)) throw new Error('Choose the first and last tee times');
      if (form.entries_close && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(form.entries_close)) {
        throw new Error('Choose when entries close');
      }
      const fee = form.fee.trim() ? parseMoney(form.fee) : 0;
      if (fee == null) throw new Error('Invalid entry fee');
      const payload = {
        club_id: club.id,
        course_id: form.course_id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        format: form.format,
        play_date: form.play_date,
        first_tee: form.first_tee,
        last_tee: form.last_tee,
        entry_fee_cents: fee,
        max_entries: form.max_entries.trim() ? Number(form.max_entries) : null,
        handicap_allowance: Number(form.handicap_allowance) || 100,
        eligibility: form.eligibility.trim() || null,
        entries_close_at: form.entries_close ? new Date(form.entries_close.replace(' ', 'T')).toISOString() : null,
        status: form.status,
      };
      setBusy(true);
      try {
        if (isNew) {
          const created = unwrap(await supabase.from('competitions').insert(payload).select('id').single()) as { id: string };
          router.replace(`/(app)/admin/competition/${created.id}`);
        } else {
          unwrap(await supabase.from('competitions').update(payload).eq('id', id));
          await reload();
          notify('Competition saved');
        }
      } finally {
        setBusy(false);
      }
    });

  const remove = async () => {
    if (!(await confirm('Delete competition?', 'All entries and bookings for it will be removed. Fees are NOT refunded automatically — consider cancelling instead.', 'Delete'))) return;
    await attempt(async () => {
      unwrap(await supabase.from('competitions').delete().eq('id', id));
      router.back();
    });
  };

  const comp = data.comp;

  return (
    <Screen onRefresh={reload}>
      <RouterStack.Screen options={{ title: isNew ? 'New competition' : form.name || 'Competition' }} />
      <Card>
        <Stack>
          <Field label="Name" value={form.name} onChangeText={(name) => set({ name })} placeholder="e.g. Monthly Medal" />
          <Field label="Description" value={form.description} onChangeText={(description) => set({ description })} multiline />
          {data.courses.length > 1 && (
            <>
              <Txt variant="label">Course</Txt>
              <Row wrap>
                {data.courses.map((c) => (
                  <Chip key={c.id} label={c.name} selected={form.course_id === c.id} onPress={() => set({ course_id: c.id })} />
                ))}
              </Row>
            </>
          )}
          <Txt variant="label">Format</Txt>
          <Row wrap>
            {(Object.keys(FORMAT_LABELS) as CompetitionFormat[]).map((f) => (
              <Chip key={f} label={FORMAT_LABELS[f]} selected={form.format === f} onPress={() => set({ format: f })} />
            ))}
          </Row>
          <DateField mode="date" label="Date" value={form.play_date} onChange={(play_date) => set({ play_date })} />
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <DateField mode="time" label="First tee" value={form.first_tee} onChange={(first_tee) => set({ first_tee })} />
            </View>
            <View style={{ flex: 1 }}>
              <DateField mode="time" label="Last tee" value={form.last_tee} onChange={(last_tee) => set({ last_tee })} />
            </View>
          </Row>
          <Txt variant="small">General play can't be booked between these times on the competition day once it's open.</Txt>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field label="Entry fee" value={form.fee} onChangeText={(fee) => set({ fee })} keyboardType="decimal-pad" placeholder="0.00" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Max entries" value={form.max_entries} onChangeText={(max_entries) => set({ max_entries })} keyboardType="number-pad" placeholder="No limit" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Allowance %" value={form.handicap_allowance} onChangeText={(handicap_allowance) => set({ handicap_allowance })} keyboardType="number-pad" />
            </View>
          </Row>
          <Field label="Eligibility" value={form.eligibility} onChangeText={(eligibility) => set({ eligibility })} placeholder="e.g. Men, handicap 0–28" />
          <DateField mode="datetime" label="Entries close (optional)" value={form.entries_close} onChange={(entries_close) => set({ entries_close })} clearable />
          <Txt variant="label">Status</Txt>
          <Row wrap>
            {STATUSES.map((s) => (
              <Chip key={s.key} label={s.label} selected={form.status === s.key} onPress={() => set({ status: s.key })} />
            ))}
          </Row>
          <Button title={isNew ? 'Create competition' : 'Save changes'} onPress={save} loading={busy} />
          {!isNew && <Button title="Delete competition" variant="danger" onPress={remove} />}
        </Stack>
      </Card>

      {comp && (
        <>
          <SectionHeader title={`Entries & results (${data.entries.length})`} />
          <Txt variant="small">
            Entry fees collected: {money(data.entries.reduce((s, e) => s + e.fee_paid_cents, 0), club.currency)}
          </Txt>
          {rankEntries(comp, data.entries).map((e) => (
            <ResultRow key={e.user_id} comp={comp} entry={e} onSaved={reload} />
          ))}
        </>
      )}
    </Screen>
  );
}

function ResultRow({ comp, entry, onSaved }: { comp: Competition; entry: CompetitionEntry; onSaved: () => Promise<void> }) {
  const points = isPointsBased(comp);
  const [score, setScore] = useState(String((points ? entry.points : entry.net_score) ?? ''));
  const [gross, setGross] = useState(String(entry.gross_score ?? ''));
  const [pos, setPos] = useState(String(entry.position ?? ''));
  const [busy, setBusy] = useState(false);
  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  const save = () =>
    attempt(async () => {
      setBusy(true);
      try {
        unwrap(
          await supabase
            .from('competition_entries')
            .update({
              [points ? 'points' : 'net_score']: num(score),
              gross_score: num(gross),
              position: num(pos),
            })
            .eq('competition_id', comp.id)
            .eq('user_id', entry.user_id),
        );
        await onSaved();
      } finally {
        setBusy(false);
      }
    });

  const withdraw = async () => {
    if (!entry.booking_id) return;
    if (!(await confirm('Withdraw group?', 'This cancels the whole tee booking and refunds the fees to whoever paid.', 'Withdraw'))) return;
    await attempt(async () => {
      unwrap(await supabase.rpc('cancel_tee_booking', { p_booking: entry.booking_id }));
      await onSaved();
    });
  };

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="heading">{entry.profiles?.full_name}</Txt>
        <Txt variant="small">HCP {entry.profiles?.handicap_index ?? '–'}</Txt>
      </Row>
      <Row style={{ alignItems: 'flex-end', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Field label={points ? 'Points' : 'Net'} value={score} onChangeText={setScore} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Gross" value={gross} onChangeText={setGross} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Pos" value={pos} onChangeText={setPos} keyboardType="number-pad" />
        </View>
        <Button small title="Save" onPress={save} loading={busy} />
      </Row>
      {entry.booking_id && <Button small variant="ghost" title="Withdraw group" onPress={withdraw} />}
    </Card>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  return `${isoDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
