import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Divider, List, Portal, Snackbar, useTheme } from "react-native-paper";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Screen } from "../components/Screen";
import { Section } from "../components/Section";
import { EmptyState } from "../components/EmptyState";
import { api, errorKey } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { space } from "../theme/tokens";

/** Every alert (card viewed, link opened, link revoked, expiry), newest first; tap marks one read. */
export default function Alerts() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const notes = useQuery({ queryKey: ["notifications"], queryFn: api.notifications });
  useEffect(() => { if (notes.error) setMsg(t(errorKey(notes.error))); }, [notes.error, t]);

  const sorted = [...(notes.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unreadIds = sorted.filter((n) => !n.readAt).map((n) => n.id);

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await api.markNotificationRead(id); },
    onError: (e) => setMsg(t(errorKey(e))),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <>
      <Screen>
        <Section
          action={unreadIds.length > 0 ? (
            <Button compact onPress={() => markRead.mutate(unreadIds)} loading={markRead.isPending} disabled={markRead.isPending}>
              {t("alerts.markAllRead")}
            </Button>
          ) : undefined}
        >
          {notes.isLoading ? (
            <ActivityIndicator style={styles.loading} />
          ) : sorted.length === 0 ? (
            <EmptyState icon="bell-outline" title={t("alerts.empty")} hint={t("alerts.emptyHint")} />
          ) : (
            sorted.map((n, i) => {
              const unread = !n.readAt;
              return (
                <View key={n.id}>
                  {i > 0 ? <Divider /> : null}
                  <List.Item
                    title={t(`alerts.kinds.${n.kind}`, { defaultValue: n.kind })}
                    titleNumberOfLines={3}
                    titleStyle={unread ? styles.unread : undefined}
                    description={formatDateTime(n.createdAt, i18n.language)}
                    onPress={unread ? () => markRead.mutate([n.id]) : undefined}
                    left={(props) => (
                      <List.Icon
                        {...props}
                        icon={unread ? "bell-badge" : "bell-outline"}
                        color={unread ? theme.colors.primary : theme.colors.onSurfaceVariant}
                      />
                    )}
                  />
                </View>
              );
            })
          )}
        </Section>
      </Screen>
      <Portal><Snackbar visible={!!msg} onDismiss={() => setMsg(null)} duration={3000}>{msg ?? ""}</Snackbar></Portal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: space.xl },
  unread: { fontWeight: "600" },
});
