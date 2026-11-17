export type ThemeMode =
  | "Dark"
  | "Light"
  | "System"
  | "Gold Grey"
  | "Navy Blue"
  | "PSC Slate"
  | "Low-Contrast Navy"
  | "Executive Gold"
  | "Sage Ivory";

export type AccentColor = "Gold" | "Blue" | "Green";

export type DeviceThemePreferences = {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  compactLayout: boolean;
};

export const THEME_STORAGE_KEY = "psc-app2-theme";
export const DEFAULT_DEVICE_THEME: DeviceThemePreferences = {
  themeMode: "Executive Gold",
  accentColor: "Gold",
  compactLayout: false,
};

const themes = new Set<ThemeMode>([
  "Dark", "Light", "System", "Gold Grey", "Navy Blue", "PSC Slate",
  "Low-Contrast Navy", "Executive Gold", "Sage Ivory",
]);
const accents = new Set<AccentColor>(["Gold", "Blue", "Green"]);

export function readDeviceThemePreferences(): DeviceThemePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeviceThemePreferences>;
    return {
      themeMode: themes.has(parsed.themeMode as ThemeMode) ? (parsed.themeMode as ThemeMode) : DEFAULT_DEVICE_THEME.themeMode,
      accentColor: accents.has(parsed.accentColor as AccentColor) ? (parsed.accentColor as AccentColor) : DEFAULT_DEVICE_THEME.accentColor,
      compactLayout: typeof parsed.compactLayout === "boolean" ? parsed.compactLayout : DEFAULT_DEVICE_THEME.compactLayout,
    };
  } catch {
    return null;
  }
}

export function writeDeviceThemePreferences(value: Partial<DeviceThemePreferences>): DeviceThemePreferences {
  const current = readDeviceThemePreferences() || DEFAULT_DEVICE_THEME;
  const next: DeviceThemePreferences = {
    themeMode: themes.has(value.themeMode as ThemeMode) ? (value.themeMode as ThemeMode) : current.themeMode,
    accentColor: accents.has(value.accentColor as AccentColor) ? (value.accentColor as AccentColor) : current.accentColor,
    compactLayout: typeof value.compactLayout === "boolean" ? value.compactLayout : current.compactLayout,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function resolveThemeMode(mode: ThemeMode): string {
  if (mode === "System" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return mode.toLowerCase().replaceAll(" ", "-");
}

export function applyThemeToDocument(value: Pick<DeviceThemePreferences, "themeMode" | "accentColor">): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveThemeMode(value.themeMode);
  document.documentElement.dataset.themePreference = value.themeMode.toLowerCase().replaceAll(" ", "-");
  document.documentElement.dataset.accent = value.accentColor.toLowerCase();
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const appBackground = getComputedStyle(document.documentElement).getPropertyValue("--app-background").trim();
  if (themeColor && /^#[\da-f]{3,8}$/i.test(appBackground)) themeColor.content = appBackground;
}

export function applyStoredThemeToDocument(): DeviceThemePreferences {
  const stored = readDeviceThemePreferences() || DEFAULT_DEVICE_THEME;
  applyThemeToDocument(stored);
  return stored;
}
