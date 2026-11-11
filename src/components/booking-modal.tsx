import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Badge, Button, Chip, EmptySeat, ErrorBanner, Field, Row, Stack, Txt } from '@/components/ui';
import { haptic } from '@/lib/feedback';
import { addDays, isoDate, money, prettyDate } from '@/lib/format';
import { fetchMembers, fetchMyBookings } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { Competition } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useAuth } from '@/providers/auth';
import { useCurrentClub } from '@/providers/club';
import { radius, space, useColors } from '@/theme';

export interface BookingTarget {
  courseId: string;
  date: string;
  time: string;
  spaces: number;
  competition: Competition | null;
}

export function BookingModal({
  target,
  onClose,
  onBooked,
}: {
  target: BookingTarget | null;
  onClose: () => void;
  onBooked: (time: string) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { club } = useCurrentClub();
  const me = session!.user.id;
  const members = useData(() => fetchMembers(club.id, { activeOnly: true }), [club.id]);
  // People you've played with recently, for one-tap adding.
  const recent = useData(async () => {
    const past = await fetchMyBookings(club.id, me, isoDate(addDays(new Date(), -90)));
    const ids: string[] = [];
    for (const b of past) for (const p of b.tee_booking_players) if (p.user_id && p.user_id !== me && !ids.includes(p.user_id)) ids.push(p.user_id);
    return ids.slice(0, 6);
  }, [club.id]);

  const [partners, setPartners] = useState<string[]>([]);
  const [guests, setGuests] = useState<string[]>([]);
  const [guestName, setGuestName] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComp = !!target?.competition;
  const used = 1 + partners.length + guests.length;
  const spaceLeft = (target?.spaces ?? 0) - used;

  const nameOf = (id: string) => members.data?.find((m) => m.user_id === id)?.profiles?.full_name ?? 'Member';

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (members.data ?? [])
      .filter((m) => m.user_id !== me && !partners.includes(m.user_id))
      .filter((m) => m.profiles?.full_name.toLowerCase().includes(q) || m.membership_number?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [members.data, search, partners, me]);

  const addPartner = (id: string) => {
    if (spaceLeft <= 0 || partners.includes(id)) return;
    haptic.tap();
    setPartners((p) => [...p, id]);
    setSearch('');
  };

  const reset = () => {
    setPartners([]);
    setGuests([]);
    setGuestName('');
    setSearch('');
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const book = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('book_tee_time', {
      p_course: target.courseId,
      p_date: target.date,
      p_time: target.time,
      p_competition: target.competition?.id ?? null,
      p_partner_ids: partners,
      p_guest_names: guests,
    });
    setBusy(false);
    if (err) {
      haptic.error();
      return setError(err.message);
    }
    const time = target.time;
    reset();
    onBooked(time);
  };

  const fee = (target?.competition?.entry_fee_cents ?? 0) * (1 + partners.length);
  const seats: { name: string; guest?: boolean; onRemove?: () => void }[] = [
    { name: profile?.full_name ?? 'You' },
    ...partners.map((id) => ({ name: nameOf(id), onRemove: () => setPartners((p) => p.filter((x) => x !== id)) })),
    ...guests.map((g, i) => ({ name: g, guest: true, onRemove: () => setGuests((p) => p.filter((_, j) => j !== i)) })),
  ];

  return (
    <Modal visible={!!target} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: c.overlay }} onPress={close} accessibilityLabel="Close" />
      <View
        style={{
          backgroundColor: c.background,
          borderTopLeftRadius: radius.lg + 4,
          borderTopRightRadius: radius.lg + 4,
          maxHeight: '88%',
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
          paddingBottom: insets.bottom,
        }}>
        <View style={{ alignItems: 'center', paddingTop: space.sm }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.border }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }} keyboardShouldPersistTaps="handled">
          {target && (
            <>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Txt variant="label">{isComp ? target.competition!.name : 'Book tee time'}</Txt>
                  <Txt variant="hero">{target.time}</Txt>
                  <Txt variant="muted">{prettyDate(target.date, { weekday: 'long', month: 'long' })}</Txt>
                </View>
                <Pressable onPress={close} accessibilityLabel="Close" hitSlop={10}>
                  <Ionicons name="close-circle" size={30} color={c.textMuted} />
                </Pressable>
              </Row>
              <ErrorBanner message={error} />

              {/* Seats */}
              <View style={{ gap: space.sm }}>
                <Txt variant="label">
                  Players {used}/{target.spaces}
                </Txt>
                {seats.map((s, i) => (
                  <Row key={`${s.name}-${i}`} style={{ justifyContent: 'space-between' }}>
                    <Row gap={space.md}>
                      <Avatar name={s.name} size={36} />
                      <Txt style={{ fontSize: 16 }}>{i === 0 ? `${s.name} (you)` : s.name}</Txt>
                      {s.guest && <Badge label="Guest" />}
                    </Row>
                    {s.onRemove && (
                      <Pressable onPress={s.onRemove} accessibilityLabel={`Remove ${s.name}`} hitSlop={8}>
                        <Ionicons name="remove-circle" size={24} color={c.danger} />
                      </Pressable>
                    )}
                  </Row>
                ))}
                {Array.from({ length: Math.max(spaceLeft, 0) }, (_, i) => (
                  <Row key={`empty${i}`} gap={space.md}>
                    <EmptySeat size={36} />
                    <Txt variant="muted">Open spot</Txt>
                  </Row>
                ))}
              </View>

              {spaceLeft > 0 && (
                <Stack gap={space.md}>
                  {!!recent.data?.length && (
                    <View style={{ gap: space.sm }}>
                      <Txt variant="label">Played with recently</Txt>
                      <Row wrap>
                        {recent.data
                          .filter((id) => !partners.includes(id))
                          .map((id) => (
                            <Chip key={id} label={nameOf(id)} icon="add" onPress={() => addPartner(id)} />
                          ))}
                      </Row>
                    </View>
                  )}
                  <Field label="Add a member" placeholder="Search name or membership no." value={search} onChangeText={setSearch} />
                  {candidates.map((m) => (
                    <Pressable key={m.user_id} onPress={() => addPartner(m.user_id)} style={{ paddingVertical: 4 }}>
                      <Row gap={space.md}>
                        <Avatar name={m.profiles?.full_name} size={32} />
                        <Txt style={{ flex: 1 }}>{m.profiles?.full_name}</Txt>
                        {m.profiles?.handicap_index != null && <Txt variant="small">HCP {m.profiles.handicap_index}</Txt>}
                        <Ionicons name="add-circle" size={22} color={c.accentText} />
                      </Row>
                    </Pressable>
                  ))}
                  {!isComp && (
                    <Row style={{ alignItems: 'flex-end' }}>
                      <View style={{ flex: 1 }}>
                        <Field label="Or add a guest" placeholder="Guest name" value={guestName} onChangeText={setGuestName} />
                      </View>
                      <Button
                        title="Add"
                        variant="secondary"
                        disabled={!guestName.trim()}
                        onPress={() => {
                          setGuests((g) => [...g, guestName.trim()]);
                          setGuestName('');
                        }}
                      />
                    </Row>
                  )}
                </Stack>
              )}

              {isComp && fee > 0 && (
                <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: space.md }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt variant="muted">Entry fees from your bar card</Txt>
                    <Txt variant="heading">{money(fee, club.currency)}</Txt>
                  </Row>
                </View>
              )}
              <Button
                title={isComp ? 'Confirm entry' : `Book ${target.time}`}
                variant="accent"
                onPress={book}
                loading={busy}
                disabled={spaceLeft < 0}
              />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
