import { useState, type ReactNode, type RefObject } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "../theme/tokens";

interface Props {
  children: ReactNode;
  /** Scrollable (default) or a fixed flex column. */
  scroll?: boolean;
  /** Access to the ScrollView (e.g. to scroll to a field that failed validation). */
  scrollRef?: RefObject<ScrollView | null>;
  style?: ViewStyle;
  gap?: number;
  padded?: boolean;
  /** Reserve the system navigation-bar inset at the bottom (default). Tab screens pass false: the tab bar already does. */
  bottomInset?: boolean;
  /** Pull-to-refresh handler (scroll mode only); the spinner shows until the promise settles. */
  onRefresh?: () => Promise<unknown>;
}

/** Page wrapper: themed background, keyboard-safe, consistent padding and vertical rhythm. */
export function Screen({ children, scroll = true, scrollRef, style, gap = space.md, padded = true, bottomInset = true, onRefresh }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = onRefresh
    ? async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }
    : undefined;
  // Android is edge-to-edge: without this the last rows of a stacked screen hide under the navigation bar.
  const inner: ViewStyle = { gap, padding: padded ? space.lg : 0, paddingBottom: space.xxl + (bottomInset ? insets.bottom : 0) };
  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[inner, style]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[theme.colors.primary]} tintColor={theme.colors.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner, style]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
