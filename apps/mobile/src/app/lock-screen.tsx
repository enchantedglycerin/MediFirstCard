import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ActivityIndicator, Banner, Button, Divider, List, Snackbar, Switch, Text, useTheme, Portal } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DEFAULT_LOCK_SCREEN_FIELDS, type LockScreenFields } from "@mfc/shared";
import { api, ApiError, errorKey, profileExists, type EmergencyCard } from "../lib/api";
import { hideLockScreenCard, isLockScreenCardOn, showLockScreenCard } from "../lib/notifications";
import { Screen } from "../components/Screen";
import { Section } from "../components/Section";
import { EmergencyCardView } from "../components/EmergencyCardView";
import { radius, space } from "../theme/tokens";

const FIELD_KEYS: (keyof LockScreenFields)[] = ["name", "bloodType", "allergies", "conditions", "medications", "contact"];

interface Snack {
  text: string;
  action?: { label: string; onPress: () => void };
}

/** Lock-screen card: master on/off (pinned notification), which fields it shows, and a preview. */
export default function LockScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();

  const profile = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const hasProfile = profileExists(profile.data);
  const card = useQuery({ queryKey: ["emergency-card"], queryFn: api.emergencyCard, enabled: hasProfile });

  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<LockScreenFields>(DEFAULT_LOCK_SCREEN_FIELDS);
  const [snack, setSnack] = useState<Snack | null>(null);

  useEffect(() => {
    let alive = true;
    void isLockScreenCardOn().then((v) => { if (alive) setOn(v); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (profile.data?.lockScreenFields) setFields({ ...DEFAULT_LOCK_SCREEN_FIELDS, ...profile.data.lockScreenFields });
  }, [profile.data]);

  const goToProfile = { label: t("card.setUp"), onPress: () => router.push("/profile") };

  /** Post the pinned notification for a payload; false when notifications are not allowed. */
  function pin(payload: Pick<EmergencyCard, "lines" | "lastReviewedAt">): Promise<boolean> {
    return showLockScreenCard({ lines: payload.lines, lastReviewedAt: payload.lastReviewedAt });
  }

  async function toggle(next: boolean) {
    if (busy) return;
    if (!next) {
      setBusy(true);
      try {
        await hideLockScreenCard();
        setOn(false);
      } catch (e) {
        setSnack({ text: t(errorKey(e)) });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!hasProfile) {
      setSnack({ text: t("lockScreen.noProfile"), action: goToProfile });
      return;
    }
    const data = card.data;
    if (!data || data.lines.length === 0) {
      setSnack({ text: t("lockScreen.nothingToShow") });
      return;
    }
    setBusy(true);
    try {
      const ok = await pin(data);
      if (ok) setOn(true);
      else {
        setOn(false);
        setSnack({ text: t("lockScreen.permissionDenied") });
      }
    } catch (e) {
      setOn(false);
      setSnack({ text: t(errorKey(e)) });
    } finally {
      setBusy(false);
    }
  }

  const save = useMutation({
    mutationFn: () => api.setLockScreenFields(fields),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["profile"] }), qc.invalidateQueries({ queryKey: ["emergency-card"] })]);
      const fresh = await card.refetch();
      if (on && fresh.data) {
        if (fresh.data.lines.length === 0) {
          await hideLockScreenCard();
          setOn(false);
          setSnack({ text: t("lockScreen.nothingToShow") });
          return;
        }
        const ok = await pin(fresh.data);
        if (!ok) {
          setOn(false);
          setSnack({ text: t("lockScreen.permissionDenied") });
          return;
        }
      }
      setSnack({ text: t("lockScreen.updated") });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "NO_PROFILE") setSnack({ text: t("lockScreen.noProfile"), action: goToProfile });
      else setSnack({ text: t(errorKey(e)) });
    },
  });

  const loading = profile.isLoading || card.isLoading;
  const statusColor = on ? theme.colors.primary : theme.colors.onSurfaceVariant;

  return (
    <>
      <Screen>
        <Banner visible icon="alert" style={styles.banner}>
          {t("lockScreen.exposureWarning")}
        </Banner>

        <Section title={t("lockScreen.showOnLockScreen")}>
          <List.Item
            title={t("lockScreen.showOnLockScreen")}
            titleStyle={styles.rowTitle}
            description={t("lockScreen.howItWorks")}
            descriptionNumberOfLines={5}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            onPress={() => void toggle(!on)}
            disabled={busy || loading}
            right={() => (
              <View style={styles.switchWrap}>
                {busy ? <ActivityIndicator size="small" /> : (
                  <Switch value={on} onValueChange={(v) => void toggle(v)} disabled={loading} accessibilityLabel={t("lockScreen.showOnLockScreen")} />
                )}
              </View>
            )}
          />
          <Divider />
          <View style={styles.status}>
            <MaterialCommunityIcons name={on ? "check-circle" : "eye-off-outline"} size={22} color={statusColor} />
            <Text variant="bodyLarge" style={[styles.statusText, { color: statusColor }]}>
              {on ? t("lockScreen.shown") : t("lockScreen.hidden")}
            </Text>
          </View>
          {on ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, paddingHorizontal: 16, paddingBottom: 12 }}>
              {t("lockScreen.deviceHint")}
            </Text>
          ) : null}
        </Section>

        <Section title={t("lockScreen.fieldsTitle")}>
          {FIELD_KEYS.map((key, i) => (
            <View key={key}>
              {i > 0 ? <Divider /> : null}
              <List.Item
                title={t(`lockScreen.fields.${key}`)}
                titleStyle={styles.rowTitle}
                onPress={() => setFields((f) => ({ ...f, [key]: !f[key] }))}
                right={() => (
                  <View style={styles.switchWrap}>
                    <Switch
                      value={fields[key]}
                      onValueChange={(v) => setFields((f) => ({ ...f, [key]: v }))}
                      accessibilityLabel={t(`lockScreen.fields.${key}`)}
                    />
                  </View>
                )}
              />
            </View>
          ))}
          <Divider />
          <View style={styles.saveWrap}>
            <Button
              mode="contained"
              icon="content-save-outline"
              contentStyle={styles.btnContent}
              onPress={() => save.mutate()}
              loading={save.isPending}
              disabled={save.isPending || loading}
            >
              {t("common.save")}
            </Button>
          </View>
        </Section>

        <Section title={t("lockScreen.preview")} card={false}>
          {loading ? (
            <ActivityIndicator style={styles.previewLoading} />
          ) : card.data ? (
            <EmergencyCardView compact payload={card.data} />
          ) : (
            <Text variant="bodyLarge" style={[styles.previewText, { color: theme.colors.onSurfaceVariant }]}>
              {hasProfile ? t(errorKey(card.error)) : t("lockScreen.noProfile")}
            </Text>
          )}
        </Section>
      </Screen>

      <Portal><Snackbar
        visible={snack !== null}
        onDismiss={() => setSnack(null)}
        duration={4000}
        action={snack?.action}
      >
        {snack?.text ?? ""}
      </Snackbar></Portal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.lg, overflow: "hidden" },
  rowTitle: { fontSize: 17 },
  switchWrap: { justifyContent: "center", minHeight: 48, paddingLeft: space.sm },
  status: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  statusText: { flex: 1 },
  saveWrap: { padding: space.lg },
  btnContent: { minHeight: 48 },
  previewLoading: { marginVertical: space.lg },
  previewText: { textAlign: "center", paddingVertical: space.lg },
});
