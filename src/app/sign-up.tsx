import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, ErrorBanner, Field, notify, Screen, Stack, Txt } from '@/components/ui';
import { isSupabaseConfigured, NOT_CONFIGURED, supabase } from '@/lib/supabase';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });
    setBusy(false);
    if (err) return setError(err.message);
    if (!data.session) {
      notify('Check your email', 'We sent you a link to confirm your account.');
      router.replace('/sign-in');
    } else {
      router.replace('/');
    }
  };

  return (
    <Screen>
      <Txt variant="muted">
        Create one account and use it at every club you belong to.
      </Txt>
      <Card>
        <Stack>
          <ErrorBanner message={isSupabaseConfigured ? error : NOT_CONFIGURED} />
          <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            hint="At least 8 characters"
          />
          <Button
            title="Create account"
            variant="accent"
            onPress={submit}
            loading={busy}
            disabled={!name.trim() || !email || !password}
          />
        </Stack>
      </Card>
    </Screen>
  );
}
