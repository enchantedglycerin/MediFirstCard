import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { space } from "../theme/tokens";

interface Props {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, hint, actionLabel, onAction }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
        <MaterialCommunityIcons name={icon} size={36} color={theme.colors.onPrimaryContainer} />
      </View>
      <Text variant="titleMedium" style={styles.title}>{title}</Text>
      {hint ? <Text variant="bodyMedium" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>{hint}</Text> : null}
      {actionLabel && onAction ? <Button mode="contained" onPress={onAction} style={styles.btn}>{actionLabel}</Button> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: space.xl, paddingHorizontal: space.lg, gap: space.sm },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  title: { textAlign: "center", fontWeight: "700" },
  hint: { textAlign: "center", maxWidth: 320 },
  btn: { marginTop: space.sm },
});
