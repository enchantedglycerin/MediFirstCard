import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button, Checkbox, Divider, Portal, Snackbar, Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen } from "../components/Screen";
import { Section } from "../components/Section";
import { api, errorKey } from "../lib/api";
import { space, touch } from "../theme/tokens";

const CONSENT_VERSION = 1;

/** First-run consent (PDPA): health-data storage is required, AI document reading is optional. */
export default function Consent() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [health, setHealth] = useState(false);
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agree() {
    if (!health || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.postConsent(CONSENT_VERSION, { lockScreen: true, records: true, ai }, true);
      router.replace("/home");
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={styles.container} gap={space.lg}>
      <View style={styles.intro}>
        <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={32} color={theme.colors.onPrimaryContainer} />
        </View>
        <Text variant="bodyLarge" style={styles.introText}>{t("consent.intro")}</Text>
      </View>

      <Section>
        <Checkbox.Item
          label={`${t("consent.healthData")} (${t("common.required")})`}
          status={health ? "checked" : "unchecked"}
          onPress={() => setHealth((v) => !v)}
          disabled={busy}
          position="leading"
          mode="android"
          labelVariant="bodyLarge"
          labelStyle={styles.label}
          style={styles.row}
        />
        <Divider />
        <Checkbox.Item
          label={`${t("consent.aiProvider")} (${t("common.optional")})`}
          status={ai ? "checked" : "unchecked"}
          onPress={() => setAi((v) => !v)}
          disabled={busy}
          position="leading"
          mode="android"
          labelVariant="bodyLarge"
          labelStyle={styles.label}
          style={styles.row}
        />
      </Section>

      <Text variant="bodyMedium" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
        {t("consent.retention")}
      </Text>
      <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
        {t("app.disclaimer")}
      </Text>

      <Button
        mode="contained"
        onPress={() => void agree()}
        loading={busy}
        disabled={!health || busy}
        style={styles.primary}
        contentStyle={styles.btnContent}
        labelStyle={styles.btnLabel}
      >
        {t("consent.agree")}
      </Button>

      <Portal>
        <Snackbar visible={!!error} onDismiss={() => setError(null)} duration={4000} action={{ label: t("common.ok") }}>
          {error ?? ""}
        </Snackbar>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  intro: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.xs },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  introText: { flex: 1 },
  row: { minHeight: touch.min, paddingVertical: space.sm },
  label: { textAlign: "left", lineHeight: 24 },
  note: { paddingHorizontal: space.xs },
  primary: { marginTop: "auto" },
  btnContent: { minHeight: touch.min, paddingVertical: space.xs },
  btnLabel: { fontSize: 17, lineHeight: 24 },
});
