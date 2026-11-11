import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ErrorBanner, Field, Screen, Stack, Txt } from '@/components/ui';
import { isSupabaseConfigured, NOT_CONFIGURED, supabase } from '@/lib/supabase';
import { space, useColors } from '@/theme';

export default function SignIn() {
  const c = useColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) return setError(err.message);
    router.replace('/');
  };

  return (
    <Screen safeTop>
      <View style={{ alignItems: 'center', marginVertical: space.xxl, gap: space.sm }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name="golf" size={36} color={c.onAccent} />
        </View>
        <Txt variant="hero">Fairway Club</Txt>
        <Txt variant="muted">Your golf club, in your pocket.</Txt>
      </View>
      <Card>
        <Stack>
          <ErrorBanner message={isSupabaseConfigured ? error : NOT_CONFIGURED} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            onSubmitEditing={submit}
          />
          <Button title="Sign in" variant="accent" onPress={submit} loading={busy} disabled={!email || !password} />
          <Link href="/sign-up" asChild>
            <Button title="New here? Create an account" variant="ghost" />
          </Link>
        </Stack>
      </Card>
    </Screen>
  );
}
