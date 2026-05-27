import { AppPreferences } from "./types";

export const colors = {
  ink: "#111827",
  muted: "#687083",
  background: "#F5F7FB",
  panel: "#FFFFFF",
  panelAlt: "#EEF2F7",
  border: "#D9E0EA",
  primary: "#2563EB",
  primaryDark: "#1E40AF",
  success: "#168A5B",
  warning: "#B45309",
  danger: "#DC2626",
  codeBg: "#101828",
  codeText: "#D1E7FF",
  tagBg: "#E8F1FF",
  tagText: "#174EA6"
};

export const darkColors = {
  ink: "#E5E7EB",
  muted: "#A1A8B8",
  background: "#0D1117",
  panel: "#161B22",
  panelAlt: "#202936",
  border: "#303A49",
  primary: "#60A5FA",
  primaryDark: "#93C5FD",
  success: "#34D399",
  warning: "#F59E0B",
  danger: "#F87171",
  codeBg: "#05080E",
  codeText: "#D1E7FF",
  tagBg: "#1E3A5F",
  tagText: "#BFDBFE"
};

export function paletteFor(preferences: AppPreferences, systemDark: boolean) {
  const useDark =
    preferences.theme === "dark" ||
    (preferences.theme === "system" && systemDark);

  return useDark ? darkColors : colors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};
