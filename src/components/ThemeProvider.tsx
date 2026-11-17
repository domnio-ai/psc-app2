import { useLayoutEffect, type ReactNode } from "react";
import { applyThemeToDocument, type ThemeMode, type AccentColor } from "../theme-preferences";

export default function ThemeProvider({ mode, accent, children }: { mode: ThemeMode; accent: AccentColor; children: ReactNode }) {
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => applyThemeToDocument({ themeMode: mode, accentColor: accent });
    apply();
    if (mode === "System") media.addEventListener("change", apply);
    return () => {
      if (mode === "System") media.removeEventListener("change", apply);
    };
  }, [mode, accent]);
  return children;
}
