import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BookingModal, type BookingTarget } from '@/components/booking-modal';
import { attempt, Avatar, Badge, confirm, EmptySeat, EmptyState, ErrorBanner, Row, Skeleton, Txt } from '@/components/ui';
import { haptic, toast } from '@/lib/feedback';
import { addDays, hhmm, isoDate, teeSlots, toMinutes } from '@/lib/format';
import { fetchTeeSheet } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import type { Club, Competition, TeeBooking } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useAuth } from '@/providers/auth';
import { fonts, radius, space, useColors } from '@/theme';

/** Day picker. `busy` maps YYYY-MM-DD → 0..1 fullness and shows a coloured dot. */
export function DateStrip({
  value,
  onChange,
  days,
  startOffset = 0,
  busy,
}: {
  value: string;
  onChange: (d: string) => void;
  days: number;
  startOffset?: number;
  busy?: Record<string, number>;
}) {
  const c = useColors();
  const today = isoDate(new Date());
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {Array.from({ length: days }, (_, i) => addDays(new Date(), i + startOffset)).map((d) => {
        const key = isoDate(d);
        const on = key === value;
        const fill = busy?.[key];
        const dot = fill == null ? null : fill >= 0.85 ? c.danger : fill >= 0.5 ? c.warning : c.success;
        return (
          <Pressable
            key={key}
            onPress={() => {
              haptic.tap();
              onChange(key);
            }}
            style={{
              width: 54,
              paddingVertical: space.sm,
              borderRadius: radius.md,
              alignItems: 'center',
              gap: 2,
              backgroundColor: on ? c.primary : c.surface,
              borderWidth: 1,
              borderColor: on ? c.primary : c.border,
            }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: on ? c.primaryText : c.textMuted, textTransform: 'uppercase' }}>
              {key === today ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' })}
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 26, color: on ? c.primaryText : c.text }}>{d.getDate()}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot ?? 'transparent' }} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const PERIODS = [
  { label: 'Morning', until: 12 * 60 },
  { label: 'Afternoon', until: 17 * 60 },
  { label: 'Evening', until: 24 * 60 },
];

/**
 * The tee sheet for one course/day.
 * - Member mode: tap a free slot to book (general play, or a competition entry if `competition` is set).
 * - Admin mode: shows every booking with a cancel control.
 */
export function TeeSheet({
  club,
  courseId,
  date,
  competition,
  admin,
  onlyAvailable,
}: {
  club: Club;
  courseId: string;
  date: string;
  competition?: Competition | null;
  admin?: boolean;
  onlyAvailable?: boolean;
}) {
  const c = useColors();
  const { session } = useAuth();
  const me = session!.user.id;
  const sheet = useData(() => fetchTeeSheet(courseId, date), [courseId, date]);
  const [target, setTarget] = useState<BookingTarget | null>(null);

  if (sheet.loading && !sheet.data) {
    return (
      <View style={{ gap: space.sm }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={60} radius={radius.md} />
        ))}
      </View>
    );
  }
  if (sheet.error) return <ErrorBanner message={sheet.error} />;
  const { bookings, blocks, competitions } = sheet.data!;

  const first = competition ? competition.first_tee : club.first_tee;
  const last = competition ? competition.last_tee : club.last_tee;
  const now = new Date();
  const isToday = date === isoDate(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const cancel = async (b: TeeBooking) => {
    const ok = await confirm(
      'Cancel booking?',
      b.competition_id ? 'The entry will be withdrawn and any fees refunded to the bar card.' : 'This tee time will be released.',
      'Cancel booking',
    );
    if (!ok) return;
    await attempt(async () => {
      unwrap(await supabase.rpc('cancel_tee_booking', { p_booking: b.id }));
      toast('Booking cancelled');
      await sheet.reload();
    });
  };

  const rows = teeSlots(hhmm(first), hhmm(last), club.tee_interval_minutes).map((time) => {
    const m = toMinutes(time);
    const slotBookings = bookings.filter((b) => hhmm(b.tee_time) === time);
    const players = slotBookings.flatMap((b) => b.tee_booking_players.map((p) => ({ ...p, booking: b })));
    const block = blocks.find((b) => m >= toMinutes(b.start_time) && m < toMinutes(b.end_time));
    const comp = competitions.find((x) => m >= toMinutes(x.first_tee) && m <= toMinutes(x.last_tee));
    const reservedFor = !competition && comp ? comp : null;
    const spaces = club.max_players_per_tee - players.length;
    const past = isToday && m <= nowMins;
    const bookable = !admin && !block && !reservedFor && !past && spaces > 0;
    const mine = players.some((p) => p.user_id === me);
    return { time, m, slotBookings, players, block, reservedFor, spaces, past, bookable, mine };
  });

  const visible = rows.filter((r) => (onlyAvailable ? r.bookable || r.mine : !r.past || admin || r.players.length));
  if (!visible.length) {
    return <EmptyState icon="time-outline" title="No tee times available" message="Try another day." />;
  }

  return (
    <View style={{ gap: space.sm }}>
      {PERIODS.map((period, pi) => {
        const from = pi === 0 ? 0 : PERIODS[pi - 1].until;
        const inPeriod = visible.filter((r) => r.m >= from && r.m < period.until);
        if (!inPeriod.length) return null;
        return (
          <View key={period.label} style={{ gap: space.sm }}>
            <Txt variant="label" style={{ marginTop: space.sm }}>
              {period.label}
            </Txt>
            {inPeriod.map((r) => {
              const dim = !!(r.block || r.reservedFor || r.past) && !r.mine;
              const seats = Array.from({ length: club.max_players_per_tee }, (_, i) => r.players[i] ?? null);
              return (
                <Pressable
                  key={r.time}
                  disabled={!r.bookable}
                  onPress={() => {
                    haptic.tap();
                    setTarget({ courseId, date, time: r.time, spaces: r.spaces, competition: competition ?? null });
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingHorizontal: space.md,
                    paddingVertical: space.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: r.mine ? c.hero : c.border,
                    backgroundColor: r.mine ? c.hero : dim ? c.surfaceAlt : c.surface,
                    opacity: pressed ? 0.85 : dim ? 0.75 : 1,
                  })}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 24, width: 62, color: r.mine ? c.heroText : c.text }}>{r.time}</Text>
                  <View style={{ flex: 1, gap: 4 }}>
                    {r.block ? (
                      <Badge label={r.block.reason} tone="danger" />
                    ) : r.reservedFor ? (
                      <Badge label={r.reservedFor.name} tone="primary" />
                    ) : (
                      <Row gap={6}>
                        {seats.map((p, i) =>
                          p ? (
                            <Avatar key={p.id} name={p.guest_name ?? p.profiles?.full_name} size={28} />
                          ) : (
                            <EmptySeat key={`e${i}`} size={28} />
                          ),
                        )}
                      </Row>
                    )}
                    {r.mine && !admin && (
                      <Txt variant="small" color={c.accent} style={{ fontFamily: fonts.semibold }}>
                        Your booking
                      </Txt>
                    )}
                    {admin &&
                      r.players.length > 0 && (
                        <Txt variant="small" numberOfLines={1}>
                          {r.players.map((p) => p.guest_name ?? p.profiles?.full_name).join(', ')}
                        </Txt>
                      )}
                  </View>
                  {r.bookable ? (
                    <View style={{ backgroundColor: c.accent, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 }}>
                      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.onAccent }}>{competition ? 'Enter' : 'Book'}</Text>
                    </View>
                  ) : !r.block && !r.reservedFor && r.spaces <= 0 && !r.mine ? (
                    <Txt variant="small">Full</Txt>
                  ) : null}
                  {((r.mine && !admin && !r.past) || admin) &&
                    r.slotBookings
                      .filter((b) => admin || b.booked_by === me)
                      .map((b) => (
                        <Pressable key={b.id} onPress={() => cancel(b)} accessibilityLabel="Cancel booking" hitSlop={8}>
                          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: r.mine ? c.heroMuted : c.danger }}>Cancel</Text>
                        </Pressable>
                      ))}
                </Pressable>
              );
            })}
          </View>
        );
      })}
      <BookingModal
        target={target}
        onClose={() => setTarget(null)}
        onBooked={(time) => {
          setTarget(null);
          toast(competition ? `Entered · ${time}` : `Booked for ${time}`);
          void sheet.reload();
        }}
      />
    </View>
  );
}
