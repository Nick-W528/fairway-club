import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

/**
 * "Modern sport" design system.
 * Light: pale sage canvas, white cards, near-black hero cards, lime accent.
 * Dark: green-tinted near-black canvas, forest-green cards, same lime accent.
 * A club can override the accent with its own brand colour.
 */

const LIME = '#C6F432';

const light = {
  background: '#F3F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#E8ECE7',
  border: '#DFE5DF',
  text: '#0E1A12',
  textMuted: '#5D6B61',
  /** Dark "hero" cards (next round, bar card) */
  hero: '#0E1A12',
  heroBorder: '#0E1A12',
  heroText: '#FFFFFF',
  heroMuted: '#B8C4BB',
  accent: LIME,
  onAccent: '#0E1A12',
  /** Accent used as text/icon on the normal surface (lime is unreadable on white) */
  accentText: '#3F6B00',
  accentSoft: '#EAF8C4',
  primary: '#0E1A12',
  primaryText: '#FFFFFF',
  primarySoft: '#E3E9E4',
  danger: '#C2261D',
  dangerSoft: '#FBE1DE',
  warning: '#8A5A00',
  warningSoft: '#FCEBC5',
  success: '#1E7A3C',
  successSoft: '#D7F0DE',
  skeleton: '#E2E8E3',
  tabBar: '#FFFFFF',
  overlay: 'rgba(8,14,10,0.45)',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0B1310',
  surface: '#13201A',
  surfaceAlt: '#1A2A21',
  border: '#22362A',
  text: '#E6EDE7',
  textMuted: '#8FA095',
  hero: '#1C3326',
  heroBorder: '#2C4A37',
  heroText: '#F2F6F2',
  heroMuted: '#9DB3A4',
  accent: LIME,
  onAccent: '#0B1310',
  accentText: LIME,
  accentSoft: '#25381C',
  primary: LIME,
  primaryText: '#0B1310',
  primarySoft: '#1E3527',
  danger: '#FF8A80',
  dangerSoft: '#3D1715',
  warning: '#F2C46D',
  warningSoft: '#3A2B0B',
  success: '#7FD3A0',
  successSoft: '#163323',
  skeleton: '#1C2B23',
  tabBar: '#101A15',
  overlay: 'rgba(0,0,0,0.6)',
};

export const fonts = {
  display: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const MAX_WIDTH = 760;

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Applies a club's brand colour as the accent, picking readable text on top. */
function withBrand(p: Palette, brand: string | null | undefined, mode: 'light' | 'dark'): Palette {
  if (!brand || !/^#[0-9A-Fa-f]{6}$/.test(brand)) return p;
  const isLight = luminance(brand) > 0.35;
  const on = isLight ? '#0E1A12' : '#FFFFFF';
  return {
    ...p,
    accent: brand,
    onAccent: on,
    // On light surfaces a pale brand colour can't be used for text; fall back to the default.
    accentText: mode === 'light' ? (isLight ? p.accentText : brand) : isLight ? brand : p.accentText,
    ...(mode === 'dark' ? { primary: brand, primaryText: on } : {}),
  };
}

// ---------------------------------------------------------------------------
// Theme preference (System / Light / Dark) + club brand
// ---------------------------------------------------------------------------

export type ThemePreference = 'system' | 'light' | 'dark';
const PREF_KEY = 'golfapp.theme';

interface ThemeState {
  colors: Palette;
  mode: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/** `brand` is the current club's brand colour (if any). */
export function AppThemeProvider({ children, brand }: { children: ReactNode; brand?: string | null }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
      })
      .catch(() => {});
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPref(p);
    AsyncStorage.setItem(PREF_KEY, p).catch(() => {});
  };

  const mode: 'light' | 'dark' = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const colors = useMemo(() => withBrand(mode === 'dark' ? dark : light, brand, mode), [mode, brand]);

  return createElement(
    ThemeContext.Provider,
    { value: { colors, mode, preference, setPreference } },
    children,
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside AppThemeProvider');
  return ctx;
}

export function useColors(): Palette {
  return useTheme().colors;
}
