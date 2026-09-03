import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { ActivityIndicator, Button, Dialog, Divider, Portal, Snackbar, Text, useTheme } from "react-native-paper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, errorKey, type ExtractResult } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { Screen } from "../../components/Screen";
import { Section } from "../../components/Section";
import { RecordReviewForm, StatusChip, ExpiryChip } from "../../components/RecordReviewForm";
import { radius, space } from "../../theme/tokens";

function Row({ label, value, right, last }: { label: string; value?: string | null; right?: ReactNode; last?: boolean }) {
  const theme = useTheme();
  const text = value && value.trim() ? value : "—";
  return (
    <>
      <View style={styles.row}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
        <View style={styles.rowValue}>
          <Text variant="bodyLarge" style={styles.value}>{text}</Text>
          {right}
        </View>
      </View>
      {last ? null : <Divider />}
    </>
  );
}

export default function RecordDetail() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === "string" ? rawId : "";
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const [review, setReview] = useState<ExtractResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const record = useQuery({ queryKey: ["record", id], queryFn: () => api.getRecord(id), enabled: id !== "" });
  const image = useQuery({
    queryKey: ["record-image", id],
    queryFn: () => api.fetchRecordImage(id),
    enabled: id !== "",
    staleTime: Infinity,
    retry: 0,
  });

  const extract = useMutation({
    mutationFn: () => api.extract(id),
    onSuccess: (result) => {
      setReview(result);
      void qc.invalidateQueries({ queryKey: ["record", id] });
      void qc.invalidateQueries({ queryKey: ["records"] });
    },
    onError: (e) => setMsg(t(errorKey(e))),
  });

  const del = useMutation({
    mutationFn: () => api.deleteRecord(id),
    onSuccess: () => {
      setConfirm(false);
      void qc.invalidateQueries({ queryKey: ["records"] });
      qc.removeQueries({ queryKey: ["record", id] });
      qc.removeQueries({ queryKey: ["record-image", id] });
      router.back();
    },
    onError: (e) => {
      setConfirm(false);
      setMsg(t(errorKey(e)));
    },
  });

  const r = record.data;
  const lang = i18n.language;

  if (review) {
    return (
      <>
        <Screen>
          <RecordReviewForm
            recordId={id}
            result={review}
            onSaved={() => {
              setReview(null);
              void qc.invalidateQueries({ queryKey: ["record", id] });
              void qc.invalidateQueries({ queryKey: ["records"] });
              setMsg(t("records.saved"));
            }}
            onCancel={() => setReview(null)}
          />
        </Screen>
        <Portal>
          <Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={3000}>{msg ?? ""}</Snackbar>
        </Portal>
      </>
    );
  }

  return (
    <>
      <Screen>
        {record.isLoading ? <ActivityIndicator style={styles.loading} /> : null}
        {record.isError ? (
          <View style={styles.errorWrap}>
            <Text variant="bodyLarge" style={{ color: theme.colors.error }}>{t(errorKey(record.error))}</Text>
            <Button mode="outlined" onPress={() => void record.refetch()} contentStyle={styles.btnContent}>{t("common.retry")}</Button>
          </View>
        ) : null}

        {r ? (
          <>
            <View style={styles.head}>
              <Text variant="headlineSmall" style={styles.title} numberOfLines={3}>
                {r.facility || r.title || t(`records.kinds.${r.kind}`)}
              </Text>
              <View style={styles.badges}>
                <StatusChip status={r.status} />
                <ExpiryChip validUntil={r.validUntil} />
              </View>
            </View>

            <Section title={t("records.image")} card={false}>
              <View style={[styles.imageWrap, { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant }]}>
                {image.data ? (
                  <Image source={{ uri: image.data }} style={styles.image} contentFit="contain" accessibilityLabel={t("records.image")} />
                ) : image.isError ? (
                  <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>{t("records.noImage")}</Text>
                ) : (
                  <ActivityIndicator />
                )}
              </View>
            </Section>

            <Section title={t("records.detail")}>
              <View style={styles.rows}>
                <Row label={t("records.kind")} value={t(`records.kinds.${r.kind}`)} />
                <Row label={t("records.fields.title")} value={r.title} />
                <Row label={t("records.fields.facility")} value={r.facility} />
                <Row label={t("records.fields.doctorName")} value={r.doctorName} />
                <Row label={t("records.fields.doctorLicenseNo")} value={r.doctorLicenseNo} />
                <Row label={t("records.fields.issuedAt")} value={r.issuedAt ? formatDate(r.issuedAt, lang) : null} />
                <Row
                  label={t("records.fields.validUntil")}
                  value={r.validUntil ? formatDate(r.validUntil, lang) : null}
                  right={<ExpiryChip validUntil={r.validUntil} />}
                />
                <Row label={t("conditions.status")} value={t(`records.status.${r.status}`)} right={<StatusChip status={r.status} />} />
                <Row label={t("records.fields.notes")} value={r.notes} last />
              </View>
            </Section>

            <View style={styles.actions}>
              {r.status !== "reviewed" ? (
                <Button
                  mode="contained"
                  icon="file-search-outline"
                  onPress={() => extract.mutate()}
                  loading={extract.isPending}
                  disabled={extract.isPending}
                  contentStyle={styles.btnContent}
                >
                  {t("records.reviewNow")}
                </Button>
              ) : null}
              <Button mode="contained-tonal" icon="share-variant-outline" onPress={() => router.push("/share")} contentStyle={styles.btnContent}>
                {t("common.share")}
              </Button>
              <Button
                mode="outlined"
                icon="delete-outline"
                textColor={theme.colors.error}
                onPress={() => setConfirm(true)}
                disabled={del.isPending}
                contentStyle={styles.btnContent}
              >
                {t("common.delete")}
              </Button>
            </View>
          </>
        ) : null}
      </Screen>

      <Portal>
        <Dialog visible={confirm} onDismiss={() => setConfirm(false)}>
          <Dialog.Title>{t("common.delete")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">{t("records.deleteConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(false)} disabled={del.isPending}>{t("common.cancel")}</Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              textColor={theme.colors.onError}
              onPress={() => del.mutate()}
              loading={del.isPending}
              disabled={del.isPending}
            >
              {t("common.delete")}
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={3000}>{msg ?? ""}</Snackbar>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.lg },
  errorWrap: { gap: space.sm, alignItems: "center", paddingVertical: space.md },
  head: { gap: space.sm },
  title: { fontWeight: "700" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  imageWrap: {
    width: "100%", aspectRatio: 3 / 4, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  rows: { paddingHorizontal: space.lg },
  row: { paddingVertical: space.md, gap: 2 },
  rowValue: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  value: { flex: 1 },
  actions: { gap: space.sm, marginTop: space.sm },
  btnContent: { minHeight: 48 },
});
