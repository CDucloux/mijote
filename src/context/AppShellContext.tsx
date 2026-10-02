import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import type { TechniqueEntry } from "@/lib/recipes/techniques.js";
import type { PlanState } from "@/lib/firebase/subscription.js";
import type { ActivityInput } from "@/lib/notifications/activity.js";
import type { ImagePart } from "@/lib/recipes/recipeUrlImport.js";

/** Phases du moteur de synchro Firestore, telles qu'écrites par `useFirestoreSync`. */
export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "blocked";

/** Rangée de base brute (YAML / Firestore), forme large tolérant des champs additionnels. */
type DbRow = Record<string, unknown>;

/**
 * Contrat du contexte App Shell : concerns transverses partagés par tous les écrans
 * authentifiés. Les fonctions d'API (`signOut`, `import*`, `logActivity`...) sont
 * relayées par une ref à identité stable côté `App`, mais exposent ici la signature
 * de la fonction sous-jacente (le contrat vu par les consommateurs).
 */
export interface AppShell {
  user: User | null;
  syncStatus: SyncStatus;
  isDark: boolean;
  notify: (message: string, type?: string) => void;
  techniques: TechniqueEntry[];
  sources: DbRow[];
  directory: DbRow[];
  isAdmin: boolean;
  isPlus: boolean;
  subscription: PlanState;
  giftImportUsed: boolean;
  markGiftImportUsed: () => void;
  signOut: () => void;
  toggleTheme: () => void;
  getSharedData: () => unknown;
  loadDirectory: () => Promise<void>;
  importFromUrl: (url: string) => Promise<{ method: string }>;
  importFromImages: (images: ImagePart[]) => Promise<{ method: string }>;
  importFromText: (text: string) => Promise<{ method: string }>;
  importFromPdf: (text: string) => Promise<{ method: string }>;
  importGift: () => void;
  logActivity: (input: ActivityInput) => void;
}

// ─── CONTEXTE APP SHELL ───────────────────────────────────────────────────────
// Concerns transverses partagés par tous les écrans authentifiés : identité,
// statut de synchro, thème et notifications. Évite de forer ce « quintet » +
// notify à travers RecipesPage/MealPlanPage/ShoppingPage/StockPage/ConfigPage.
const AppShellContext = createContext<AppShell | null>(null);

export function AppShellProvider({ value, children }: { value: AppShell; children: ReactNode }) {
  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell(): AppShell {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error("useAppShell doit être utilisé dans un AppShellProvider");
  return ctx;
}
