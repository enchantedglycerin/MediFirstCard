import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { AppState, useColorScheme } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider, Portal, Snackbar } from "react-native-paper";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useTranslation } from "react-i18next";
import {
  useFonts, Sarabun_400Regular, Sarabun_500Medium, Sarabun_600SemiBold, Sarabun_700Bold,
} from "@expo-google-fonts/sarabun";
import { lightTheme, darkTheme } from "../theme/paper";
import { queryClient } from "../lib/query";
import { api } from "../lib/api";
import { ensureLockScreenCardPinned, requestAllPermissionsOnce } from "../lib/notifications";
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

/**
 * Background chores that need the providers mounted:
 *  - warm the API as soon as the app opens (the free Render instance sleeps after 15 min)
 *    and tell the user when it is cold instead of leaving a silent spinner;
 *  - re-pin the lock-screen card, which Android drops on app update/reinstall or "clear all".
 */
function StartupServices() {
  const { t } = useTranslation();
  const status = useSession((s) => s.status);
  const unlocked = useSession((s) => s.unlocked);
  const apiBaseUrl = useSession((s) => s.apiBaseUrl);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    let settled = false;
    const slow = setTimeout(() => { if (!settled) setWaking(true); }, 3000);
    fetch(`${apiBaseUrl}/health`)
      .catch(() => undefined)
      .finally(() => { settled = true; clearTimeout(slow); setWaking(false); });
    return () => clearTimeout(slow);
  }, [apiBaseUrl]);

  useEffect(() => {
    if (status !== "signedIn" || !unlocked) return;
    // On a cold launch always re-post from the server: after an app update the native receiver
    // brings back the last stored text, which may predate the update or an edit made elsewhere.
    const repin = (force: boolean) => {
      console.log(`[lockcard] checking pinned card (${force ? "launch" : "resume"})`);
      void ensureLockScreenCardPinned(async () => {
        const c = await api.emergencyCard();
        return { lines: c.lines, lastReviewedAt: c.lastReviewedAt };
      }, { force });
    };
    // First signed-in launch: ask for notifications, camera and photos up front, then re-pin.
    // Wait for the first frame: a system permission dialog raised while the splash is still up
    // can leave the app behind the splash window (seen on One UI 5 / Android 13), so ask a
    // moment later and hide the splash once more afterwards, which is harmless if already hidden.
    const ask = setTimeout(() => {
      void requestAllPermissionsOnce().finally(() => { void SplashScreen.hideAsync(); repin(true); });
    }, 600);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") repin(false); });
    return () => { clearTimeout(ask); sub.remove(); };
  }, [status, unlocked]);

  return (
    <Portal>
      <Snackbar visible={waking} onDismiss={() => setWaking(false)} duration={60000}>
        {t("errors.serverWaking")}
      </Snackbar>
    </Portal>
  );
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
            <Stack.Screen name="alerts" options={{ title: t("alerts.title") }} />
            <Stack.Screen name="record/[id]" options={{ title: t("records.detail") }} />
          </Stack>
          <StartupServices />
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
