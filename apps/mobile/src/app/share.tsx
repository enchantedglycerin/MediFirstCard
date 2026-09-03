import { useEffect, useState } from "react";
import { Linking, Platform, Share, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  ActivityIndicator, Button, Checkbox, Chip, Dialog, Divider, HelperText, Portal, SegmentedButtons, Snackbar, Text, TextInput, useTheme,
} from "react-native-paper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Screen } from "../components/Screen";
import { Section } from "../components/Section";
import { EmptyState } from "../components/EmptyState";
import { api, errorKey, type RecordDto, type ShareLinkDto } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";
import { radius, space } from "../theme/tokens";

// Mirrors createShareLinkInput in @mfc/shared: recordIds 1..50, ttlHours 1..168, passcode = exactly 4 digits.
const TTL_OPTIONS = ["1", "24", "72"] as const;
type Ttl = (typeof TTL_OPTIONS)[number];
const MAX_RECORDS = 50;
const PASSCODE_LENGTH = 4;
const PASSCODE_RE = /^\d{4}$/;
const isTtl = (v: string): v is Ttl => (TTL_OPTIONS as readonly string[]).includes(v);

interface CreatedLink { id: string; url: string; expiresAt: string }
type LinkStatus = "active" | "expired" | "revoked";

function linkStatus(l: ShareLinkDto, now: number): LinkStatus {
  if (l.revokedAt) return "revoked";
  if (l.expiresAt && Date.parse(l.expiresAt) < now) return "expired";
  return "active";
}

const STATUS_ICON: Record<LinkStatus, string> = {
  active: "check-circle-outline",
  expired: "clock-alert-outline",
  revoked: "cancel",
};

/** Share selected documents with a clinician through a short-lived, optionally passcode-protected link. */
export default function ShareScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const records = useQuery({ queryKey: ["records"], queryFn: api.listRecords });
  const links = useQuery({ queryKey: ["share-links"], queryFn: api.listShareLinks });

  const [selected, setSelected] = useState<string[]>([]);
  const [passcode, setPasscode] = useState("");
  const [ttl, setTtl] = useState<Ttl>("24");
  const [result, setResult] = useState<CreatedLink | null>(null);
  const [revoking, setRevoking] = useState<ShareLinkDto | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const queryError = records.error ?? links.error;
  useEffect(() => { if (queryError) setMsg(t(errorKey(queryError))); }, [queryError, t]);

  const create = useMutation({
    mutationFn: () => api.createShareLink({ recordIds: selected, ttlHours: Number(ttl), passcode: passcode || undefined }),
    onSuccess: (data) => {
      setResult(data);
      setMsg(t("share.created"));
      void qc.invalidateQueries({ queryKey: ["share-links"] });
    },
    onError: (e) => setMsg(t(errorKey(e))),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeShareLink(id),
    onSuccess: (_ok, id) => { if (result?.id === id) setResult(null); },
    onError: (e) => setMsg(t(errorKey(e))),
    onSettled: () => {
      setRevoking(null);
      void qc.invalidateQueries({ queryKey: ["share-links"] });
    },
  });

  const recs = records.data ?? [];
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_RECORDS ? [...s, id] : s));
  const passcodeInvalid = passcode.length > 0 && !PASSCODE_RE.test(passcode);
  const canCreate = selected.length > 0 && !passcodeInvalid && !create.isPending;

  const recordLabel = (r: RecordDto) => {
    const title = r.facility || r.title || t(`records.kinds.${r.kind}`);
    const date = r.issuedAt
      ? t("records.issued", { date: formatDate(r.issuedAt, i18n.language) })
      : formatDate(r.createdAt, i18n.language);
    return `${title}\n${date}`;
  };

  // The emergency-card QR link is managed from the Card tab; only clinician links are listed (and revocable) here.
  const now = Date.now();
  const shownLinks = (links.data ?? [])
    .filter((l) => l.scope !== "emergency")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const statusLabel = (l: ShareLinkDto, s: LinkStatus) =>
    s === "revoked" ? t("share.revoked")
      : s === "expired" ? t("share.expired")
        : t("share.expires", { date: formatDateTime(l.expiresAt, i18n.language) });

  async function shareUrl(url: string) {
    try { await Share.share({ message: url }); } catch (e) { setMsg(t(errorKey(e))); }
  }
  async function openUrl(url: string) {
    try { await Linking.openURL(url); } catch (e) { setMsg(t(errorKey(e))); }
  }

  const dim = { color: theme.colors.onSurfaceVariant };
  const onHero = { color: theme.colors.onPrimaryContainer };

  return (
    <>
      <Screen>
        <Text variant="bodyLarge" style={dim}>{t("share.hint")}</Text>

        <Section
          title={t("share.selectRecords")}
          action={recs.length > 0 ? (
            <Text variant="labelLarge" style={{ color: theme.colors.primary }}>{t("common.items", { count: selected.length })}</Text>
          ) : undefined}
        >
          {records.isLoading ? (
            <ActivityIndicator style={styles.loading} />
          ) : recs.length === 0 ? (
            <EmptyState
              icon="file-document-outline"
              title={t("share.noRecords")}
              actionLabel={t("records.scan")}
              onAction={() => router.push("/records")}
            />
          ) : (
            recs.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <Checkbox.Item
                  label={recordLabel(r)}
                  labelVariant="bodyLarge"
                  labelStyle={styles.checkLabel}
                  position="leading"
                  status={selected.includes(r.id) ? "checked" : "unchecked"}
                  onPress={() => toggle(r.id)}
                  style={styles.checkRow}
                />
              </View>
            ))
          )}
        </Section>

        <Section>
          <View style={styles.pad}>
            <TextInput
              mode="outlined"
              label={t("share.passcode")}
              value={passcode}
              onChangeText={(v) => setPasscode(v.replace(/\D/g, "").slice(0, PASSCODE_LENGTH))}
              keyboardType="number-pad"
              maxLength={PASSCODE_LENGTH}
              error={passcodeInvalid}
            />
            <HelperText type={passcodeInvalid ? "error" : "info"} visible>{t("share.passcodeHint")}</HelperText>
            <Text variant="labelLarge">{t("share.ttl")}</Text>
            <SegmentedButtons
              value={ttl}
              onValueChange={(v) => { if (isTtl(v)) setTtl(v); }}
              buttons={TTL_OPTIONS.map((v) => ({ value: v, label: t(`share.ttlOptions.${v}`) }))}
            />
            <Button
              mode="contained"
              icon="link-plus"
              contentStyle={styles.btnContent}
              labelStyle={styles.btnLabel}
              onPress={() => create.mutate()}
              loading={create.isPending}
              disabled={!canCreate}
            >
              {t("share.create")}
            </Button>
            {selected.length === 0 && recs.length > 0 ? (
              <HelperText type="info" visible style={styles.centered}>{t("share.selectAtLeastOne")}</HelperText>
            ) : null}
          </View>
        </Section>

        {result ? (
          <View style={[styles.result, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text variant="titleMedium" style={[styles.bold, onHero]}>{t("share.linkReady")}</Text>
            <Text selectable variant="bodyLarge" style={[styles.url, onHero]}>{result.url}</Text>
            <Text variant="bodyMedium" style={onHero}>
              {t("share.expires", { date: formatDateTime(result.expiresAt, i18n.language) })}
            </Text>
            <View style={styles.row}>
              <Button mode="contained" icon="share-variant-outline" contentStyle={styles.btnContent} style={styles.grow} onPress={() => void shareUrl(result.url)}>
                {t("common.share")}
              </Button>
              <Button mode="outlined" icon="open-in-new" contentStyle={styles.btnContent} style={styles.grow} onPress={() => void openUrl(result.url)}>
                {t("share.open")}
              </Button>
            </View>
            <Button icon="link-plus" onPress={() => setResult(null)}>{t("share.newLink")}</Button>
          </View>
        ) : null}

        <Section title={t("share.active")}>
          {links.isLoading ? (
            <ActivityIndicator style={styles.loading} />
          ) : shownLinks.length === 0 ? (
            <EmptyState icon="link-variant" title={t("share.empty")} />
          ) : (
            shownLinks.map((l, i) => {
              const s = linkStatus(l, now);
              const active = s === "active";
              return (
                <View key={l.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.linkRow}>
                    <View style={styles.linkText}>
                      <Chip
                        compact
                        icon={STATUS_ICON[s]}
                        style={[styles.chip, { backgroundColor: active ? theme.colors.primaryContainer : theme.colors.surfaceVariant }]}
                        textStyle={{ color: active ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }}
                      >
                        {statusLabel(l, s)}
                      </Chip>
                      <Text variant="bodyMedium" style={dim}>
                        {`${t("share.views", { count: l.viewCount })} · ${formatDateTime(l.createdAt, i18n.language)}`}
                      </Text>
                    </View>
                    {active ? (
                      <Button compact onPress={() => setRevoking(l)} disabled={revoke.isPending}>{t("share.revoke")}</Button>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </Section>

        <Text variant="bodySmall" style={[styles.centered, dim]}>{t("app.disclaimer")}</Text>
      </Screen>

      <Portal>
        <Dialog visible={!!revoking} onDismiss={() => { if (!revoke.isPending) setRevoking(null); }}>
          <Dialog.Title>{t("share.revoke")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">
              {revoking ? `${statusLabel(revoking, "active")} · ${t("share.views", { count: revoking.viewCount })}` : ""}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRevoking(null)} disabled={revoke.isPending}>{t("common.cancel")}</Button>
            <Button
              mode="contained"
              onPress={() => { if (revoking) revoke.mutate(revoking.id); }}
              loading={revoke.isPending}
              disabled={revoke.isPending}
            >
              {t("share.revoke")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal><Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={3000}>{msg ?? ""}</Snackbar></Portal>
    </>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg, gap: space.md },
  loading: { marginVertical: space.xl },
  checkRow: { paddingVertical: space.sm },
  checkLabel: { textAlign: "left" },
  btnContent: { minHeight: 48 },
  btnLabel: { fontSize: 16 },
  centered: { textAlign: "center" },
  bold: { fontWeight: "700" },
  result: { borderRadius: radius.card, padding: space.lg, gap: space.md },
  url: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  grow: { flexGrow: 1, flexBasis: 140 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  linkText: { flex: 1, gap: space.xs },
  chip: { alignSelf: "flex-start" },
});
