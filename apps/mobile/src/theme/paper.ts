import { MD3LightTheme, MD3DarkTheme, configureFonts, type MD3Theme } from "react-native-paper";
import { palette, paletteDark, fonts } from "./tokens";

const fontConfig = configureFonts({ config: { fontFamily: fonts.regular } });

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: fontConfig,
  colors: {
    ...MD3LightTheme.colors,
    primary: palette.primary,
    onPrimary: palette.onPrimary,
    primaryContainer: palette.primaryContainer,
    onPrimaryContainer: palette.onPrimaryContainer,
    // Selected chips/segments and tonal buttons use secondaryContainer; keep them clinical blue, not MD3 purple.
    secondaryContainer: palette.primaryContainer,
    onSecondaryContainer: palette.onPrimaryContainer,
    // Snackbar action text uses inversePrimary; keep it blue on the dark snackbar instead of MD3 purple.
    inversePrimary: paletteDark.primary,
    // Dialog/menu/snackbar surfaces: MD3 tints them with the primary colour; use the clinical blue, not the default purple.
    elevation: { level0: "transparent", level1: "#F2F7FA", level2: "#EBF2F7", level3: "#E3EDF3", level4: "#E0EBF2", level5: "#DBE8F0" },
    secondary: palette.secondary,
    error: palette.urgent,
    errorContainer: palette.urgentContainer,
    background: palette.background,
    surface: palette.surface,
    surfaceVariant: palette.surfaceVariant,
    onSurface: palette.onSurface,
    onSurfaceVariant: palette.onSurfaceVariant,
    outline: palette.outline,
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts: fontConfig,
  colors: {
    ...MD3DarkTheme.colors,
    primary: paletteDark.primary,
    onPrimary: paletteDark.onPrimary,
    primaryContainer: paletteDark.primaryContainer,
    onPrimaryContainer: paletteDark.onPrimaryContainer,
    secondaryContainer: paletteDark.primaryContainer,
    onSecondaryContainer: paletteDark.onPrimaryContainer,
    inversePrimary: palette.primary,
    elevation: { level0: "transparent", level1: "#1C252D", level2: "#202A34", level3: "#232F3A", level4: "#25313D", level5: "#273541" },
    secondary: paletteDark.secondary,
    error: paletteDark.urgent,
    errorContainer: paletteDark.urgentContainer,
    background: paletteDark.background,
    surface: paletteDark.surface,
    surfaceVariant: paletteDark.surfaceVariant,
    onSurface: paletteDark.onSurface,
    onSurfaceVariant: paletteDark.onSurfaceVariant,
    outline: paletteDark.outline,
  },
};
