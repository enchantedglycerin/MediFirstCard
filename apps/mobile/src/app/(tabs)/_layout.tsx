import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: Array<{ name: string; title: string; icon: Icon; iconOutline: Icon }> = [
  { name: "home", title: "tabs.home", icon: "home-heart", iconOutline: "home-outline" },
  { name: "card", title: "tabs.card", icon: "card-account-details", iconOutline: "card-account-details-outline" },
  { name: "records", title: "tabs.records", icon: "file-document-multiple", iconOutline: "file-document-multiple-outline" },
  { name: "more", title: "tabs.more", icon: "dots-horizontal-circle", iconOutline: "dots-horizontal-circle-outline" },
];

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Android 15+ is edge-to-edge: the bar must reserve the system navigation inset itself.
  const bottom = Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontWeight: "700", fontSize: 22 },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          height: 56 + bottom,
          paddingBottom: bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            tabBarIcon: ({ color, size, focused }) => (
              <MaterialCommunityIcons name={focused ? tab.icon : tab.iconOutline} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
