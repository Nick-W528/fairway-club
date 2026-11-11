import { attempt, Badge, Button, Card, confirm, EmptyState, ErrorBanner, Loading, Row, Screen, Txt } from '@/components/ui';
import { hhmm, isoDate, prettyDate } from '@/lib/format';
import { fetchMyBookings } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import { useData } from '@/lib/use-data';
import { useAuth } from '@/providers/auth';
import { useCurrentClub } from '@/providers/club';

export default function MyBookings() {
  const { session } = useAuth();
  const { club } = useCurrentClub();
  const me = session!.user.id;
  const data = useData(() => fetchMyBookings(club.id, me, isoDate(new Date())), [club.id]);

  const cancel = async (id: string, isComp: boolean) => {
    const ok = await confirm(
      'Cancel booking?',
      isComp ? 'Your group will be withdrawn and the entry fees refunded to your bar card.' : 'This tee time will be released.',
      'Cancel booking',
    );
    if (!ok) return;
    await attempt(async () => {
      unwrap(await supabase.rpc('cancel_tee_booking', { p_booking: id }));
      await data.reload();
    });
  };

  if (data.loading && !data.data) return <Loading />;
  return (
    <Screen refreshing={data.loading} onRefresh={data.reload}>
      <ErrorBanner message={data.error} />
      {data.data?.length === 0 && <EmptyState icon="calendar-outline" title="No upcoming bookings" />}
      {data.data?.map((b) => (
        <Card key={b.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="heading">
              {hhmm(b.tee_time)} · {prettyDate(b.play_date, { weekday: 'long' })}
            </Txt>
            {b.competitions && <Badge label="Competition" tone="primary" />}
          </Row>
          <Txt variant="muted">
            {b.courses?.name}
            {b.competitions ? ` · ${b.competitions.name}` : ''}
          </Txt>
          <Txt>
            {b.tee_booking_players
              .map((p) => (p.guest_name ? `${p.guest_name} (guest)` : p.profiles?.full_name || 'Member'))
              .join(', ')}
          </Txt>
          {b.booked_by === me ? (
            <Button small variant="danger" title="Cancel booking" onPress={() => cancel(b.id, !!b.competition_id)} />
          ) : (
            <Txt variant="small">Booked by a playing partner</Txt>
          )}
        </Card>
      ))}
    </Screen>
  );
}
