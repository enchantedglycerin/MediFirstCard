// Design tokens (clinical palette, see README). Clinical blue accent,
// red reserved for allergies/urgent, WCAG-AA contrast, elderly-first type scale.
export const palette = {
  primary: "#005B96",
  onPrimary: "#FFFFFF",
  primaryContainer: "#D6EBFF",
  onPrimaryContainer: "#00294A",
  secondary: "#00695C",
  onSecondary: "#FFFFFF",
  normal: "#1B6E3A",
  normalContainer: "#DCF5E3",
  caution: "#8A5A00",
  cautionContainer: "#FFF3D6",
  urgent: "#B3261E",
  urgentContainer: "#FFDAD6",
  emergencyHeader: "#C62828",
  onEmergencyHeader: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceVariant: "#F2F4F7",
  onSurface: "#1A1C1E",
  onSurfaceVariant: "#44474E",
  outline: "#74777F",
  background: "#F5F7FA",
} as const;

export const paletteDark = {
  primary: "#8FCDFF",
  onPrimary: "#003353",
  primaryContainer: "#00497A",
  onPrimaryContainer: "#D6EBFF",
  secondary: "#4FD8C6",
  onSecondary: "#00382F",
  normal: "#7CDB99",
  normalContainer: "#0E3A1F",
  caution: "#FFCC66",
  cautionContainer: "#3D2800",
  urgent: "#FFB4AB",
  urgentContainer: "#93000A",
  emergencyHeader: "#B3261E",
  onEmergencyHeader: "#FFFFFF",
  surface: "#161C22",
  surfaceVariant: "#1E2126",
  onSurface: "#E3E2E6",
  onSurfaceVariant: "#C4C7CF",
  outline: "#8E9199",
  background: "#0F1418",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, card: 20, pill: 999 } as const;
export const touch = { min: 48 } as const;

export const fonts = {
  regular: "Sarabun_400Regular",
  medium: "Sarabun_500Medium",
  semibold: "Sarabun_600SemiBold",
  bold: "Sarabun_700Bold",
} as const;

// status -> colour role
export type StatusLevel = "normal" | "caution" | "urgent";
