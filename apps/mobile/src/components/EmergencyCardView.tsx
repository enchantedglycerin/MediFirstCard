import { StyleSheet, View } from "react-native";
import { Button, Divider, IconButton, Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { NO_KNOWN_DRUG_ALLERGY, flagKeyOfValue, type CardLine, type CardPayload } from "@mfc/shared";
import { callNumber, callEms, EMERGENCY_NUMBER } from "../lib/phone";
import { formatDate } from "../lib/format";
import { palette, space, radius } from "../theme/tokens";

interface Props {
  payload: Pick<CardPayload, "lines" | "lastReviewedAt">;
  /** Big red "Call 1669" button above the card (rescuer surfaces). */
  showEms?: boolean;
  /** Smaller type for previews. */
  compact?: boolean;
  onCallFailed?: () => void;
}

/** One box per kind, so the label is the group name, not repeated per item. */
const GROUP_LABEL: Record<CardLine["kind"], string> = {
  identity: "card.identity",
  blood: "card.bloodShort",
  allergy: "card.allergies",
  warning: "card.warnings",
  condition: "card.conditions",
  medication: "card.medications",
  contact: "card.contacts",
};

interface Group { kind: CardLine["kind"]; lines: CardLine[] }

/** Consecutive lines of the same kind become one group; the builder already emits kinds in order. */
function groupLines(lines: CardLine[]): Group[] {
  const groups: Group[] = [];
  for (const l of lines) {
    const last = groups[groups.length - 1];
    if (last && last.kind === l.kind) last.lines.push(l);
    else groups.push({ kind: l.kind, lines: [l] });
  }
  return groups;
}

const ICON: Record<CardLine["kind"], keyof typeof MaterialCommunityIcons.glyphMap> = {
  identity: "account",
  blood: "water",
  allergy: "alert-octagon",
  warning: "alert",
  condition: "heart-pulse",
  medication: "pill",
  contact: "phone",
};

/**
 * The one card renderer: red identity header (name + blood group), then lines in
 * "first 60 seconds" order with urgent items in red, and a Call button on every
 * contact. Used by the Card tab, the rescuer preview and the lock-screen preview.
 */
export function EmergencyCardView({ payload, showEms = false, compact = false, onCallFailed }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const identity = payload.lines.find((l) => l.kind === "identity");
  const blood = payload.lines.find((l) => l.kind === "blood");
  const rest = payload.lines.filter((l) => l.kind !== "identity" && l.kind !== "blood");

  const noneKnown = (l: CardLine) => l.kind === "allergy" && l.value === NO_KNOWN_DRUG_ALLERGY;
  const flagOf = (l: CardLine) => (l.kind === "warning" ? flagKeyOfValue(l.value) : null);
  const valueText = (l: CardLine) => {
    if (noneKnown(l)) return t("card.noKnownAllergy");
    const flag = flagOf(l);
    return flag ? t(`profile.flagOptions.${flag}`) : l.value;
  };
  const groups = groupLines(rest);

  async function call(phone: string) {
    if (!(await callNumber(phone))) onCallFailed?.();
  }

  return (
    <View style={styles.wrap}>
      {showEms ? (
        <Button
          mode="contained"
          icon="ambulance"
          buttonColor={palette.emergencyHeader}
          textColor={palette.onEmergencyHeader}
          contentStyle={styles.emsContent}
          labelStyle={styles.emsLabel}
          onPress={() => void callEms().then((ok) => { if (!ok) onCallFailed?.(); })}
          accessibilityLabel={`${t("common.call")} ${EMERGENCY_NUMBER}`}
        >
          {t("card.call1669")}
        </Button>
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text variant="labelMedium" style={styles.headLabel}>{t("card.title")}</Text>
            <Text variant={compact ? "titleLarge" : "headlineSmall"} style={styles.name} numberOfLines={2}>
              {identity?.value ?? t("card.notEntered")}
            </Text>
          </View>
          {blood ? (
            <View style={styles.bloodBox}>
              <Text style={styles.bloodLabel}>{t("card.bloodShort")}</Text>
              <Text style={[styles.blood, blood.urgent && styles.bloodUrgent]}>{blood.value}</Text>
            </View>
          ) : null}
        </View>

        {rest.length === 0 ? (
          <View style={styles.row}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>{t("card.notEntered")}</Text>
          </View>
        ) : (
          groups.map((g, i) => (
            <View key={g.kind}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <MaterialCommunityIcons
                  name={ICON[g.kind]}
                  size={22}
                  color={g.lines.some((l) => l.urgent) ? theme.colors.error : theme.colors.onSurfaceVariant}
                  style={styles.icon}
                />
                <View style={styles.rowText}>
                  <Text variant="labelSmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                    {t(GROUP_LABEL[g.kind])}
                  </Text>
                  {g.lines.map((l, j) => (
                    <View key={j} style={styles.item}>
                      <Text
                        variant={compact ? "bodyLarge" : "titleMedium"}
                        style={[styles.value, l.urgent && { color: theme.colors.error }]}
                      >
                        {valueText(l)}
                      </Text>
                      {l.kind === "contact" && l.phone ? (
                        <IconButton
                          icon="phone"
                          mode="contained"
                          containerColor={theme.colors.primary}
                          iconColor={theme.colors.onPrimary}
                          size={compact ? 20 : 24}
                          onPress={() => void call(l.phone!)}
                          accessibilityLabel={`${t("common.call")} ${l.value}`}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ))
        )}

        <View style={[styles.foot, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("card.selfReported", { date: formatDate(payload.lastReviewedAt, i18n.language) })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  emsContent: { paddingVertical: 8 },
  emsLabel: { fontSize: 18, fontWeight: "700" },
  card: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  head: { backgroundColor: palette.emergencyHeader, padding: space.lg, flexDirection: "row", alignItems: "center", gap: space.md },
  headText: { flex: 1 },
  headLabel: { color: palette.onEmergencyHeader, opacity: 0.85, textTransform: "uppercase", letterSpacing: 1 },
  name: { color: palette.onEmergencyHeader, fontWeight: "700", marginTop: 2 },
  bloodBox: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, alignItems: "center", minWidth: 72 },
  bloodLabel: { color: palette.onEmergencyHeader, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.9 },
  blood: { color: palette.onEmergencyHeader, fontSize: 30, fontWeight: "800", lineHeight: 34 },
  bloodUrgent: { textDecorationLine: "underline" },
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  icon: { width: 24 },
  rowText: { flex: 1 },
  label: { textTransform: "uppercase", letterSpacing: 0.6 },
  value: { fontWeight: "600", marginTop: 2, flexShrink: 1 },
  foot: { paddingHorizontal: space.lg, paddingVertical: space.md },
});
