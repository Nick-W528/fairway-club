import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setToastListener, type ToastMessage } from '@/lib/feedback';
import { fonts, radius, space, useColors } from '@/theme';

/** Renders toasts raised with `toast()`. Mount once near the root. */
export function ToastHost() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setToastListener((t) => {
      if (timer.current) clearTimeout(timer.current);
      setCurrent(t);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setCurrent(null));
      }, 2600);
    });
    return () => setToastListener(null);
  }, [anim]);

  if (!current) return null;
  const icon = current.tone === 'success' ? 'checkmark-circle' : current.tone === 'error' ? 'alert-circle' : 'information-circle';
  const iconColor = current.tone === 'error' ? c.danger : c.accent;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center' }]}>
      <Animated.View
        style={{
          marginBottom: insets.bottom + 72,
          marginHorizontal: space.lg,
          maxWidth: 480,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          backgroundColor: c.hero,
          borderColor: c.heroBorder,
          borderWidth: 1,
          borderRadius: radius.pill,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
        }}>
        <Ionicons name={icon} size={20} color={iconColor} />
        <Text style={{ color: c.heroText, fontFamily: fonts.medium, fontSize: 14 }}>{current.text}</Text>
      </Animated.View>
    </View>
  );
}
