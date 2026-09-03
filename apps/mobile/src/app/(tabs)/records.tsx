import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  ActivityIndicator, Button, Dialog, Divider, List, Portal, ProgressBar, Snackbar, Text, useTheme,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { api, errorKey, type ExtractResult } from "../../lib/api";
import { base64ToBytes, sha256Hex } from "../../lib/image";
import { formatDate } from "../../lib/format";
import { Screen } from "../../components/Screen";
import { Section } from "../../components/Section";
import { EmptyState } from "../../components/EmptyState";
import { RecordReviewForm, StatusChip, ExpiryChip } from "../../components/RecordReviewForm";
import { space } from "../../theme/tokens";

type Step = "preparing" | "uploading" | "extracting";
type Source = "camera" | "gallery";
type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

const STEP_PROGRESS: Record<Step, number> = { preparing: 0.2, uploading: 0.55, extracting: 0.85 };

function kindIcon(kind: string): Icon {
  if (kind.startsWith("certificate_")) return "file-certificate-outline";
  switch (kind) {
    case "sick_leave": return "bed-outline";
    case "prescription": return "pill";
    case "lab": return "flask-outline";
    case "vaccine": return "needle";
    case "allergy_card": return "alert-octagon-outline";
    case "discharge": return "hospital-building";
    case "receipt": return "receipt";
    default: return "file-document-outline";
  }
}

export default function Records() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const records = useQuery({ queryKey: ["records"], queryFn: api.listRecords });
  const [sourceOpen, setSourceOpen] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [review, setReview] = useState<{ recordId: string; result: ExtractResult } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Resize -> JPEG -> sha256 -> create -> upload -> confirm -> extract.
  const scan = useMutation({
    mutationFn: async (uri: string) => {
      setStep("preparing");
      const ctx = ImageManipulator.manipulate(uri).resize({ width: 1600 });
      const rendered = await ctx.renderAsync();
      const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
      if (!out.base64) throw new Error("encode failed");
      const bytes = base64ToBytes(out.base64);
      const sha = await sha256Hex(bytes);
      setStep("uploading");
      const created = await api.createRecord({ sha256: sha, sizeBytes: bytes.length, mime: "image/jpeg" });
      await api.uploadBlob(created.recordId, bytes, "image/jpeg");
      await api.confirmRecord(created.recordId);
      setStep("extracting");
      const result = await api.extract(created.recordId);
      return { recordId: created.recordId, result };
    },
    onSuccess: (data) => setReview(data),
    onError: (e) => { console.warn("[scan] failed:", e instanceof Error ? `${e.name}: ${e.message}` : String(e)); setMsg(t(errorKey(e))); },
    onSettled: () => {
      setStep(null);
      void qc.invalidateQueries({ queryKey: ["records"] });
    },
  });

  async function pick(source: Source) {
    setSourceOpen(false);
    try {
      let picked: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setMsg(t("errors.permissionCamera")); return; }
        picked = await ImagePicker.launchCameraAsync({ quality: 0.9 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { setMsg(t("errors.permissionPhotos")); return; }
        picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
      }
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (asset) scan.mutate(asset.uri);
    } catch (e) {
      setMsg(t(errorKey(e)));
    }
  }

  const list = [...(records.data ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const busy = step !== null || scan.isPending;

  return (
    <>
      {review ? (
        <Screen>
          <RecordReviewForm
            recordId={review.recordId}
            result={review.result}
            onSaved={() => { setReview(null); setMsg(t("records.saved")); }}
            onCancel={() => setReview(null)}
          />
        </Screen>
      ) : (
        <Screen>
          <Button mode="contained" icon="camera" onPress={() => setSourceOpen(true)} disabled={busy} contentStyle={styles.btnContent}>
            {t("records.scan")}
          </Button>

          {step ? (
            <Section>
              <View style={styles.progress}>
                <View style={styles.progressRow}>
                  <ActivityIndicator />
                  <Text variant="titleMedium" style={styles.progressText}>{t(`records.steps.${step}`)}</Text>
                </View>
                <ProgressBar progress={STEP_PROGRESS[step]} />
              </View>
            </Section>
          ) : null}

          {records.isLoading ? <ActivityIndicator style={styles.loading} /> : null}

          {records.isError ? (
            <View style={styles.errorWrap}>
              <Text variant="bodyLarge" style={{ color: theme.colors.error }}>{t(errorKey(records.error))}</Text>
              <Button mode="outlined" onPress={() => void records.refetch()} contentStyle={styles.btnContent}>{t("common.retry")}</Button>
            </View>
          ) : null}

          {!records.isLoading && !records.isError && list.length === 0 ? (
            <EmptyState
              icon="file-document-multiple-outline"
              title={t("records.empty")}
              hint={t("records.emptyHint")}
              actionLabel={t("records.scan")}
              onAction={() => setSourceOpen(true)}
            />
          ) : null}

          {list.length > 0 ? (
            <>
              <Section title={t("records.count", { count: list.length })}>
                {list.map((r, i) => (
                  <View key={r.id}>
                    {i > 0 ? <Divider /> : null}
                    <List.Item
                      title={r.facility || r.title || t(`records.kinds.${r.kind}`)}
                      description={`${t(`records.kinds.${r.kind}`)} · ${formatDate(r.issuedAt ?? r.createdAt, i18n.language)}`}
                      titleStyle={styles.itemTitle}
                      titleNumberOfLines={2}
                      onPress={() => router.push({ pathname: "/record/[id]", params: { id: r.id } })}
                      left={(p) => (
                        <List.Icon {...p} icon={kindIcon(r.kind)} color={r.kind === "allergy_card" ? theme.colors.error : theme.colors.primary} />
                      )}
                      right={() => (
                        <View style={styles.badges}>
                          <StatusChip status={r.status} />
                          <ExpiryChip validUntil={r.validUntil} />
                        </View>
                      )}
                    />
                  </View>
                ))}
              </Section>
              <Button mode="text" icon="share-variant-outline" onPress={() => router.push("/share")} contentStyle={styles.btnContent}>
                {t("records.share")}
              </Button>
            </>
          ) : null}
        </Screen>
      )}

      <Portal>
        <Dialog visible={sourceOpen} onDismiss={() => setSourceOpen(false)}>
          <Dialog.Title>{t("records.source")}</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <List.Item
              title={t("records.camera")}
              titleStyle={styles.itemTitle}
              left={(p) => <List.Icon {...p} icon="camera-outline" />}
              onPress={() => void pick("camera")}
            />
            <Divider />
            <List.Item
              title={t("records.gallery")}
              titleStyle={styles.itemTitle}
              left={(p) => <List.Icon {...p} icon="image-multiple-outline" />}
              onPress={() => void pick("gallery")}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSourceOpen(false)}>{t("common.cancel")}</Button>
          </Dialog.Actions>
        </Dialog>
        <Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={3000}>{msg ?? ""}</Snackbar>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  btnContent: { minHeight: 48 },
  loading: { marginTop: space.lg },
  errorWrap: { gap: space.sm, alignItems: "center", paddingVertical: space.md },
  progress: { padding: space.lg, gap: space.md },
  progressRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  progressText: { flex: 1 },
  itemTitle: { fontWeight: "600" },
  badges: { alignItems: "flex-end", justifyContent: "center", gap: space.xs, paddingLeft: space.xs },
  dialogContent: { paddingHorizontal: 0 },
});
