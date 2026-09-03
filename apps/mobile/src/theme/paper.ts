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
