import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic, toast } from '@/lib/feedback';
import { fonts, MAX_WIDTH, radius, space, useColors } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
  padded = true,
  safeTop = false,
  maxWidth = MAX_WIDTH,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  padded?: boolean;
  safeTop?: boolean;
  maxWidth?: number;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const inner = (
    <View
      style={[
        styles.inner,
        { maxWidth },
        padded && { padding: space.lg },
        safeTop && { paddingTop: insets.top + space.lg },
        { paddingBottom: space.xxl + insets.bottom },
      ]}>
      {children}
    </View>
  );
  if (!scroll) return <View style={[styles.flex, { backgroundColor: c.background }]}>{inner}</View>;
  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.grow}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.textMuted} />
        ) : undefined
      }>
      {inner}
    </ScrollView>
  );
}

export function Row({
  children,
  gap = space.sm,
  style,
  wrap,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>
      {children}
    </View>
  );
}

export function Stack({ children, gap = space.md, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/** Scales slightly when pressed, with a light haptic tap. */
export function PressableScale({
  children,
  onPress,
  style,
  disabled,
  accessibilityLabel,
}: {
  children?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const c = useColors();
  const base = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressableScale onPress={onPress} style={base}>
      {children}
    </PressableScale>
  );
}

/** Dark, high-contrast card for the most important thing on a screen. */
export function HeroCard({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useColors();
  return (
    <Card onPress={onPress} style={[{ backgroundColor: c.hero, borderColor: c.heroBorder, borderRadius: radius.lg }, style]}>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type TextVariant = 'hero' | 'display' | 'title' | 'heading' | 'body' | 'muted' | 'small' | 'label';

export function Txt({
  children,
  variant = 'body',
  style,
  color,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
  color?: string;
  numberOfLines?: number;
}) {
  const c = useColors();
  const v: Record<TextVariant, TextStyle> = {
    hero: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: c.text, textTransform: 'uppercase' },
    display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34, color: c.text },
    title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: c.text },
    heading: { fontFamily: fonts.semibold, fontSize: 16, color: c.text },
    body: { fontFamily: fonts.body, fontSize: 15, color: c.text, lineHeight: 21 },
    muted: { fontFamily: fonts.body, fontSize: 14, color: c.textMuted, lineHeight: 20 },
    small: { fontFamily: fonts.body, fontSize: 12, color: c.textMuted },
    label: { fontFamily: fonts.semibold, fontSize: 11, color: c.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  };
  return (
    <Text numberOfLines={numberOfLines} style={[v[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
      <Txt variant="title" style={{ textTransform: 'uppercase', fontSize: 20 }}>
        {title}
      </Txt>
      {action}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const p = {
    primary: { bg: c.primary, fg: c.primaryText, border: c.primary },
    accent: { bg: c.accent, fg: c.onAccent, border: c.accent },
    secondary: { bg: c.surface, fg: c.text, border: c.border },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft },
    ghost: { bg: 'transparent', fg: c.accentText, border: 'transparent' },
  }[variant];
  const isDisabled = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: p.bg, borderColor: p.border },
        isDisabled && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <Row gap={6} style={{ justifyContent: 'center' }}>
          {icon && <Ionicons name={icon} size={small ? 15 : 18} color={p.fg} />}
          <Text style={{ color: p.fg, fontFamily: fonts.semibold, fontSize: small ? 13 : 15 }}>{title}</Text>
        </Row>
      )}
    </PressableScale>
  );
}

/** Big square shortcut tile used on the home screen. */
export function ActionTile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <PressableScale
      onPress={onPress}
      style={{ flex: 1, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 6 }}>
      <Ionicons name={icon} size={22} color={c.text} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.text }}>{label}</Text>
    </PressableScale>
  );
}

export function Field({
  label,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6, flex: (style as ViewStyle | undefined)?.flex }}>
      {label && <Txt variant="label">{label}</Txt>}
      <TextInput
        placeholderTextColor={c.textMuted}
        {...props}
        style={[
          styles.input,
          { backgroundColor: c.surface, borderColor: c.border, color: c.text, fontFamily: fonts.body },
          props.multiline && { minHeight: 96, textAlignVertical: 'top' },
          style,
        ]}
      />
      {hint && <Txt variant="small">{hint}</Txt>}
    </View>
  );
}

export function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const c = useColors();
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Txt>{label}</Txt>
      <Switch
        value={value}
        onValueChange={(v) => {
          haptic.tap();
          onValueChange(v);
        }}
        trackColor={{ true: c.accent, false: c.surfaceAlt }}
        thumbColor={Platform.OS === 'android' ? (value ? c.onAccent : c.surface) : undefined}
      />
    </Row>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={[
        styles.chip,
        { backgroundColor: selected ? c.primary : c.surface, borderColor: selected ? c.primary : c.border },
      ]}>
      <Row gap={4}>
        {icon && <Ionicons name={icon} size={14} color={selected ? c.primaryText : c.textMuted} />}
        <Text style={{ color: selected ? c.primaryText : c.text, fontFamily: fonts.semibold, fontSize: 13 }}>{label}</Text>
      </Row>
    </Pressable>
  );
}

/** Segmented control, e.g. Upcoming | Results. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={{ flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center', backgroundColor: on ? c.surface : 'transparent' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? c.text : c.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChipScroller({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {children}
    </ScrollView>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary' | 'accent';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = useColors();
  const t = {
    neutral: [c.surfaceAlt, c.textMuted],
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    primary: [c.primarySoft, c.text],
    accent: [c.accent, c.onAccent],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t[0] }]}>
      <Text style={{ color: t[1], fontSize: 11, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  icon,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <Card onPress={onPress} style={{ paddingVertical: space.md }}>
      <Row gap={space.md}>
        {icon && (
          <View style={[styles.iconWrap, { backgroundColor: c.surfaceAlt }]}>
            <Ionicons name={icon} size={20} color={c.text} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Txt variant="heading" style={{ fontSize: 15 }}>
            {title}
          </Txt>
          {subtitle ? <Txt variant="muted">{subtitle}</Txt> : null}
        </View>
        {right ?? (onPress && <Ionicons name="chevron-forward" size={18} color={c.textMuted} />)}
      </Row>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

const AVATAR_COLOURS = ['#3A5A44', '#6F8F62', '#2F6B5A', '#7A6A3A', '#4A5F7A', '#7A4A5A', '#5A4A7A', '#3F7A6A'];

export function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function colourFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

export function Avatar({ name, size = 28, ring }: { name?: string | null; size?: number; ring?: string }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colourFor(name ?? '?'),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}>
      <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

/** Empty seat placeholder (dashed circle). */
export function EmptySeat({ size = 28 }: { size?: number }) {
  const c = useColors();
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.textMuted, opacity: 0.6 }} />;
}

export function AvatarStack({ names, size = 24, ring }: { names: string[]; size?: number; ring: string }) {
  return (
    <Row gap={0}>
      {names.slice(0, 4).map((n, i) => (
        <View key={`${n}-${i}`} style={{ marginLeft: i === 0 ? 0 : -size * 0.35 }}>
          <Avatar name={n} size={size} ring={ring} />
        </View>
      ))}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Feedback & loading
// ---------------------------------------------------------------------------

/** Pulsing placeholder block. */
export function Skeleton({ height = 16, width = '100%', radius: r = 8, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ height, width, borderRadius: r, backgroundColor: c.skeleton, opacity: pulse }, style]} />;
}

/** Generic loading screen: a hero block and a few card placeholders. */
export function Loading({ hero = true, rows = 4 }: { hero?: boolean; rows?: number }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.inner, { maxWidth: MAX_WIDTH, padding: space.lg }]}>
        {hero && <Skeleton height={140} radius={radius.lg} />}
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Skeleton height={14} width="40%" />
            <Skeleton height={12} width="75%" />
          </View>
        ))}
      </View>
    </View>
  );
}

export function EmptyState({ icon = 'golf-outline', title, message, action }: { icon?: IconName; title: string; message?: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', padding: space.xxl, gap: space.sm }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={30} color={c.accentText} />
      </View>
      <Txt variant="heading" style={{ marginTop: space.sm }}>
        {title}
      </Txt>
      {message && <Txt variant="muted" style={{ textAlign: 'center' }}>{message}</Txt>}
      {action}
    </View>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  const c = useColors();
  if (!message) return null;
  return (
    <View style={[styles.banner, { backgroundColor: c.dangerSoft }]}>
      <Ionicons name="alert-circle" size={18} color={c.danger} />
      <Text style={{ color: c.danger, flex: 1, fontFamily: fonts.medium }}>{message}</Text>
    </View>
  );
}

/** Success / info messages show as a toast; use for confirmations. */
export function notify(title: string, message?: string) {
  toast(message ? `${title} · ${message}` : title, 'success');
}

/** Cross-platform confirm dialog. */
export function confirm(title: string, message: string, confirmLabel = 'Confirm'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Wraps an async action, reporting failures as an error toast. */
export async function attempt<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'error');
    return undefined;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  inner: { width: '100%', alignSelf: 'center', gap: space.md },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.sm },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.sm, alignItems: 'center' },
});
