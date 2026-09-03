import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useTranslation } from "react-i18next";
import {
  useFonts, Sarabun_400Regular, Sarabun_500Medium, Sarabun_600SemiBold, Sarabun_700Bold,
} from "@expo-google-fonts/sarabun";
import { lightTheme, darkTheme } from "../theme/paper";
import { queryClient } from "../lib/query";
import { useSession } from "../store/session";
import { loadSavedLanguage } from "../i18n";

void SplashScreen.preventAutoHideAsync();

const AUTH_ROUTES = new Set(["login", "register"]);

/**
 * Route guard. Runs on every navigation state change:
 *  - signed out            -> /login (unless already on an auth screen)
 *  - signed in + PIN locked -> /lock
 *  - signed in + unlocked   -> away from login/register/lock to /home
 */
function useAuthGuard() {
  const status = useSession((s) => s.status);
  const pinEnabled = useSession((s) => s.pinEnabled);
  const unlocked = useSession((s) => s.unlocked);
  const segments = useSegments();
  const first = segments[0] as string | undefined;

  useEffect(() => {
    if (status === "loading") return;
    const onAuth = first !== undefined && AUTH_ROUTES.has(first);
    const onLock = first === "lock";
    if (status === "signedOut") {
      if (!onAuth) router.replace("/login");
      return;
    }
    if (pinEnabled && !unlocked) {
      if (!onLock) router.replace("/lock");
      return;
    }
    if (onAuth || onLock || first === undefined) router.replace("/home");
  }, [status, pinEnabled, unlocked, first]);
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const { t } = useTranslation();
  const [fontsLoaded] = useFonts({ Sarabun_400Regular, Sarabun_500Medium, Sarabun_600SemiBold, Sarabun_700Bold });
  const hydrate = useSession((s) => s.hydrate);
  const status = useSession((s) => s.status);
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    void Promise.all([hydrate(), loadSavedLanguage()]).finally(() => setLangReady(true));
  }, [hydrate]);
  useEffect(() => {
    if (fontsLoaded && langReady && status !== "loading") void SplashScreen.hideAsync();
  }, [fontsLoaded, langReady, status]);

  useAuthGuard();

  if (!fontsLoaded || !langReady || status === "loading") return null;
  const theme = scheme === "dark" ? darkTheme : lightTheme;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.colors.surface },
              headerTintColor: theme.colors.onSurface,
              headerTitleStyle: { fontWeight: "700" },
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ title: t("auth.createAccount") }} />
            <Stack.Screen name="consent" options={{ title: t("consent.title"), headerBackVisible: false, gestureEnabled: false }} />
            <Stack.Screen name="lock" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ title: t("profile.title") }} />
            <Stack.Screen name="contacts" options={{ title: t("contacts.title") }} />
            <Stack.Screen name="allergies" options={{ title: t("allergies.title") }} />
            <Stack.Screen name="conditions" options={{ title: t("conditions.title") }} />
            <Stack.Screen name="medications" options={{ title: t("medications.title") }} />
            <Stack.Screen name="lock-screen" options={{ title: t("lockScreen.title") }} />
            <Stack.Screen name="rescuer" options={{ title: t("card.preview") }} />
            <Stack.Screen name="share" options={{ title: t("share.title") }} />
            <Stack.Screen name="record/[id]" options={{ title: t("records.detail") }} />
          </Stack>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
