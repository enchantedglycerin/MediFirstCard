import { useState } from "react";
import { Image, Share, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ActivityIndicator, Button, Snackbar, Text, useTheme, Portal } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, errorKey, profileExists } from "../../lib/api";
import { Screen } from "../../components/Screen";
import { Section } from "../../components/Section";
import { EmptyState } from "../../components/EmptyState";
import { EmergencyCardView } from "../../components/EmergencyCardView";
import { palette, radius, space } from "../../theme/tokens";

const QR_SIZE = 220;

/** Card tab: the emergency card as rescuers see it, its QR / link, and the actions around it. */
export default function CardScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [snack, setSnack] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const hasProfile = profileExists(profile.data);
  const card = useQuery({ queryKey: ["emergency-card"], queryFn: api.emergencyCard, enabled: hasProfile });

  async function shareLink(url: string) {
    try {
      await Share.share({ message: url, title: t("card.shareTitle") });
    } catch (e) {
      setSnack(t(errorKey(e)));
    }
  }

  if (profile.isLoading || card.isLoading) {
    return (
      <Screen bottomInset={false} scroll={false} style={styles.center}>
        <ActivityIndicator size="large" />
      </Screen>
    );
  }

  if (profile.isError) {
    return (
      <Screen bottomInset={false} scroll={false} style={styles.center}>
        <Text variant="bodyLarge" style={[styles.centerText, { color: theme.colors.error }]}>{t(errorKey(profile.error))}</Text>
        <Button mode="contained" icon="refresh" onPress={() => void profile.refetch()}>{t("common.retry")}</Button>
      </Screen>
    );
  }

  if (!hasProfile) {
    return (
      <Screen bottomInset={false} scroll={false} style={styles.center}>
        <EmptyState
          icon="card-account-details-outline"
          title={t("card.empty")}
          hint={t("card.emptyHint")}
          actionLabel={t("card.setUp")}
          onAction={() => router.push("/profile")}
        />
      </Screen>
    );
  }

  const data = card.data;

  return (
    <>
      <Screen bottomInset={false}>
        {data ? (
          <EmergencyCardView payload={data} showEms onCallFailed={() => setSnack(t("errors.callFailed"))} />
        ) : (
          <Section>
            <View style={styles.errorBox}>
              <Text variant="bodyLarge" style={[styles.centerText, { color: theme.colors.error }]}>{t(errorKey(card.error))}</Text>
              <Button mode="contained" icon="refresh" onPress={() => void card.refetch()} loading={card.isFetching}>
                {t("common.retry")}
              </Button>
            </View>
          </Section>
        )}

        {data ? (
          <Section title={t("card.qrHint")} card={false}>
            <View style={styles.qrWrap}>
              {/* Always white so the code scans in dark mode too. */}
              <View style={styles.qrSurface}>
                <Image
                  source={{ uri: data.qrPngDataUrl }}
                  style={styles.qr}
                  resizeMode="contain"
                  accessibilityLabel={t("card.qrHint")}
                />
              </View>
              <Text variant="bodySmall" selectable style={[styles.url, { color: theme.colors.onSurfaceVariant }]}>
                {data.emergencyUrl}
              </Text>
            </View>
          </Section>
        ) : null}

        <View style={styles.actions}>
          {data ? (
            <Button mode="contained" icon="share-variant" contentStyle={styles.btnContent} onPress={() => void shareLink(data.emergencyUrl)}>
              {t("card.shareLink")}
            </Button>
          ) : null}
          <Button mode="contained-tonal" icon="eye-outline" contentStyle={styles.btnContent} onPress={() => router.push("/rescuer")}>
            {t("card.preview")}
          </Button>
          <Button mode="contained-tonal" icon="cellphone-lock" contentStyle={styles.btnContent} onPress={() => router.push("/lock-screen")}>
            {t("card.lockScreenCard")}
          </Button>
          <Button mode="outlined" icon="account-edit-outline" contentStyle={styles.btnContent} onPress={() => router.push("/profile")}>
            {t("card.editProfile")}
          </Button>
        </View>
      </Screen>

      <Portal><Snackbar visible={snack !== null} onDismiss={() => setSnack(null)} duration={3000}>
        {snack ?? ""}
      </Snackbar></Portal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: "center", alignItems: "center", gap: space.md },
  centerText: { textAlign: "center" },
  errorBox: { padding: space.lg, gap: space.md, alignItems: "center" },
  qrWrap: { alignItems: "center", gap: space.md },
  qrSurface: { backgroundColor: palette.surface, borderRadius: radius.lg, padding: space.md },
  qr: { width: QR_SIZE, height: QR_SIZE },
  url: { textAlign: "center", paddingHorizontal: space.md },
  actions: { gap: space.sm },
  btnContent: { minHeight: 48 },
});
