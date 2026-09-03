import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { space, radius } from "../theme/tokens";

interface Props {
  title?: string;
  /** Small element rendered at the right of the title (a button, a chip). */
  action?: ReactNode;
  children: ReactNode;
  /** Draw children on a card surface (default) or plain. */
  card?: boolean;
}

/** Titled group: uppercase label, optional action, content on a soft surface. */
export function Section({ title, action, children, card = true }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {title || action ? (
        <View style={styles.head}>
          {title ? (
            <Text variant="labelLarge" style={[styles.title, { color: theme.colors.onSurfaceVariant }]}>{title}</Text>
          ) : <View />}
          {action}
        </View>
      ) : null}
      {card ? (
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>{children}</View>
      ) : children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 28, paddingHorizontal: space.xs },
  title: { textTransform: "uppercase", letterSpacing: 0.8 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
});
