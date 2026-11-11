import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  attempt,
  Badge,
  Button,
  Card,
  Chip,
  ChipScroller,
  confirm,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Row,
  Screen,
  Txt,
} from '@/components/ui';
import { fetchMembers, type MemberRow } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import { DEPARTMENTS, type ClubRole, type Department, type MembershipStatus } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useAuth } from '@/providers/auth';
import { useCurrentClub } from '@/providers/club';
import { space } from '@/theme';

const STATUS_TONE = { pending: 'warning', active: 'success', suspended: 'danger' } as const;

export default function AdminMembers() {
  const { club, isAdmin } = useCurrentClub();
  const [filter, setFilter] = useState<MembershipStatus | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const members = useData(() => fetchMembers(club.id), [club.id]);

  if (!isAdmin) return <Screen><Txt>Only club admins can manage members.</Txt></Screen>;
  if (members.loading && !members.data) return <Loading />;

  const all = members.data ?? [];
  const q = search.trim().toLowerCase();
  const list = all
    .filter((m) => filter === 'all' || m.status === filter)
    .filter(
      (m) => !q || m.profiles?.full_name.toLowerCase().includes(q) || m.membership_number?.toLowerCase().includes(q),
    );
  const count = (s: MembershipStatus) => all.filter((m) => m.status === s).length;

  return (
    <Screen refreshing={members.loading} onRefresh={members.reload}>
      <ErrorBanner message={members.error} />
      <ChipScroller>
        <Chip label={`Pending (${count('pending')})`} selected={filter === 'pending'} onPress={() => setFilter('pending')} />
        <Chip label={`Active (${count('active')})`} selected={filter === 'active'} onPress={() => setFilter('active')} />
        <Chip label={`Suspended (${count('suspended')})`} selected={filter === 'suspended'} onPress={() => setFilter('suspended')} />
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
      </ChipScroller>
      <Field placeholder="Search name or membership no." value={search} onChangeText={setSearch} />
      {list.length === 0 && <EmptyState icon="people-outline" title="No members here" />}
      {list.map((m) => (
        <MemberCard
          key={m.user_id}
          member={m}
          clubId={club.id}
          open={openId === m.user_id}
          onToggle={() => setOpenId(openId === m.user_id ? null : m.user_id)}
          onSaved={members.reload}
        />
      ))}
    </Screen>
  );
}

function MemberCard({
  member,
  clubId,
  open,
  onToggle,
  onSaved,
}: {
  member: MemberRow;
  clubId: string;
  open: boolean;
  onToggle: () => void;
  onSaved: () => Promise<void>;
}) {
  const { session } = useAuth();
  const [role, setRole] = useState<ClubRole>(member.role);
  const [depts, setDepts] = useState<Department[]>(member.departments);
  const [number, setNumber] = useState(member.membership_number ?? '');
  const [busy, setBusy] = useState(false);
  const isOwner = member.role === 'owner';
  const isMe = member.user_id === session?.user.id;

  const update = (patch: Record<string, unknown>) =>
    attempt(async () => {
      setBusy(true);
      try {
        unwrap(await supabase.from('club_members').update(patch).eq('club_id', clubId).eq('user_id', member.user_id));
        await onSaved();
      } finally {
        setBusy(false);
      }
    });

  const remove = async () => {
    if (!(await confirm('Remove member?', `${member.profiles?.full_name} will lose access to the club.`, 'Remove'))) return;
    await attempt(async () => {
      unwrap(await supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', member.user_id));
      await onSaved();
    });
  };

  return (
    <Card>
      <Pressable onPress={isOwner ? undefined : onToggle} accessibilityRole="button">
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{member.profiles?.full_name || 'Unnamed member'}</Txt>
            <Txt variant="small">
              {member.membership_number ? `No. ${member.membership_number} · ` : ''}
              HCP {member.profiles?.handicap_index ?? '–'} · {member.role}
              {member.departments.length ? ` (${member.departments.join(', ')})` : ''}
            </Txt>
          </View>
          <Badge label={member.status} tone={STATUS_TONE[member.status]} />
        </Row>
      </Pressable>

      {member.status === 'pending' && (
        <Row>
          <Button small title="Approve" icon="checkmark" loading={busy} onPress={() => update({ status: 'active' })} />
          <Button small title="Decline" variant="danger" onPress={remove} />
        </Row>
      )}

      {open && !isOwner && (
        <View style={{ gap: space.md, marginTop: space.sm }}>
          <Field label="Membership number" value={number} onChangeText={setNumber} />
          <Txt variant="label">Role</Txt>
          <Row wrap>
            {(['member', 'staff', 'admin'] as const).map((r) => (
              <Chip key={r} label={r} selected={role === r} onPress={() => setRole(r)} />
            ))}
          </Row>
          {role === 'staff' && (
            <>
              <Txt variant="label">Staff areas</Txt>
              <Row wrap>
                {DEPARTMENTS.map((d) => (
                  <Chip
                    key={d.key}
                    label={d.label}
                    selected={depts.includes(d.key)}
                    onPress={() =>
                      setDepts((x) => (x.includes(d.key) ? x.filter((k) => k !== d.key) : [...x, d.key]))
                    }
                  />
                ))}
              </Row>
            </>
          )}
          <Button
            title="Save changes"
            loading={busy}
            onPress={() =>
              update({
                role,
                departments: role === 'staff' ? depts : [],
                membership_number: number.trim() || null,
              })
            }
          />
          {!isMe && (
            <Row>
              {member.status === 'active' ? (
                <Button small variant="secondary" title="Suspend" onPress={() => update({ status: 'suspended' })} />
              ) : (
                <Button small variant="secondary" title="Reactivate" onPress={() => update({ status: 'active' })} />
              )}
              <Button small variant="danger" title="Remove from club" onPress={remove} />
            </Row>
          )}
        </View>
      )}
    </Card>
  );
}
