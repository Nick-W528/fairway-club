import { Redirect } from 'expo-router';

import { EmptyState, Loading, Screen } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/providers/auth';
import { useClub } from '@/providers/club';

/** Entry gate: routes to sign-in, club picker or the member app. */
export default function Index() {
  const { session, initialising } = useAuth();
  const { club, loading } = useClub();

  if (!isSupabaseConfigured) {
    return (
      <Screen safeTop>
        <EmptyState
          icon="construct-outline"
          title="Backend not configured"
          message="Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo. See README.md."
        />
      </Screen>
    );
  }
  if (initialising || (session && loading)) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!club) return <Redirect href="/clubs" />;
  return <Redirect href="/(app)/(tabs)" />;
}
