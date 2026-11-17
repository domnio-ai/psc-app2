import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

/* Central stylesheet manifest; feature-only styles remain with their components. */
import "./app-styles.css";
/* Browser guards and theme setup run before React paints the workspace. */
import "./text-encoding-guard";
import { applyStoredThemeToDocument } from "./theme-preferences";
import App from "./App";
import AppErrorBoundary from "./AppErrorBoundary";

// Apply the saved device theme before React paints the login or authenticated shell.
applyStoredThemeToDocument();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
);



