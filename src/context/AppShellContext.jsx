import { createContext, useContext } from "react";

// ─── CONTEXTE APP SHELL ───────────────────────────────────────────────────────
// Concerns transverses partagés par tous les écrans authentifiés : identité,
// statut de synchro, thème et notifications. Évite de forer ce « quintet » +
// notify à travers RecipeTab/MealPlanTab/ShoppingTab/StockTab/ConfigTab.
const AppShellContext = createContext(null);

export function AppShellProvider({ value, children }) {
  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error("useAppShell doit être utilisé dans un AppShellProvider");
  return ctx;
}
