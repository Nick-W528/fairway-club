import { router } from 'expo-router';

import { Button, ListItem, Screen, SectionHeader } from '@/components/ui';
import { useAuth } from '@/providers/auth';
import { useClub, useCurrentClub } from '@/providers/club';

export default function More() {
  const { signOut } = useAuth();
  const { club, isStaff } = useCurrentClub();
  const { memberships, selectClub } = useClub();
  const otherClubs = memberships.filter((m) => m.status === 'active').length > 1;

  return (
    <Screen>
      {isStaff && (
        <>
          <SectionHeader title="Staff" />
          <ListItem
            icon="settings-outline"
            title="Club management"
            subtitle="Members, tee sheet, competitions, shop, bar, updates"
            onPress={() => router.push('/(app)/admin')}
          />
        </>
      )}
      <SectionHeader title={club.name} />
      <ListItem icon="pricetag-outline" title="Pro shop" subtitle="Browse and order club items" onPress={() => router.push('/(app)/shop')} />
      <ListItem icon="map-outline" title="Course information" subtitle="Scorecard, status and local info" onPress={() => router.push('/(app)/course')} />
      <ListItem icon="calendar-outline" title="My bookings" onPress={() => router.push('/(app)/my-bookings')} />
      <ListItem icon="call-outline" title="Contact the club" subtitle={[club.phone, club.email].filter(Boolean).join(' · ') || undefined} />

      <SectionHeader title="Account" />
      <ListItem icon="person-outline" title="Profile & handicap" onPress={() => router.push('/(app)/profile')} />
      <ListItem
        icon="swap-horizontal-outline"
        title={otherClubs ? 'Switch club' : 'Join another club'}
        onPress={async () => {
          await selectClub(null);
          router.replace('/clubs');
        }}
      />
      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
