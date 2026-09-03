import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";
import { space } from "../theme/tokens";

interface Props {
  children: ReactNode;
  /** Scrollable (default) or a fixed flex column. */
  scroll?: boolean;
  style?: ViewStyle;
  gap?: number;
  padded?: boolean;
}

/** Page wrapper: themed background, keyboard-safe, consistent padding and vertical rhythm. */
export function Screen({ children, scroll = true, style, gap = space.md, padded = true }: Props) {
  const theme = useTheme();
  const inner: ViewStyle = { gap, padding: padded ? space.lg : 0, paddingBottom: space.xxl };
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner, style]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
