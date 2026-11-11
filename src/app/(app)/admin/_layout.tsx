import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, Stack, useSegments } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Txt } from '@/components/ui';
import { visibleSections } from '@/lib/admin-nav';
import { useCurrentClub } from '@/providers/club';
import { fonts, radius, space, useColors } from '@/theme';

const WIDE = 900;

/**
 * Club management. On wide screens (desktop/tablet web) a sidebar sits beside
 * the content like a back office; on phones it's a normal stack.
 */
export default function AdminLayout() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const { isStaff } = useCurrentClub();

  if (!isStaff) return <Redirect href="/(app)/(tabs)" />;

  const stack = (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        headerTintColor: c.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
        contentStyle: { backgroundColor: c.background },
        headerBackButtonDisplayMode: 'minimal',
        animation: wide ? 'none' : 'default',
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: wide ? 'Overview' : 'Club management',
          headerLeft: wide
            ? undefined
            : () => (
                <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={10} style={{ marginRight: space.sm }}>
                  <Ionicons name="chevron-back" size={26} color={c.text} />
                </Pressable>
              ),
        }}
      />
      <Stack.Screen name="members" options={{ title: 'Members' }} />
      <Stack.Screen name="posts" options={{ title: 'Club updates' }} />
      <Stack.Screen name="competitions" options={{ title: 'Competitions' }} />
      <Stack.Screen name="competition/[id]" options={{ title: 'Edit competition' }} />
      <Stack.Screen name="tee-sheet" options={{ title: 'Tee sheet' }} />
      <Stack.Screen name="bar" options={{ title: 'Bar till' }} />
      <Stack.Screen name="shop" options={{ title: 'Pro shop' }} />
      <Stack.Screen name="course" options={{ title: 'Course' }} />
      <Stack.Screen name="settings" options={{ title: 'Club settings' }} />
    </Stack>
  );

  if (!wide) return stack;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.background }}>
      <Sidebar />
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}

function Sidebar() {
  const c = useColors();
  const segments = useSegments() as string[];
  const { club, isAdmin, membership, canManage } = useCurrentClub();
  const current = segments[segments.indexOf('admin') + 1] ?? '';
  const sections = visibleSections(isAdmin, membership.departments, canManage);

  return (
    <View style={{ width: 240, backgroundColor: c.surface, borderRightWidth: 1, borderColor: c.border, padding: space.lg, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
        <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="golf" size={18} color={c.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="heading" numberOfLines={1}>
            {club.name}
          </Txt>
          <Txt variant="small">Club management</Txt>
        </View>
      </View>
      {sections.map((s) => {
        const on = current === s.segment || (s.segment === 'competitions' && current === 'competition');
        return (
          <Pressable
            key={s.title}
            onPress={() => router.replace(s.href)}
            style={({ hovered }: { hovered?: boolean }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              paddingHorizontal: space.md,
              paddingVertical: 10,
              borderRadius: radius.sm,
              backgroundColor: on ? c.primary : hovered ? c.surfaceAlt : 'transparent',
            })}>
            <Ionicons name={s.icon} size={18} color={on ? c.primaryText : c.textMuted} />
            <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 14, color: on ? c.primaryText : c.text }}>{s.title}</Text>
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => router.replace('/(app)/(tabs)')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 10 }}>
        <Ionicons name="arrow-back" size={18} color={c.textMuted} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.textMuted }}>Back to member app</Text>
      </Pressable>
    </View>
  );
}
