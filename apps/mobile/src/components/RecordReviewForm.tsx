import { useState } from "react";
import { ScrollView, StyleSheet, View, type KeyboardTypeOptions } from "react-native";
import {
  Banner, Button, Chip, HelperText, Portal, Snackbar, Text, TextInput, useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  recordKind, kindFromDocumentType, defaultValidUntil, type RecordKind, type ReviewedRecordInput,
} from "@mfc/shared";
import { api, errorKey, fieldValue, type ExtractResult, type RecordDto } from "../lib/api";
import { daysUntil, isValidIsoDate } from "../lib/format";
import { Section } from "./Section";
import { palette, paletteDark, space } from "../theme/tokens";

type Band = ExtractResult["fieldMeta"][string]["band"];
type Icon = keyof typeof MaterialCommunityIcons.glyphMap;
interface Tone { bg: string; fg: string }

/** Status colour roles (normal / caution / urgent / neutral) that follow the light or dark Paper theme. */
export function useStatusTones(): { normal: Tone; caution: Tone; urgent: Tone; neutral: Tone } {
  const theme = useTheme();
  const p = theme.dark ? paletteDark : palette;
  return {
    normal: { bg: p.normalContainer, fg: p.normal },
    caution: { bg: p.cautionContainer, fg: p.caution },
    urgent: { bg: theme.colors.errorContainer, fg: theme.colors.onErrorContainer },
    neutral: { bg: theme.colors.surfaceVariant, fg: theme.colors.onSurfaceVariant },
  };
}

function ToneChip({ tone, icon, children }: { tone: Tone; icon?: Icon; children: string }) {
  return (
    <Chip compact icon={icon} selectedColor={tone.fg} style={[styles.chip, { backgroundColor: tone.bg }]} textStyle={styles.chipText}>
      {children}
    </Chip>
  );
}

/** Record status pill: reviewed = normal, uploaded/extracted = caution (still needs a human look). */
export function StatusChip({ status }: { status: RecordDto["status"] }) {
  const { t } = useTranslation();
  const tones = useStatusTones();
  const tone = status === "reviewed" ? tones.normal : status === "pending" ? tones.neutral : tones.caution;
  return <ToneChip tone={tone}>{t(`records.status.${status}`)}</ToneChip>;
}

/** Expiry pill from validUntil: past = urgent, within 14 days = caution, otherwise nothing. */
export function ExpiryChip({ validUntil }: { validUntil: string | null | undefined }) {
  const { t } = useTranslation();
  const tones = useStatusTones();
  const days = daysUntil(validUntil);
  if (days === null) return null;
  if (days < 0) return <ToneChip tone={tones.urgent} icon="calendar-remove">{t("records.expired")}</ToneChip>;
  if (days <= 14) return <ToneChip tone={tones.caution} icon="calendar-clock">{t("records.expiresSoon")}</ToneChip>;
  return null;
}

const BAND_ICON: Record<Band, Icon> = {
  high: "check-circle-outline",
  medium: "alert-circle-outline",
  low: "alert-octagon-outline",
  none: "help-circle-outline",
};

function ConfidenceChip({ band }: { band: Band | undefined }) {
  const { t } = useTranslation();
  const tones = useStatusTones();
  if (!band) return null;
  const tone = band === "high" ? tones.normal : band === "medium" ? tones.caution : band === "low" ? tones.urgent : tones.neutral;
  return <ToneChip tone={tone} icon={BAND_ICON[band]}>{t(`records.confidence.${band}`)}</ToneChip>;
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  band?: Band;
  error?: string;
  hint?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}

/** One editable field: outlined input (red when the extractor was unsure), helper line and confidence chip. */
function ReviewField(p: FieldProps) {
  const low = p.band === "low";
  const helper = p.error ?? p.hint;
  return (
    <View style={styles.field}>
      <TextInput
        label={p.label}
        mode="outlined"
        value={p.value}
        onChangeText={p.onChangeText}
        error={low || !!p.error}
        multiline={p.multiline}
        numberOfLines={p.multiline ? 5 : undefined}
        keyboardType={p.keyboardType}
        autoCapitalize={p.autoCapitalize}
        style={p.multiline ? styles.multiline : undefined}
      />
      {helper || p.band ? (
        <View style={styles.fieldMeta}>
          <View style={styles.helper}>
            {helper ? <HelperText type={p.error ? "error" : "info"} visible padding="none">{helper}</HelperText> : null}
          </View>
          <ConfidenceChip band={p.band} />
        </View>
      ) : null}
    </View>
  );
}

// ---------- reading the (loosely typed) extraction ----------

function readMedications(ex: Record<string, unknown>): string[] {
  const list = ex.medications;
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const parts = ["name", "strength", "dose", "frequency"]
      .map((k) => m[k])
      .filter((v): v is string => typeof v === "string" && v.trim() !== "");
    if (parts.length) out.push(parts.join(" "));
  }
  return out;
}

function readCodes(ex: Record<string, unknown>): string[] {
  const list = ex.icd10_codes;
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => (c && typeof c === "object" && "value" in (c as object) ? (c as { value?: unknown }).value : c))
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/** Human-readable summary of the extras that have no field of their own (goes into Notes, editable). */
function buildNotes(ex: Record<string, unknown>, tr: (key: string) => string): string {
  const lines: string[] = [];
  const own = fieldValue(ex, "notes");
  if (own) lines.push(own);
  const patient = fieldValue(ex, "patient_name");
  if (patient) lines.push(`${tr("records.fields.patientName")}: ${patient}`);
  const restDays = fieldValue(ex, "rest_days");
  const restFrom = fieldValue(ex, "rest_from");
  const restTo = fieldValue(ex, "rest_to");
  if (restDays || restFrom || restTo) {
    const range = restFrom || restTo ? ` (${restFrom || "?"} – ${restTo || "?"})` : "";
    lines.push(`${tr("records.fields.restDays")}: ${restDays || "—"}${range}`);
  }
  const meds = readMedications(ex);
  if (meds.length) {
    lines.push(`${tr("records.fields.medications")}:`);
    for (const m of meds) lines.push(`- ${m}`);
  }
  const codes = readCodes(ex);
  if (codes.length) lines.push(`${tr("conditions.code")}: ${codes.join(", ")}`);
  return lines.join("\n");
}

// ---------- the form ----------

interface Props {
  recordId: string;
  result: ExtractResult;
  onSaved: () => void;
  onCancel: () => void;
}

type TextKey = Exclude<keyof ReviewedRecordInput, "kind">;

/**
 * "Red-field review": every extracted value is prefilled and editable, with a
 * confidence chip per field. Low-confidence fields are outlined in red so the
 * user checks them before the record is saved as reviewed.
 */
export function RecordReviewForm({ recordId, result, onSaved, onCancel }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const tones = useStatusTones();
  const ex = result.extraction;
  const meta = result.fieldMeta;
  const docType = String(ex.document_type ?? "");
  const notMedical = docType === "not_medical";
  const initialKind: RecordKind = kindFromDocumentType(docType) ?? "other";

  const [kind, setKind] = useState<RecordKind>(initialKind);
  const [title, setTitle] = useState(() => fieldValue(ex, "diagnosis"));
  const [facility, setFacility] = useState(() => fieldValue(ex, "hospital"));
  const [doctorName, setDoctorName] = useState(() => fieldValue(ex, "doctor_name"));
  const [doctorLicenseNo, setDoctorLicenseNo] = useState(() => fieldValue(ex, "doctor_license_no"));
  const [issuedAt, setIssuedAt] = useState(() => fieldValue(ex, "visit_date"));
  const [validUntil, setValidUntil] = useState(() => defaultValidUntil(initialKind, fieldValue(ex, "visit_date")) ?? "");
  const [validUntilTouched, setValidUntilTouched] = useState(false);
  const [notes, setNotes] = useState(() => buildNotes(ex, (k) => String(t(k))));
  const [errors, setErrors] = useState<{ issuedAt?: string; validUntil?: string }>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const changeKind = (k: RecordKind) => {
    setKind(k);
    if (!validUntilTouched) setValidUntil(defaultValidUntil(k, issuedAt.trim()) ?? "");
  };
  const changeIssuedAt = (v: string) => {
    setIssuedAt(v);
    if (!validUntilTouched) setValidUntil(defaultValidUntil(kind, v.trim()) ?? "");
  };
  const changeValidUntil = (v: string) => {
    setValidUntilTouched(true);
    setValidUntil(v);
  };

  async function save() {
    const errs: { issuedAt?: string; validUntil?: string } = {};
    if (issuedAt.trim() && !isValidIsoDate(issuedAt.trim())) errs.issuedAt = t("errors.invalid_date");
    if (validUntil.trim() && !isValidIsoDate(validUntil.trim())) errs.validUntil = t("errors.invalid_date");
    setErrors(errs);
    if (errs.issuedAt || errs.validUntil) return;

    const input: ReviewedRecordInput = { kind };
    const put = (key: TextKey, v: string) => {
      const s = v.trim();
      if (s) input[key] = s;
    };
    put("title", title);
    put("facility", facility);
    put("doctorName", doctorName);
    put("doctorLicenseNo", doctorLicenseNo);
    put("issuedAt", issuedAt);
    put("validUntil", validUntil);
    put("notes", notes);

    setBusy(true);
    try {
      await api.reviewRecord(recordId, input);
      await qc.invalidateQueries({ queryKey: ["records"] });
      onSaved();
    } catch (e) {
      setMsg(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="headlineSmall" style={styles.title}>{t("records.review")}</Text>
        {result.source === "mock" ? <ToneChip tone={tones.neutral} icon="flask-outline">{t("records.mockResult")}</ToneChip> : null}
      </View>
      <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>{t("records.reviewHint")}</Text>
      {result.source === "live" && result.model ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{t("records.extractedBy", { model: result.model })}</Text>
      ) : null}
      {notMedical ? (
        <Banner visible icon="alert-circle-outline" style={[styles.banner, { backgroundColor: theme.colors.surfaceVariant }]}>
          {t("records.notMedical")}
        </Banner>
      ) : null}

      <Section title={t("records.kind")} card={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kindRow} keyboardShouldPersistTaps="handled">
          {recordKind.options.map((k) => (
            <Chip
              key={k}
              selected={kind === k}
              showSelectedCheck
              mode={kind === k ? "flat" : "outlined"}
              onPress={() => changeKind(k)}
              style={styles.kindChip}
              textStyle={styles.kindText}
            >
              {t(`records.kinds.${k}`)}
            </Chip>
          ))}
        </ScrollView>
      </Section>

      <Section title={t("records.detail")} card={false}>
        <View style={styles.form}>
          <ReviewField label={t("records.fields.title")} value={title} onChangeText={setTitle} band={meta.diagnosis?.band} />
          <ReviewField label={t("records.fields.facility")} value={facility} onChangeText={setFacility} band={meta.hospital?.band} />
          <ReviewField label={t("records.fields.doctorName")} value={doctorName} onChangeText={setDoctorName} band={meta.doctor_name?.band} />
          <ReviewField
            label={t("records.fields.doctorLicenseNo")}
            value={doctorLicenseNo}
            onChangeText={setDoctorLicenseNo}
            band={meta.doctor_license_no?.band}
            autoCapitalize="none"
          />
          <ReviewField
            label={t("records.fields.issuedAt")}
            value={issuedAt}
            onChangeText={changeIssuedAt}
            band={meta.visit_date?.band}
            error={errors.issuedAt}
            hint={t("records.dateHint")}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />
          <ReviewField
            label={t("records.fields.validUntil")}
            value={validUntil}
            onChangeText={changeValidUntil}
            error={errors.validUntil}
            hint={t("records.dateHint")}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
          />
          <ReviewField label={t("records.fields.notes")} value={notes} onChangeText={setNotes} multiline />
        </View>
      </Section>

      <View style={styles.actions}>
        <Button mode="contained" icon="check" onPress={() => void save()} loading={busy} disabled={busy} contentStyle={styles.btnContent}>
          {t("common.save")}
        </Button>
        <Button mode="text" onPress={onCancel} disabled={busy} contentStyle={styles.btnContent}>
          {t("common.cancel")}
        </Button>
      </View>

      <Portal>
        <Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={3000}>{msg ?? ""}</Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, flexWrap: "wrap" },
  title: { fontWeight: "700", flexShrink: 1 },
  banner: { borderRadius: 12 },
  kindRow: { flexDirection: "row", gap: space.sm, paddingVertical: space.xs, paddingHorizontal: space.xs },
  kindChip: { height: 40, justifyContent: "center" },
  kindText: { fontSize: 15 },
  form: { gap: space.sm },
  field: { gap: 2 },
  multiline: { minHeight: 120 },
  fieldMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, paddingHorizontal: space.xs, minHeight: 28 },
  helper: { flex: 1 },
  chip: { height: 28, alignSelf: "flex-start" },
  chipText: { fontSize: 12, lineHeight: 16, marginVertical: 4 },
  actions: { gap: space.xs, marginTop: space.sm },
  btnContent: { minHeight: 48 },
});
