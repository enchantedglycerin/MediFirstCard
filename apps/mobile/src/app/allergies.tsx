import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Banner, Button, Portal, Snackbar, Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AllergyInput } from "@mfc/shared";
import { Screen } from "../components/Screen";
import { EmptyState } from "../components/EmptyState";
import { CollectionEditor, type FieldSpec, type Values } from "../components/CollectionEditor";
import { api, errorKey, type AllergyDto } from "../lib/api";
import { invalidateAfterEdit } from "../lib/refresh";
import { palette, radius, space } from "../theme/tokens";

const CATEGORIES = ["medication", "food", "environment"] as const;
const SEVERITIES = ["mild", "moderate", "severe"] as const;

/** Trimmed text out of a dialog value (switch values never map to text). */
const text = (v: Values[string]): string => (v === undefined || typeof v === "boolean" ? "" : String(v)).trim();
/** Narrow a dialog value to one of the schema enums. */
const pick = <T extends string>(allowed: readonly T[], v: Values[string], fallback: T): T =>
  allowed.find((a) => a === v) ?? fallback;

/** Dialog values -> API input. Cleared optional fields are sent as undefined (the server stores null). */
function toInput(v: Values): Partial<AllergyInput> {
  return {
    substanceTh: text(v.substanceTh) || undefined,
    substanceEn: text(v.substanceEn) || undefined,
    category: pick(CATEGORIES, v.category, "medication"),
    reaction: text(v.reaction) || undefined,
    severity: pick(SEVERITIES, v.severity, "moderate"),
    source: "self",
  };
}

/**
 * Allergies list. While it is empty the empty state asks one question with two answers:
 * add an allergy, or say there is none known. "None known" becomes a calm confirmation
 * that disappears by itself as soon as an allergy is listed (the server clears the flag).
 */
export default function Allergies() {
  const { t } = useTranslation();
  const theme = useTheme();
  const allergies = useQuery({ queryKey: ["allergies"], queryFn: api.listAllergies });
  const profile = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => invalidateAfterEdit("allergies");
  const noneKnown = !!profile.data?.noKnownDrugAllergy;
  const setNoneKnown = useMutation({
    mutationFn: (value: boolean) => api.setNoKnownDrugAllergy(value),
    onSuccess: () => refresh(),
    onError: (e) => setMsg(t(errorKey(e))),
  });

  const fields: FieldSpec[] = [
    { key: "substanceTh", label: t("allergies.substanceTh"), type: "text" },
    { key: "substanceEn", label: t("allergies.substanceEn"), type: "text" },
    {
      key: "category",
      label: t("allergies.category"),
      type: "select",
      options: CATEGORIES.map((c) => ({ value: c, label: t(`allergies.categories.${c}`) })),
    },
    { key: "reaction", label: t("allergies.reaction"), type: "text" },
    {
      key: "severity",
      label: t("allergies.severity"),
      type: "select",
      initial: "moderate",
      options: SEVERITIES.map((s) => ({ value: s, label: t(`allergies.severities.${s}`) })),
    },
  ];

  const renderEmpty = (openAdd: () => void) =>
    noneKnown ? (
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <View style={[styles.status, { backgroundColor: palette.normalContainer }]}>
          <View style={[styles.tick, { backgroundColor: palette.normal }]}>
            <MaterialCommunityIcons name="check" size={22} color={palette.onEmergencyHeader} />
          </View>
          <View style={styles.statusText}>
            <Text variant="titleMedium" style={styles.statusTitle}>{t("allergies.noneKnownTitle")}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{t("allergies.noneKnownShown")}</Text>
          </View>
        </View>
        <View style={[styles.actions, { borderTopColor: theme.colors.outlineVariant }]}>
          <Button mode="text" onPress={() => setNoneKnown.mutate(false)} disabled={setNoneKnown.isPending}>{t("common.undo")}</Button>
          <Button mode="contained-tonal" icon="plus" onPress={openAdd}>{t("allergies.add")}</Button>
        </View>
      </View>
    ) : (
      <EmptyState
        icon="alert-octagon-outline"
        title={t("allergies.empty")}
        hint={t("allergies.emptyHint")}
        actionLabel={t("allergies.add")}
        onAction={openAdd}
        secondaryLabel={t("allergies.noneKnownAction")}
        onSecondary={() => setNoneKnown.mutate(true)}
      />
    );

  return (
    <Screen>
      {allergies.isError ? (
        <Banner
          visible
          icon="alert-circle-outline"
          actions={[{ label: t("common.retry"), onPress: () => void allergies.refetch() }]}
        >
          {t(errorKey(allergies.error))}
        </Banner>
      ) : null}

      {allergies.isError && !allergies.data ? null : (
        <CollectionEditor<AllergyDto>
          items={allergies.data}
          loading={allergies.isPending || profile.isPending}
          fields={fields}
          toValues={(a) => ({
            substanceTh: a.substanceTh ?? "",
            substanceEn: a.substanceEn ?? "",
            category: a.category,
            reaction: a.reaction ?? "",
            severity: a.severity,
          })}
          title={(a) => a.substanceTh || a.substanceEn || ""}
          description={(a) => [t(`allergies.categories.${a.category}`), a.reaction].filter(Boolean).join(" · ") || undefined}
          badge={(a) => t(`allergies.severities.${a.severity}`)}
          badgeUrgent={(a) => a.severity === "severe"}
          icon="alert-octagon-outline"
          emptyTitle={t("allergies.empty")}
          emptyHint={t("allergies.emptyHint")}
          addLabel={t("allergies.add")}
          editLabel={t("allergies.edit")}
          renderEmpty={renderEmpty}
          validate={(v) => (text(v.substanceTh) || text(v.substanceEn) ? null : { substanceTh: t("allergies.needSubstance") })}
          onCreate={async (v) => {
            await api.addAllergy(toInput(v));
            await refresh();
          }}
          onUpdate={async (id, v) => {
            await api.updateAllergy(id, toInput(v));
            await refresh();
          }}
          onDelete={async (id) => {
            await api.deleteAllergy(id);
            await refresh();
          }}
        />
      )}

      <Portal>
        <Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={4000}>{msg ?? ""}</Snackbar>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  status: { flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.lg },
  tick: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statusText: { flex: 1, gap: 2 },
  statusTitle: { fontWeight: "700" },
  actions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: space.xs, padding: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
