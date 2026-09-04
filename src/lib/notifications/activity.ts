/**
 * Journal d'activité du foyer : logique PURE (sans I/O, sans React) de description
 * et de mise en forme des évènements affichés dans la section « Notifications » du
 * tableau de bord. Chaque évènement note QUI (email + nom au moment de l'action),
 * QUOI (type + cible + compteur) et QUAND (horodatage serveur, en millisecondes).
 *
 * La persistance (append/subscribe Firestore) vit dans `firestore.ts` ; ce module
 * ne fait que produire/valider les objets et calculer leur rendu textuel.
 *
 * @module activity
 */

/** Types d'évènements suivis. Toute valeur hors de cette liste est ignorée. */
export const ACTIVITY_TYPES = [
  "recipe.add", "recipe.edit", "recipe.delete", "recipe.import",
  "recipe.publish", "recipe.unpublish", "recipe.clone",
  "shopping.add", "shopping.clear",
  "mealplan.add", "mealplan.remove", "mealplan.generate",
] as const;

/** Type d'un évènement d'activité. */
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Ce qu'un site d'appel fournit pour journaliser une action (acteur ajouté en aval). */
export interface ActivityInput {
  type: ActivityType;
  /** Nom de la cible (recette, repas...) ; vide si sans objet. */
  target?: string;
  /** Compteur associé (articles ajoutés, repas générés...) ; 0 si sans objet. */
  count?: number;
}

/** Évènement d'activité complet, tel que lu depuis Firestore et affiché. */
export interface ActivityEvent {
  id: string;
  type: ActivityType;
  /** Email (minuscule) de l'auteur, pour distinguer « toi » de l'autre membre. */
  actorEmail: string;
  /** Nom affiché de l'auteur au moment de l'action (peut être vide). */
  actorName: string;
  target: string;
  count: number;
  /** Instant de l'action en millisecondes epoch. */
  ts: number;
}

/** Descripteur de rendu d'un évènement (icône métier + couleur + phrase). */
export interface ActivityView {
  icon: string;
  color: string;
  title: string;
}

const KNOWN = new Set<string>(ACTIVITY_TYPES);

/** Vrai si `t` est un {@link ActivityType} connu. */
export function isActivityType(t: unknown): t is ActivityType {
  return typeof t === "string" && KNOWN.has(t);
}

const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
const asNum = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Extrait l'instant en millisecondes d'une valeur d'horodatage Firestore. Accepte
 * un `Timestamp` (méthode `toMillis`), un nombre (déjà en ms) ou rien. Un write en
 * attente (serverTimestamp non résolu) est lu en estimation par l'appelant ; à
 * défaut, on retombe sur `fallback` pour que l'évènement s'affiche et se trie en tête.
 *
 * @param v - Valeur brute du champ `ts` d'un document.
 * @param fallback - Instant de repli (par défaut « maintenant »).
 */
export function tsToMillis(v: unknown, fallback: number = Date.now()): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof (v as { toMillis?: unknown }).toMillis === "function") {
    const ms = (v as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : fallback;
  }
  return fallback;
}

/**
 * Valide/narrow un document Firestore brut en {@link ActivityEvent}. Renvoie `null`
 * si le type est inconnu (défense : un document malformé n'est jamais affiché).
 *
 * @param id - Identifiant du document.
 * @param raw - Données brutes (`unknown`, jamais castées à l'aveugle).
 * @param now - Instant de repli pour un horodatage encore non résolu.
 */
export function parseActivity(id: string, raw: unknown, now: number = Date.now()): ActivityEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isActivityType(o.type)) return null;
  return {
    id,
    type: o.type,
    actorEmail: asStr(o.actorEmail).toLowerCase(),
    actorName: asStr(o.actorName),
    target: asStr(o.target),
    count: asNum(o.count),
    ts: tsToMillis(o.ts, now),
  };
}

const plural = (n: number, s = "s"): string => (n > 1 ? s : "");

/**
 * Libellé de l'auteur d'un évènement : « Toi » quand c'est l'utilisateur courant,
 * sinon son nom, à défaut le préfixe de son email, à défaut « Le foyer ».
 *
 * @param ev - Évènement.
 * @param currentEmail - Email de l'utilisateur courant (comparé en minuscule).
 */
export function actorLabel(ev: ActivityEvent, currentEmail: string | null | undefined): string {
  if (ev.actorEmail && ev.actorEmail === (currentEmail || "").toLowerCase()) return "Toi";
  const name = ev.actorName.trim();
  if (name) return name.split(" ")[0];
  const prefix = ev.actorEmail.split("@")[0];
  return prefix || "Le foyer";
}

// Icône + couleur + gabarit de phrase par type. La couleur reste dans le budget
// tokens (accent/ok/red) ; l'orange des alertes de stock (#e8920a) sert aux courses.
const DESCRIPTORS: Record<ActivityType, { icon: string; color: string; title: (ev: ActivityEvent) => string }> = {
  "recipe.add": { icon: "book", color: "var(--ok)", title: e => `Nouvelle recette : ${e.target}` },
  "recipe.edit": { icon: "edit", color: "var(--accent)", title: e => `Recette modifiée : ${e.target}` },
  "recipe.delete": { icon: "trash", color: "var(--red)", title: e => `Recette supprimée : ${e.target}` },
  "recipe.import": { icon: "import", color: "var(--ok)", title: e => `${e.count} recette${plural(e.count)} importée${plural(e.count)}` },
  "recipe.publish": { icon: "share", color: "var(--accent)", title: e => `Publiée dans la communauté : ${e.target}` },
  "recipe.unpublish": { icon: "eyeOff", color: "var(--text3)", title: e => `Retirée de la communauté : ${e.target}` },
  "recipe.clone": { icon: "plusCircle", color: "var(--ok)", title: e => `Ajoutée depuis la communauté : ${e.target}` },
  "shopping.add": { icon: "shopping", color: "#e8920a", title: e => `${e.count} article${plural(e.count)} ajouté${plural(e.count)} aux courses${e.target ? ` · ${e.target}` : ""}` },
  "shopping.clear": { icon: "eraser", color: "var(--text3)", title: () => "Liste de courses vidée" },
  "mealplan.add": { icon: "calendar", color: "var(--accent)", title: e => `Planifié : ${e.target}` },
  "mealplan.remove": { icon: "calendar", color: "var(--text3)", title: e => `Retiré du planning : ${e.target}` },
  "mealplan.generate": { icon: "sparkle", color: "var(--accent)", title: e => `Semaine générée : ${e.count} repas` },
};

/**
 * Descripteur de rendu d'un évènement : icône métier, couleur (token) et phrase
 * prête à afficher. L'auteur et l'horodatage relatif sont composés à part par l'UI.
 *
 * @param ev - Évènement à décrire.
 */
export function describeActivity(ev: ActivityEvent): ActivityView {
  const d = DESCRIPTORS[ev.type];
  return { icon: d.icon, color: d.color, title: d.title(ev) };
}

const MINUTE = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

/**
 * Horodatage relatif compact et humain : « à l'instant », « il y a 5 min »,
 * « il y a 2 h », « hier », « il y a 3 j », puis date courte au-delà d'une semaine.
 *
 * @param ms - Instant de l'évènement (millisecondes epoch).
 * @param now - Instant de référence (par défaut « maintenant »).
 */
export function relativeTime(ms: number, now: number = Date.now()): string {
  const diff = now - ms;
  if (diff < 0) return "à l'instant";
  if (diff < MINUTE) return "à l'instant";
  if (diff < HOUR) { const m = Math.floor(diff / MINUTE); return `il y a ${m} min`; }
  if (diff < DAY) { const h = Math.floor(diff / HOUR); return `il y a ${h} h`; }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
