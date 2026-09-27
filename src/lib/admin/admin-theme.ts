import { useCallback, useEffect, useState } from "react";
import { localStore } from "@/lib/shared/browser-storage";

export type AdminThemePreference = "light" | "dark" | "system";

export const ADMIN_THEME_KEY = "cozycraft-admin-theme";
const darkQuery = "(prefers-color-scheme: dark)";

export function readAdminTheme(): AdminThemePreference {
  const stored = localStore.getItem(ADMIN_THEME_KEY);
  return stored === "dark" || stored === "system" ? stored : "light";
}

export function resolveAdminTheme(preference: AdminThemePreference, systemDark: boolean) {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

const systemPrefersDark = () =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.(darkQuery).matches);

/** Only admin CSS reads data-admin-theme, so this never restyles the storefront. */
export function applyAdminTheme(preference: AdminThemePreference = readAdminTheme()) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.adminTheme = resolveAdminTheme(preference, systemPrefersDark());
}

export function useAdminTheme() {
  const [preference, setPreference] = useState<AdminThemePreference>(readAdminTheme);
  useEffect(() => {
    applyAdminTheme(preference);
    const query = window.matchMedia?.(darkQuery);
    const onSystemChange = () => applyAdminTheme(preference);
    const onStorage = (event: StorageEvent) => {
      if (event.key === ADMIN_THEME_KEY) setPreference(readAdminTheme());
    };
    query?.addEventListener?.("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      query?.removeEventListener?.("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [preference]);
  const choose = useCallback((next: AdminThemePreference) => {
    localStore.setItem(ADMIN_THEME_KEY, next);
    setPreference(next);
  }, []);
  return [preference, choose] as const;
}
