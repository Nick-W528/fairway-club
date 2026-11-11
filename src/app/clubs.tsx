import { Redirect, router } from 'expo-router';
import { useState } from 'react';

import {
  attempt,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  ListItem,
  notify,
  Screen,
  SectionHeader,
  Stack,
  Txt,
} from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import type { Club } from '@/lib/types';
import { useAuth } from '@/providers/auth';
import { useClub } from '@/providers/club';

/** Pick an active club, request to join a club, or register a new club. */
export default function Clubs() {
  const { session, signOut } = useAuth();
  const { memberships, selectClub, reload } = useClub();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Club[] | null>(null);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [busy, setBusy] = useState(false);

  const open = async (clubId: string) => {
    await selectClub(clubId);
    router.replace('/(app)/(tabs)');
  };

  const search = () =>
    attempt(async () => {
      const q = query.trim();
      const res = unwrap(
        await supabase.from('clubs').select('*').ilike('name', `%${q}%`).order('name').limit(20),
      );
      setResults(res as Club[]);
    });

  const join = (club: Club) =>
    attempt(async () => {
      unwrap(
        await supabase
          .from('club_members')
          .insert({ club_id: club.id, user_id: session!.user.id }),
      );
      await reload();
      notify('Request sent', `${club.name} will review your membership request.`);
    });

  const create = () =>
    attempt(async () => {
      setBusy(true);
      try {
        const id = unwrap(
          await supabase.rpc('create_club', { p_name: newName.trim(), p_slug: newSlug.trim() }),
        ) as string;
        await reload();
        await open(id);
      } finally {
        setBusy(false);
      }
    });

  const memberOf = new Set(memberships.map((m) => m.club_id));
  if (!session) return <Redirect href="/sign-in" />;

  return (
    <Screen>
      <SectionHeader title="My clubs" />
      {memberships.length === 0 && (
        <EmptyState title="No clubs yet" message="Search for your club below to request membership." />
      )}
      {memberships.map((m) => (
        <ListItem
          key={m.club_id}
          icon="flag-outline"
          title={m.clubs.name}
          subtitle={m.status === 'active' ? `${m.role[0].toUpperCase()}${m.role.slice(1)}` : undefined}
          onPress={m.status === 'active' ? () => open(m.club_id) : undefined}
          right={
            m.status === 'active' ? undefined : (
              <Badge label={m.status === 'pending' ? 'Awaiting approval' : 'Suspended'} tone="warning" />
            )
          }
        />
      ))}

      <SectionHeader title="Find a club" />
      <Card>
        <Stack>
          <Field placeholder="Club name" value={query} onChangeText={setQuery} onSubmitEditing={search} />
          <Button title="Search" icon="search" variant="secondary" onPress={search} />
        </Stack>
      </Card>
      {results?.length === 0 && <Txt variant="muted">No clubs found.</Txt>}
      {results?.map((club) => (
        <ListItem
          key={club.id}
          icon="golf-outline"
          title={club.name}
          subtitle={club.address ?? club.tagline ?? undefined}
          right={
            memberOf.has(club.id) ? (
              <Badge label="Joined" tone="success" />
            ) : (
              <Button small title="Join" onPress={() => join(club)} />
            )
          }
        />
      ))}

      <SectionHeader title="Run a golf club?" />
      <Card>
        <Stack>
          <Txt variant="muted">Register your club to manage members, tee sheet, competitions and more.</Txt>
          <Field label="Club name" value={newName} onChangeText={setNewName} />
          <Field
            label="Short web name"
            value={newSlug}
            onChangeText={(t) => setNewSlug(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            autoCapitalize="none"
            placeholder="e.g. oakridge"
            hint="3–40 lowercase letters, numbers or dashes"
          />
          <Button
            title="Register club"
            onPress={create}
            loading={busy}
            disabled={!newName.trim() || newSlug.length < 3}
          />
        </Stack>
      </Card>

      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
