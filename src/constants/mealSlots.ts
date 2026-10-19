// ─── CRÉNEAUX DE REPAS ────────────────────────────────────────────────────────
// Source unique des créneaux du planning (auparavant codés en dur, midi/soir).
// Chaque item porte ses libellés, sa couleur et sa plage horaire (export ICS).
/** Un créneau de repas du planning. */
export interface MealSlot {
  id: string;
  order: number;
  label: string;
  meal: string;
  today: string;
  emoji: string;
  icon: string;
  color: string;
  text: string;
  accent: string;
  /** Plage horaire `HHMMSS` de l'export ICS. */
  ics: { start: string; end: string };
}

export const MEAL_SLOTS: MealSlot[] = [
  { id: "matin", order: 0, label: "Petit-déj", meal: "Petit-déjeuner", today: "Ce matin", emoji: "🥐", icon: "sunrise",
    color: "var(--slot-matin)", text: "var(--slot-matin-text)", accent: "#d7a53e", ics: { start: "080000", end: "083000" } },
  { id: "midi", order: 1, label: "Midi", meal: "Déjeuner", today: "Ce midi", emoji: "🌤", icon: "sun",
    color: "var(--slot-midi)", text: "var(--slot-midi-text)", accent: "#e0a23e", ics: { start: "120000", end: "133000" } },
  { id: "soir", order: 2, label: "Soir", meal: "Dîner", today: "Ce soir", emoji: "🌙", icon: "moon",
    color: "var(--slot-soir)", text: "var(--slot-soir-text)", accent: "#c56b46", ics: { start: "193000", end: "210000" } },
];

export const SLOT_IDS: string[] = MEAL_SLOTS.map(s => s.id);
export const SLOT_BY_ID: Record<string, MealSlot> = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, s]));
export const slotOrder = (id: string | null | undefined): number => ((id ? SLOT_BY_ID[id]?.order : undefined) ?? 9);
