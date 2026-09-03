import { useState } from "react";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import { ActivityIndicator, Banner, Button, Snackbar, Text, useTheme, Portal } from "react-native-paper";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, errorKey, profileExists } from "../lib/api";
import { Screen } from "../components/Screen";
import { EmptyState } from "../components/EmptyState";
import { EmergencyCardView } from "../components/EmergencyCardView";
import { space } from "../theme/tokens";

/** Full-screen "what a rescuer sees" preview: the same read-only card the public link shows. */
export default function Rescuer() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [noteVisible, setNoteVisible] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ["profile"], queryFn: api.getProfile });
  const hasProfile = profileExists(profile.data);
  const card = useQuery({ queryKey: ["emergency-card"], queryFn: api.emergencyCard, enabled: hasProfile });

  if (profile.isLoading || card.isLoading) {
    return (
      <Screen scroll={false} style={styles.center}>
        <ActivityIndicator size="large" />
      </Screen>
    );
  }

  if (profile.isError) {
    return (
      <Screen scroll={false} style={styles.center}>
        <Text variant="bodyLarge" style={[styles.centerText, { color: theme.colors.error }]}>{t(errorKey(profile.error))}</Text>
        <Button mode="contained" icon="refresh" onPress={() => void profile.refetch()}>{t("common.retry")}</Button>
      </Screen>
    );
  }

  if (!hasProfile) {
    return (
      <Screen scroll={false} style={styles.center}>
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

  return (
    <>
      <Screen>
        <Banner
          visible={noteVisible}
          icon="eye-outline"
          actions={[{ label: t("common.ok"), onPress: () => setNoteVisible(false) }]}
          style={styles.banner}
        >
          {t("card.rescuerNote")}
        </Banner>

        {card.data ? (
          <EmergencyCardView payload={card.data} showEms onCallFailed={() => setSnack(t("errors.callFailed"))} />
        ) : (
          <>
            <Text variant="bodyLarge" style={[styles.centerText, { color: theme.colors.error }]}>{t(errorKey(card.error))}</Text>
            <Button mode="contained" icon="refresh" onPress={() => void card.refetch()} loading={card.isFetching}>
              {t("common.retry")}
            </Button>
          </>
        )}
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
  banner: { borderRadius: 16, overflow: "hidden" },
});
