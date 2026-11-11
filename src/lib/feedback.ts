import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Light haptic taps. No-ops on web. */
export const haptic = {
  tap: () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  },
  press: () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success: () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error: () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};

export type ToastTone = 'success' | 'error' | 'info';
export interface ToastMessage {
  id: number;
  text: string;
  tone: ToastTone;
}

type Listener = (t: ToastMessage) => void;
let listener: Listener | null = null;
let nextId = 1;

/** Registered by <ToastHost/>. */
export function setToastListener(l: Listener | null) {
  listener = l;
}

/** Shows a short message at the bottom of the screen. Callable from anywhere. */
export function toast(text: string, tone: ToastTone = 'success') {
  if (tone === 'success') haptic.success();
  if (tone === 'error') haptic.error();
  listener?.({ id: nextId++, text, tone });
}
