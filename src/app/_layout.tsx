import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import { ToastHost } from '@/components/toast-host';
import { AuthProvider, useAuth } from '@/providers/auth';
import { ClubProvider, useClub } from '@/providers/club';
import { AppThemeProvider, fonts, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Applies the selected club's brand colour to the theme. */
function BrandedTheme({ children }: { children: ReactNode }) {
  const { club } = useClub();
  return <AppThemeProvider brand={club?.brand_color}>{children}</AppThemeProvider>;
}

function RootStack() {
  const { initialising } = useAuth();
  const { colors: c, mode } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const ready = !initialising && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const navTheme = mode === 'dark' ? DarkTheme : DefaultTheme;

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.background }} />;

  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: { ...navTheme.colors, background: c.background, card: c.surface, text: c.text, border: c.border, primary: c.accentText },
      }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.background },
            headerShadowVisible: false,
            headerTintColor: c.text,
            headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
            contentStyle: { backgroundColor: c.background },
          }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
          <Stack.Screen name="clubs" options={{ title: 'Your clubs' }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
        <ToastHost />
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ClubProvider>
        <BrandedTheme>
          <RootStack />
        </BrandedTheme>
      </ClubProvider>
    </AuthProvider>
  );
}
