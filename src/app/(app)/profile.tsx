import { useState } from 'react';

import { attempt, Button, Card, Field, Loading, notify, Screen, SectionHeader, Segmented, Stack, Txt } from '@/components/ui';
import { supabase, unwrap } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { useAuth } from '@/providers/auth';
import { useCurrentClub } from '@/providers/club';
import { useTheme } from '@/theme';

export default function ProfileScreen() {
  const { profile } = useAuth();
  if (!profile) return <Loading />;
  return <ProfileForm key={profile.id} profile={profile} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { session, refreshProfile } = useAuth();
  const { membership } = useCurrentClub();
  const [name, setName] = useState(profile.full_name);
  const [hcp, setHcp] = useState(profile.handicap_index?.toString() ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [busy, setBusy] = useState(false);
  const { preference, setPreference } = useTheme();

  const save = () =>
    attempt(async () => {
      const handicap = hcp.trim() === '' ? null : Number(hcp);
      if (handicap != null && (Number.isNaN(handicap) || handicap < -10 || handicap > 54)) {
        throw new Error('Handicap index must be between -10 and 54');
      }
      setBusy(true);
      try {
        unwrap(
          await supabase
            .from('profiles')
            .update({ full_name: name.trim(), handicap_index: handicap, phone: phone.trim() || null })
            .eq('id', session!.user.id),
        );
        await refreshProfile();
        notify('Profile saved');
      } finally {
        setBusy(false);
      }
    });

  return (
    <Screen>
      <Card>
        <Stack>
          <Txt variant="muted">{session?.user.email}</Txt>
          {membership.membership_number && <Txt variant="muted">Membership no. {membership.membership_number}</Txt>}
          <Field label="Full name" value={name} onChangeText={setName} />
          <Field label="Handicap index" value={hcp} onChangeText={setHcp} keyboardType="decimal-pad" placeholder="e.g. 14.2" />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Button title="Save" onPress={save} loading={busy} />
        </Stack>
      </Card>
      <SectionHeader title="Appearance" />
      <Card>
        <Txt variant="muted">Choose light or dark, or follow your phone's setting.</Txt>
        <Segmented
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Card>
    </Screen>
  );
}
