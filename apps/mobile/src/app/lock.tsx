import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Button, HelperText, IconButton, Portal, Snackbar, Text, TextInput, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Screen } from "../components/Screen";
import { verifyPin } from "../lib/pin";
import { useSession } from "../store/session";
import { space, touch } from "../theme/tokens";

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;

/**
 * PIN gate. The root guard sends a signed-in user here on every cold start while a PIN is set,
 * and routes to /home as soon as `unlocked` flips. Five wrong PINs sign the user out.
 */
export default function Lock() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const email = useSession((s) => s.email);
  const setUnlocked = useSession((s) => s.setUnlocked);
  const signOut = useSession((s) => s.signOut);

  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lockedOut, setLockedOut] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [biometricReady, setBiometricReady] = useState(false);
  const prompting = useRef(false);
  const autoPrompted = useRef(false);

  const attemptsLeft = MAX_ATTEMPTS - attempts;
  const canSubmit = pin.length === PIN_LENGTH && !busy && !lockedOut;

  const tryBiometric = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: t("security.biometricPrompt"),
        cancelLabel: t("common.cancel"),
      });
      if (res.success) setUnlocked(true);
    } catch {
      // Biometric prompt unavailable: the PIN field stays as the fallback.
    } finally {
      prompting.current = false;
    }
  }, [t, setUnlocked]);

  // Offer biometrics once on mount when the device has enrolled fingerprint/face data.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [hardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (cancelled || !hardware || !enrolled) return;
        setBiometricReady(true);
        if (!autoPrompted.current) {
          autoPrompted.current = true;
          void tryBiometric();
        }
      } catch {
        // No biometrics on this device.
      }
    })();
    return () => { cancelled = true; };
  }, [tryBiometric]);

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setFailure(null);
    try {
      if (await verifyPin(pin)) {
        setUnlocked(true);
        return;
      }
      const next = attempts + 1;
      setAttempts(next);
      setPin("");
      if (next >= MAX_ATTEMPTS) {
        setWrong(false);
        setLockedOut(true);
        return;
      }
      setWrong(true);
    } catch {
      setFailure(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      style={{ ...styles.container, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }}
      gap={space.lg}
    >
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="lock-outline" size={44} color={theme.colors.onPrimaryContainer} />
          </View>
          <Text variant="headlineSmall" style={styles.title}>{t("security.enterPin")}</Text>
          {email ? (
            <Text variant="bodyMedium" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
              {t("more.signedInAs")} {email}
            </Text>
          ) : null}
        </View>

        <View style={styles.form}>
          <TextInput
            mode="outlined"
            label={t("security.pin")}
            value={pin}
            onChangeText={(v) => {
              setPin(v.replace(/\D/g, "").slice(0, PIN_LENGTH));
              setWrong(false);
              setFailure(null);
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_LENGTH}
            autoComplete="off"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            editable={!busy && !lockedOut}
            error={wrong}
            accessibilityLabel={t("security.enterPin")}
            contentStyle={styles.pinText}
            left={<TextInput.Icon icon="dialpad" />}
          />
          {wrong ? (
            <HelperText type="error" visible>
              {t("security.wrongPin")}. {t("security.attemptsLeft", { count: attemptsLeft })}
            </HelperText>
          ) : null}
          {failure ? <HelperText type="error" visible>{failure}</HelperText> : null}

          <Button
            mode="contained"
            onPress={() => void submit()}
            loading={busy}
            disabled={!canSubmit}
            style={styles.primary}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
          >
            {t("security.unlock")}
          </Button>
        </View>

        {biometricReady ? (
          <View style={styles.bio}>
            <IconButton
              icon="fingerprint"
              mode="contained-tonal"
              size={36}
              onPress={() => void tryBiometric()}
              disabled={busy || lockedOut}
              accessibilityLabel={t("security.biometric")}
            />
            <Text variant="bodyMedium" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
              {t("security.biometric")}
            </Text>
          </View>
        ) : null}
      </View>

      <Text variant="bodySmall" style={[styles.center, { color: theme.colors.onSurfaceVariant }]}>
        {t("security.pinHint")}
      </Text>

      <Portal>
        <Snackbar
          visible={lockedOut}
          onDismiss={() => void signOut()}
          duration={3000}
          action={{ label: t("common.ok") }}
        >
          {t("security.lockedOut")}
        </Snackbar>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  body: { flex: 1, justifyContent: "center", gap: space.xxl },
  head: { alignItems: "center", gap: space.sm },
  badge: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: space.sm },
  title: { fontWeight: "700", textAlign: "center" },
  center: { textAlign: "center" },
  form: { gap: space.sm },
  pinText: { fontSize: 28, letterSpacing: 12, textAlign: "center" },
  primary: { marginTop: space.md },
  btnContent: { minHeight: touch.min, paddingVertical: space.xs },
  btnLabel: { fontSize: 17, lineHeight: 24 },
  bio: { alignItems: "center", gap: space.xs },
});
