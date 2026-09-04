import { useCallback, useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Banner, Button, Dialog, Divider, List, Snackbar, Switch, Text, useTheme, Portal } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DEFAULT_LOCK_SCREEN_FIELDS, type LockScreenFields } from "@mfc/shared";
import { api, ApiError, errorKey, profileExists, type EmergencyCard } from "../lib/api";
import { hideLockScreenCard, isLockScreenCardOn, showLockScreenCard } from "../lib/notifications";
import {
  isAutostartConfirmed, isBatteryUnrestricted, keepAliveSteps, markAutostartConfirmed, markKeepAliveAsked,
  openAutostartSettings, openBatterySettings, vendorName, wasKeepAliveAsked, type KeepAliveStep,
} from "../lib/keepAlive";
import { Screen } from "../components/Screen";
import { Section } from "../components/Section";
import { EmergencyCardView } from "../components/EmergencyCardView";
import { palette, radius, space } from "../theme/tokens";

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

  // Phone settings that keep the card alive across restarts; re-read whenever the screen is
  // in front again (the person comes back from the settings page).
  const steps = keepAliveSteps();
  const brand = vendorName() || t("keepAlive.brandOther");
  const [batteryOk, setBatteryOk] = useState<boolean | null>(null);
  const [autostartOk, setAutostartOk] = useState<boolean | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);
  const readKeepAlive = useCallback(async () => {
    const [b, a] = await Promise.all([isBatteryUnrestricted(), isAutostartConfirmed()]);
    setBatteryOk(b);
    setAutostartOk(a);
    return steps.every((s) => (s === "battery" ? b : a));
  }, [steps]);
  useFocusEffect(useCallback(() => { void readKeepAlive(); }, [readKeepAlive]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void readKeepAlive(); });
    return () => sub.remove();
  }, [readKeepAlive]);
  const stepOk = (s: KeepAliveStep) => (s === "battery" ? batteryOk : autostartOk);
  const openStep = (s: KeepAliveStep) => void (s === "battery" ? openBatterySettings() : openAutostartSettings()).then(readKeepAlive);
  const stepTitle = (s: KeepAliveStep) => (s === "battery" ? t("keepAlive.battery") : t("keepAlive.autostart"));
  const stepHint = (s: KeepAliveStep) =>
    s === "battery" ? (batteryOk ? t("keepAlive.batteryHintOk") : t("keepAlive.batteryHintOptimized")) : t("keepAlive.autostartHint");
  const stepStatus = (s: KeepAliveStep) =>
    s === "battery"
      ? (batteryOk ? t("keepAlive.statusBatteryOk") : t("keepAlive.statusBatteryWarn"))
      : (autostartOk ? t("keepAlive.statusAutostartOk") : t("keepAlive.statusAutostartWarn"));

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
      if (ok) {
        setOn(true);
        // Ask once, right when it matters, and only while something still needs doing.
        if (!(await readKeepAlive()) && !(await wasKeepAliveAsked())) {
          await markKeepAliveAsked();
          setKeepOpen(true);
        }
      } else {
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
          {on
            ? steps.map((s) => {
                const ok = stepOk(s);
                if (ok === null) return null;
                return (
                  <View key={s} style={[styles.keepRow, !ok && { backgroundColor: palette.cautionContainer }]}>
                    <MaterialCommunityIcons name={ok ? "check-circle" : "alert"} size={20} color={ok ? palette.normal : palette.caution} />
                    <Text variant="bodyMedium" style={[styles.keepText, { color: ok ? palette.normal : palette.caution }]}>{stepStatus(s)}</Text>
                    {!ok ? <Button compact onPress={() => openStep(s)}>{t("keepAlive.open")}</Button> : null}
                  </View>
                );
              })
            : null}
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

      <Portal>
        <Dialog visible={keepOpen} onDismiss={() => setKeepOpen(false)}>
          <Dialog.Title>{t("keepAlive.title")}</Dialog.Title>
          <Dialog.Content style={styles.keepContent}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{t("keepAlive.intro", { brand })}</Text>
            <View style={[styles.stepRows, { borderColor: theme.colors.outlineVariant }]}>
              {steps.map((s, i) => (
                <View key={s} style={[styles.stepRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outlineVariant }]}>
                  <View style={[styles.stepNo, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepText}>
                    <Text variant="bodyLarge" style={styles.stepTitle}>{stepTitle(s)}</Text>
                    <Text variant="bodySmall" style={{ color: stepOk(s) ? palette.normal : palette.caution }}>{stepHint(s)}</Text>
                  </View>
                  <Button mode="contained-tonal" compact onPress={() => openStep(s)}>{t("keepAlive.open")}</Button>
                </View>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setKeepOpen(false)}>{t("keepAlive.later")}</Button>
            <Button
              mode="contained"
              onPress={() => { setKeepOpen(false); if (steps.includes("autostart")) void markAutostartConfirmed().then(readKeepAlive); }}
            >
              {t("common.done")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
  keepRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingLeft: space.lg, paddingRight: space.sm, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.08)" },
  keepText: { flex: 1 },
  keepContent: { gap: space.md },
  stepRows: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: "hidden" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  stepNo: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepText: { flex: 1, minWidth: 0 },
  stepTitle: { fontWeight: "600" },
});
