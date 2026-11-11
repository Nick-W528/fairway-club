import { useState } from 'react';

import {
  attempt,
  Badge,
  Button,
  Card,
  Chip,
  confirm,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Row,
  Screen,
  SectionHeader,
  Stack,
  Toggle,
  Txt,
} from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { DEPARTMENTS, departmentLabel, type Department, type Post } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';

export default function AdminPosts() {
  const { club, canManage } = useCurrentClub();
  const allowed = DEPARTMENTS.filter((d) => canManage(d.key));
  const [dept, setDept] = useState<Department | undefined>(allowed[0]?.key);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  const posts = useData(async () => {
    const keys = allowed.map((d) => d.key);
    if (!keys.length) return [];
    return unwrap(
      await supabase
        .from('posts')
        .select('*')
        .eq('club_id', club.id)
        .in('department', keys)
        .order('published_at', { ascending: false })
        .limit(50),
    ) as Post[];
  }, [club.id]);

  const publish = () =>
    attempt(async () => {
      if (!dept) return;
      setBusy(true);
      try {
        unwrap(
          await supabase
            .from('posts')
            .insert({ club_id: club.id, department: dept, title: title.trim(), body: body.trim(), pinned }),
        );
        setTitle('');
        setBody('');
        setPinned(false);
        await posts.reload();
      } finally {
        setBusy(false);
      }
    });

  const togglePin = (p: Post) =>
    attempt(async () => {
      unwrap(await supabase.from('posts').update({ pinned: !p.pinned }).eq('id', p.id));
      await posts.reload();
    });

  const remove = async (p: Post) => {
    if (!(await confirm('Delete update?', p.title, 'Delete'))) return;
    await attempt(async () => {
      unwrap(await supabase.from('posts').delete().eq('id', p.id));
      await posts.reload();
    });
  };

  if (!allowed.length) return <Screen><Txt>You don't have access to post updates.</Txt></Screen>;

  return (
    <Screen refreshing={posts.loading} onRefresh={posts.reload}>
      <Card>
        <Stack>
          <Txt variant="label">Post as</Txt>
          <Row wrap>
            {allowed.map((d) => (
              <Chip key={d.key} label={d.label} selected={dept === d.key} onPress={() => setDept(d.key)} />
            ))}
          </Row>
          <Field label="Title" value={title} onChangeText={setTitle} />
          <Field label="Message" value={body} onChangeText={setBody} multiline />
          <Toggle label="Pin to top of feed" value={pinned} onValueChange={setPinned} />
          <Button title="Publish update" icon="send" onPress={publish} loading={busy} disabled={!title.trim()} />
        </Stack>
      </Card>

      <SectionHeader title="Recent updates" />
      <ErrorBanner message={posts.error} />
      {posts.loading && !posts.data && <Loading />}
      {posts.data?.length === 0 && <EmptyState icon="megaphone-outline" title="Nothing posted yet" />}
      {posts.data?.map((p) => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="small">
              {departmentLabel(p.department)} · {timeAgo(p.published_at)}
            </Txt>
            {p.pinned && <Badge label="Pinned" tone="primary" />}
          </Row>
          <Txt variant="heading">{p.title}</Txt>
          {!!p.body && <Txt variant="muted" numberOfLines={3}>{p.body}</Txt>}
          <Row>
            <Button small variant="secondary" title={p.pinned ? 'Unpin' : 'Pin'} onPress={() => togglePin(p)} />
            <Button small variant="danger" title="Delete" onPress={() => remove(p)} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
