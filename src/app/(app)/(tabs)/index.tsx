import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  ActionTile,
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  Chip,
  ChipScroller,
  EmptyState,
  ErrorBanner,
  HeroCard,
  Loading,
  Row,
  Screen,
  SectionHeader,
  Txt,
} from '@/components/ui';
import { hhmm, isoDate, money, parseIsoDate, prettyDate, timeAgo } from '@/lib/format';
import { fetchCourses, fetchMyBookings } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import { DEPARTMENTS, departmentLabel, type Competition, type Department, type Post } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { describeWeather, fetchWeather } from '@/lib/weather';
import { useAuth } from '@/providers/auth';
import { useCurrentClub } from '@/providers/club';
import { fonts, radius, space, useColors } from '@/theme';

const STATUS = {
  open: { label: 'Course open', tone: 'success' },
  restricted: { label: 'Restrictions in place', tone: 'warning' },
  closed: { label: 'Course closed', tone: 'danger' },
} as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function countdown(date: string) {
  const days = Math.round((parseIsoDate(date).getTime() - parseIsoDate(isoDate(new Date())).getTime()) / 86400000);
  return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
}

export default function Home() {
  const c = useColors();
  const { session, profile } = useAuth();
  const { club } = useCurrentClub();
  const [dept, setDept] = useState<Department | null>(null);
  const today = isoDate(new Date());

  const data = useData(async () => {
    const [posts, courses, comps, bookings, balance, weather] = await Promise.all([
      supabase
        .from('posts')
        .select('*')
        .eq('club_id', club.id)
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(30),
      fetchCourses(club.id),
      supabase
        .from('competitions')
        .select('*')
        .eq('club_id', club.id)
        .eq('status', 'open')
        .gte('play_date', today)
        .order('play_date')
        .limit(6),
      fetchMyBookings(club.id, session!.user.id, today),
      supabase.rpc('my_wallet_balance', { p_club: club.id }),
      club.latitude != null && club.longitude != null ? fetchWeather(club.latitude, club.longitude) : Promise.resolve(null),
    ]);
    return {
      posts: unwrap(posts) as Post[],
      courses,
      comps: unwrap(comps) as Competition[],
      next: bookings[0] ?? null,
      balance: (balance.data as number | null) ?? 0,
      weather,
    };
  }, [club.id]);

  if (data.loading && !data.data) return <Loading />;
  const d = data.data;
  const posts = (d?.posts ?? []).filter((p) => !dept || p.department === dept);
  const firstName = profile?.full_name.split(' ')[0];
  const wx = d?.weather ? describeWeather(d.weather.code) : null;
  const playerNames = d?.next?.tee_booking_players.map((p) => p.guest_name ?? p.profiles?.full_name ?? '?') ?? [];

  return (
    <Screen safeTop refreshing={data.loading} onRefresh={data.reload}>
      <ErrorBanner message={data.error} />

      {/* Header */}
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10} wrap style={{ flex: 1 }}>
          <Txt variant="small">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Txt>
          {d?.weather && wx && (
            <>
              <Row gap={3}>
                <Ionicons name={wx.icon} size={14} color={c.textMuted} />
                <Txt variant="small">{d.weather.tempC}°</Txt>
              </Row>
              <Row gap={3}>
                <Ionicons name="flag-outline" size={13} color={c.textMuted} />
                <Txt variant="small">{d.weather.windMph} mph</Txt>
              </Row>
            </>
          )}
        </Row>
        <Pressable onPress={() => router.push('/(app)/profile')} accessibilityLabel="Profile">
          <Avatar name={profile?.full_name} size={34} />
        </Pressable>
      </Row>
      <View>
        <Txt variant="muted">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </Txt>
        <Txt variant="hero">Ready to{'\n'}tee off?</Txt>
      </View>

      {/* Next round */}
      {d?.next ? (
        <HeroCard onPress={() => router.push('/(app)/my-bookings')}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="label" color={c.accent}>
              Next round
            </Txt>
            <Badge label={countdown(d.next.play_date)} tone="accent" />
          </Row>
          <Txt variant="display" color={c.heroText} style={{ fontSize: 44, lineHeight: 46 }}>
            {hhmm(d.next.tee_time)}
          </Txt>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt color={c.heroMuted} style={{ flex: 1 }} numberOfLines={1}>
              {prettyDate(d.next.play_date, { weekday: 'long' })} · {d.next.competitions?.name ?? 'General play'}
            </Txt>
            <AvatarStack names={playerNames} ring={c.hero} />
          </Row>
        </HeroCard>
      ) : (
        <HeroCard>
          <Txt variant="label" color={c.accent}>
            Next round
          </Txt>
          <Txt variant="title" color={c.heroText}>
            Nothing booked yet
          </Txt>
          <Button title="Find a tee time" variant="accent" icon="time-outline" onPress={() => router.push('/(app)/(tabs)/tee-times')} />
        </HeroCard>
      )}

      {/* Quick actions */}
      <Row gap={space.sm}>
        <ActionTile icon="calendar-outline" label="Book" onPress={() => router.push('/(app)/(tabs)/tee-times')} />
        <ActionTile icon="trophy-outline" label="Enter" onPress={() => router.push('/(app)/(tabs)/competitions')} />
        <ActionTile icon="qr-code-outline" label="Pay" onPress={() => router.push('/(app)/(tabs)/bar-card')} />
        <ActionTile icon="bag-handle-outline" label="Shop" onPress={() => router.push('/(app)/shop')} />
      </Row>

      {/* Course status + bar balance */}
      <Row gap={space.sm} style={{ alignItems: 'stretch' }}>
        {d?.courses[0] && (
          <Card onPress={() => router.push('/(app)/course')} style={{ flex: 1.4 }}>
            <Row gap={6}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c[STATUS[d.courses[0].status].tone] }} />
              <Txt variant="label" color={c[STATUS[d.courses[0].status].tone]}>
                {STATUS[d.courses[0].status].label}
              </Txt>
            </Row>
            <Txt style={{ fontFamily: fonts.medium }} numberOfLines={2}>
              {d.courses[0].status_note ??
                `${d.courses[0].trolleys_allowed ? 'Trolleys OK' : 'No trolleys'} · ${d.courses[0].buggies_allowed ? 'buggies OK' : 'no buggies'}`}
            </Txt>
            <Txt variant="small">Updated {timeAgo(d.courses[0].status_updated_at)}</Txt>
          </Card>
        )}
        <Card onPress={() => router.push('/(app)/(tabs)/bar-card')} style={{ flex: 1 }}>
          <Txt variant="label">Bar card</Txt>
          <Txt variant="title">{money(d?.balance ?? 0, club.currency)}</Txt>
          <Txt variant="small" color={c.accentText}>
            Top up ›
          </Txt>
        </Card>
      </Row>

      {/* Competitions */}
      {!!d?.comps.length && (
        <>
          <SectionHeader
            title="Competitions"
            action={<Button small variant="ghost" title="See all" onPress={() => router.push('/(app)/(tabs)/competitions')} />}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {d.comps.map((comp) => {
              const dt = parseIsoDate(comp.play_date);
              return (
                <Card key={comp.id} onPress={() => router.push(`/(app)/competition/${comp.id}`)} style={{ width: 220 }}>
                  <Row gap={space.md}>
                    <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingVertical: 6, width: 50, alignItems: 'center' }}>
                      <Txt variant="title" style={{ lineHeight: 26 }}>
                        {dt.getDate()}
                      </Txt>
                      <Txt variant="label" style={{ fontSize: 10 }}>
                        {dt.toLocaleDateString('en-GB', { month: 'short' })}
                      </Txt>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="heading" numberOfLines={2}>
                        {comp.name}
                      </Txt>
                      <Txt variant="small">
                        {comp.entry_fee_cents ? money(comp.entry_fee_cents, club.currency) : 'Free'} · {hhmm(comp.first_tee)}
                      </Txt>
                    </View>
                  </Row>
                </Card>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* News */}
      <SectionHeader title="Club news" />
      <ChipScroller>
        <Chip label="All" selected={!dept} onPress={() => setDept(null)} />
        {DEPARTMENTS.map((x) => (
          <Chip key={x.key} label={x.label} selected={dept === x.key} onPress={() => setDept(x.key)} />
        ))}
      </ChipScroller>
      {posts.length === 0 && <EmptyState icon="newspaper-outline" title="No updates yet" message="News from around the club will appear here." />}
      {posts.map((p) => (
        <Card key={p.id} style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
          {p.image_url && <Image source={p.image_url} style={{ height: 150 }} contentFit="cover" />}
          <View style={{ padding: space.lg, gap: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={6}>
                <Ionicons
                  name={(DEPARTMENTS.find((x) => x.key === p.department)?.icon ?? 'megaphone-outline') as never}
                  size={14}
                  color={c.accentText}
                />
                <Txt variant="label" color={c.accentText}>
                  {departmentLabel(p.department)}
                </Txt>
                {p.pinned && <Badge label="Pinned" tone="accent" />}
              </Row>
              <Txt variant="small">{timeAgo(p.published_at)}</Txt>
            </Row>
            <Txt variant="heading" style={{ fontSize: 17 }}>
              {p.title}
            </Txt>
            {!!p.body && <Txt variant="muted">{p.body}</Txt>}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
