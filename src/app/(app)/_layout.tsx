import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuth } from '@/providers/auth';
import { useClub } from '@/providers/club';
import { fonts, useColors } from '@/theme';

/** Everything in (app) requires a signed-in user with an active club selected. */
export default function AppLayout() {
  const { session, initialising } = useAuth();
  const { club, loading } = useClub();
  const c = useColors();

  if (initialising || (session && loading)) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!club) return <Redirect href="/clubs" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        headerTintColor: c.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
        contentStyle: { backgroundColor: c.background },
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="competition/[id]" options={{ title: 'Competition' }} />
      <Stack.Screen name="shop" options={{ title: 'Pro Shop' }} />
      <Stack.Screen name="course" options={{ title: 'Course' }} />
      <Stack.Screen name="my-bookings" options={{ title: 'My bookings' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
    </Stack>
  );
}
