// ─── CRÉNEAUX DE REPAS ────────────────────────────────────────────────────────
// Source unique des créneaux du planning (auparavant codés en dur, midi/soir).
// Chaque item porte ses libellés, sa couleur et sa plage horaire (export ICS).
export const MEAL_SLOTS = [
  { id: "matin", order: 0, label: "Petit-déj", meal: "Petit-déjeuner", today: "🌅 Ce matin", emoji: "🥐",
    color: "rgba(232,146,10,0.16)", text: "var(--orange)", accent: "#e8920a", ics: { start: "080000", end: "083000" } },
  { id: "midi", order: 1, label: "Midi", meal: "Déjeuner", today: "🌤 Ce midi", emoji: "🌤",
    color: "rgba(240,192,96,0.18)", text: "var(--yellow)", accent: "#e0a800", ics: { start: "120000", end: "133000" } },
  { id: "soir", order: 2, label: "Soir", meal: "Dîner", today: "🌙 Ce soir", emoji: "🌙",
    color: "rgba(91,156,246,0.18)", text: "var(--blue)", accent: "#4a80d4", ics: { start: "193000", end: "210000" } },
];

export const SLOT_IDS = MEAL_SLOTS.map(s => s.id);
export const SLOT_BY_ID = Object.fromEntries(MEAL_SLOTS.map(s => [s.id, s]));
export const slotOrder = (id) => (SLOT_BY_ID[id]?.order ?? 9);
