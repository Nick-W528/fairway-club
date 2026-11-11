import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { MemberScanner } from '@/components/member-scanner';

import {
  attempt,
  Button,
  Card,
  ErrorBanner,
  Field,
  Loading,
  notify,
  Row,
  Screen,
  SectionHeader,
  Txt,
} from '@/components/ui';
import { toast } from '@/lib/feedback';
import { money, parseMoney, prettyDateTime } from '@/lib/format';
import { fetchMembers, type MemberRow } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';
import { space, useColors } from '@/theme';

interface RecentTx {
  id: string;
  amount_cents: number;
  description: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
}

export default function BarTill() {
  const c = useColors();
  const { club, canManage } = useCurrentClub();
  const members = useData(() => fetchMembers(club.id, { activeOnly: true }), [club.id]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState<'charge' | 'topup' | null>(null);

  const recent = useData(async () => {
    return unwrap(
      await supabase
        .from('wallet_transactions')
        .select('id, amount_cents, description, created_at, profiles!wallet_transactions_user_id_fkey(full_name)')
        .eq('club_id', club.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ) as unknown as RecentTx[];
  }, [club.id]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (members.data ?? [])
      .filter((m) => m.profiles?.full_name.toLowerCase().includes(q) || m.membership_number?.toLowerCase() === q)
      .slice(0, 8);
  }, [members.data, search]);

  const pick = (m: MemberRow) =>
    attempt(async () => {
      setSelected(m);
      setSearch('');
      setBalance(null);
      setBalance(unwrap(await supabase.rpc('member_wallet_balance', { p_club: club.id, p_user: m.user_id })) as number);
    });

  const transact = (kind: 'charge' | 'topup') =>
    attempt(async () => {
      const cents = parseMoney(amount);
      if (!selected || !cents || cents <= 0) throw new Error('Enter an amount');
      setBusy(kind);
      try {
        const newBalance = unwrap(
          await supabase.rpc('bar_card_transaction', {
            p_club: club.id,
            p_user: selected.user_id,
            p_amount_cents: kind === 'charge' ? -cents : cents,
            p_description: note.trim() || null,
          }),
        ) as number;
        setBalance(newBalance);
        setAmount('');
        setNote('');
        await recent.reload();
        notify(
          kind === 'charge' ? 'Charged' : 'Topped up',
          `${money(cents, club.currency)} · new balance ${money(newBalance, club.currency)}`,
        );
      } finally {
        setBusy(null);
      }
    });

  if (!canManage('bar')) return <Screen><Txt>You don't have access to the bar till.</Txt></Screen>;
  if (members.loading && !members.data) return <Loading />;

  return (
    <Screen>
      <ErrorBanner message={members.error} />
      {Platform.OS !== 'web' && (
        <Button title="Scan bar card" icon="qr-code-outline" variant="accent" onPress={() => setScanning(true)} />
      )}
      <MemberScanner
        visible={scanning}
        clubId={club.id}
        onClose={() => setScanning(false)}
        onInvalid={() => {
          setScanning(false);
          toast("That code isn't a member card for this club", 'error');
        }}
        onScanned={(userId) => {
          setScanning(false);
          const m = members.data?.find((x) => x.user_id === userId);
          if (m) void pick(m);
          else toast('Member not found or not active', 'error');
        }}
      />
      <Field
        label="Find member"
        placeholder="Name or membership number"
        value={search}
        onChangeText={setSearch}
      />
      {matches.map((m) => (
        <Pressable key={m.user_id} onPress={() => pick(m)}>
          <Card style={{ paddingVertical: space.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt>{m.profiles?.full_name}</Txt>
              <Txt variant="small">{m.membership_number ?? ''}</Txt>
            </Row>
          </Card>
        </Pressable>
      ))}

      {selected && (
        <Card style={{ borderColor: c.primary }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Txt variant="heading">{selected.profiles?.full_name}</Txt>
              <Txt variant="small">{selected.membership_number ?? 'No membership number'}</Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt variant="label">Balance</Txt>
              <Txt variant="title">{balance == null ? '…' : money(balance, club.currency)}</Txt>
            </View>
          </Row>
          <Field label="Amount" keyboardType="decimal-pad" placeholder="0.00" value={amount} onChangeText={setAmount} />
          <Field label="Note (optional)" placeholder="e.g. 2 pints, sandwich" value={note} onChangeText={setNote} />
          <Row>
            <Button style={{ flex: 1 }} title="Charge card" icon="remove-circle-outline" loading={busy === 'charge'} onPress={() => transact('charge')} />
            <Button style={{ flex: 1 }} title="Cash top-up" variant="secondary" icon="add-circle-outline" loading={busy === 'topup'} onPress={() => transact('topup')} />
          </Row>
        </Card>
      )}

      <SectionHeader title="Recent transactions" />
      {recent.data?.map((t) => (
        <Row key={t.id} style={{ justifyContent: 'space-between', paddingVertical: space.sm, borderBottomWidth: 1, borderColor: c.border }}>
          <View style={{ flex: 1 }}>
            <Txt>{t.profiles?.full_name}</Txt>
            <Txt variant="small">
              {t.description} · {prettyDateTime(t.created_at)}
            </Txt>
          </View>
          <Txt style={{ fontWeight: '700' }} color={t.amount_cents > 0 ? c.success : c.text}>
            {money(t.amount_cents, club.currency)}
          </Txt>
        </Row>
      ))}
    </Screen>
  );
}
