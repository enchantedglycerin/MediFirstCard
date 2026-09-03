import { useRef, useState } from "react";
import { StyleSheet, View, type TextInput as RNTextInput } from "react-native";
import { router } from "expo-router";
import { Button, HelperText, Text, TextInput, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Screen } from "../components/Screen";
import { api, ApiError, errorKey } from "../lib/api";
import { useSession } from "../store/session";
import { space, touch } from "../theme/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Sign-in screen: brand block, email + password, link to registration. No header (hidden by the root layout). */
export default function Login() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const signIn = useSession((s) => s.signIn);
  const passwordRef = useRef<RNTextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const trimmed = email.trim();
    setFormError(null);
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError(t("auth.invalidEmail"));
      return;
    }
    setEmailError(null);
    if (password.length === 0) {
      setFormError(t("errors.required"));
      return;
    }
    setBusy(true);
    try {
      const res = await api.login(trimmed, password);
      await signIn(res);
      router.replace("/home");
    } catch (e) {
      setFormError(e instanceof ApiError && e.status === 401 ? t("auth.wrongCredentials") : t(errorKey(e)));
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
        <View style={styles.brand}>
          <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="card-account-details" size={44} color={theme.colors.onPrimaryContainer} />
          </View>
          <Text variant="headlineMedium" style={styles.appName}>{t("app.name")}</Text>
          <Text variant="bodyLarge" style={[styles.tagline, { color: theme.colors.onSurfaceVariant }]}>
            {t("app.tagline")}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            mode="outlined"
            label={t("auth.email")}
            value={email}
            onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={!!emailError}
            editable={!busy}
            left={<TextInput.Icon icon="email-outline" />}
          />
          {emailError ? <HelperText type="error" visible>{emailError}</HelperText> : null}

          <TextInput
            ref={passwordRef}
            mode="outlined"
            label={t("auth.password")}
            value={password}
            onChangeText={(v) => { setPassword(v); if (formError) setFormError(null); }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            error={!!formError}
            editable={!busy}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off-outline" : "eye-outline"}
                onPress={() => setShowPassword((v) => !v)}
                forceTextInputFocus={false}
                accessibilityLabel={t(showPassword ? "auth.hidePassword" : "auth.showPassword")}
              />
            }
          />
          {formError ? <HelperText type="error" visible>{formError}</HelperText> : null}

          <Button
            mode="contained"
            onPress={() => void submit()}
            loading={busy}
            disabled={busy}
            style={styles.primary}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
          >
            {t("auth.login")}
          </Button>
          <Button mode="text" onPress={() => router.push("/register")} disabled={busy} contentStyle={styles.btnContent}>
            {t("auth.noAccount")}
          </Button>
        </View>
      </View>

      <Text variant="bodySmall" style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}>
        {t("app.disclaimer")}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  body: { flex: 1, justifyContent: "center", gap: space.xxl },
  brand: { alignItems: "center", gap: space.sm },
  badge: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: space.sm },
  appName: { fontWeight: "700", textAlign: "center" },
  tagline: { textAlign: "center" },
  form: { gap: space.sm },
  primary: { marginTop: space.md },
  btnContent: { minHeight: touch.min, paddingVertical: space.xs },
  btnLabel: { fontSize: 17, lineHeight: 24 },
  disclaimer: { textAlign: "center", paddingHorizontal: space.md },
});
