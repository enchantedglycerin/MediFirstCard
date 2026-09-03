import { useRef, useState } from "react";
import { StyleSheet, View, type TextInput as RNTextInput } from "react-native";
import { router } from "expo-router";
import { Button, HelperText, Text, TextInput, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { Screen } from "../components/Screen";
import { api, ApiError, errorKey } from "../lib/api";
import { useSession } from "../store/session";
import { space, touch } from "../theme/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

interface FieldErrors { email?: string; password?: string; confirm?: string; form?: string }

/** Account creation: email, password (+confirm) -> sign in -> consent screen. */
export default function Register() {
  const { t } = useTranslation();
  const theme = useTheme();
  const signIn = useSession((s) => s.signIn);
  const passwordRef = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  function clear(field: keyof FieldErrors) {
    if (errors[field] || errors.form) setErrors((prev) => ({ ...prev, [field]: undefined, form: undefined }));
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = t("auth.invalidEmail");
    if (password.length < MIN_PASSWORD) next.password = t("auth.passwordShort");
    if (confirm !== password) next.confirm = t("auth.passwordMismatch");
    setErrors(next);
    return !next.email && !next.password && !next.confirm;
  }

  async function submit() {
    if (busy || !validate()) return;
    setBusy(true);
    try {
      const res = await api.register(email.trim(), password);
      await signIn(res);
      router.replace("/consent");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setErrors({ email: t("auth.emailTaken") });
      else setErrors({ form: t(errorKey(e)) });
    } finally {
      setBusy(false);
    }
  }

  function backToLogin() {
    if (router.canGoBack()) router.back();
    else router.replace("/login");
  }

  const eye = (
    <TextInput.Icon
      icon={showPassword ? "eye-off-outline" : "eye-outline"}
      onPress={() => setShowPassword((v) => !v)}
      forceTextInputFocus={false}
      accessibilityLabel={t(showPassword ? "auth.hidePassword" : "auth.showPassword")}
    />
  );

  return (
    <Screen style={styles.container} gap={space.lg}>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>{t("app.tagline")}</Text>

      <View style={styles.form}>
        <TextInput
          mode="outlined"
          label={t("auth.email")}
          value={email}
          onChangeText={(v) => { setEmail(v); clear("email"); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={!!errors.email}
          editable={!busy}
          left={<TextInput.Icon icon="email-outline" />}
        />
        {errors.email ? <HelperText type="error" visible>{errors.email}</HelperText> : null}

        <TextInput
          ref={passwordRef}
          mode="outlined"
          label={t("auth.password")}
          value={password}
          onChangeText={(v) => { setPassword(v); clear("password"); }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => confirmRef.current?.focus()}
          error={!!errors.password}
          editable={!busy}
          left={<TextInput.Icon icon="lock-outline" />}
          right={eye}
        />
        <HelperText type={errors.password ? "error" : "info"} visible>
          {errors.password ?? t("auth.passwordHint")}
        </HelperText>

        <TextInput
          ref={confirmRef}
          mode="outlined"
          label={t("auth.confirmPassword")}
          value={confirm}
          onChangeText={(v) => { setConfirm(v); clear("confirm"); }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={!!errors.confirm}
          editable={!busy}
          left={<TextInput.Icon icon="lock-check-outline" />}
          right={eye}
        />
        {errors.confirm ? <HelperText type="error" visible>{errors.confirm}</HelperText> : null}
        {errors.form ? <HelperText type="error" visible>{errors.form}</HelperText> : null}

        <Button
          mode="contained"
          onPress={() => void submit()}
          loading={busy}
          disabled={busy}
          style={styles.primary}
          contentStyle={styles.btnContent}
          labelStyle={styles.btnLabel}
        >
          {t("auth.createAccount")}
        </Button>
        <Button mode="text" onPress={backToLogin} disabled={busy} contentStyle={styles.btnContent}>
          {t("auth.haveAccount")}
        </Button>
      </View>

      <Text variant="bodySmall" style={[styles.disclaimer, { color: theme.colors.onSurfaceVariant }]}>
        {t("app.disclaimer")}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  form: { gap: space.sm },
  primary: { marginTop: space.md },
  btnContent: { minHeight: touch.min, paddingVertical: space.xs },
  btnLabel: { fontSize: 17, lineHeight: 24 },
  disclaimer: { textAlign: "center", paddingHorizontal: space.md, marginTop: "auto" },
});
