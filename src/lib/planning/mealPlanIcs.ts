/**
 * Génération du calendrier iCalendar (.ics) du planning de repas. Logique PURE
 * (aucune I/O, aucun DOM) : elle produit la chaîne ICS, le déclenchement du
 * téléchargement reste à la charge de l'UI.
 *
 * En mode foyer, l'utilisateur courant devient organisateur et les autres membres
 * des participants (ATTENDEE) de chaque événement.
 *
 * @module planning/mealPlanIcs
 */
import { SLOT_BY_ID } from "@/constants/mealSlots.js";
import type { MealPlan } from "@/lib/types.js";

/** Sous-ensemble de recette nécessaire à l'export calendrier. */
export interface IcsRecipe {
  id: string;
  name: string;
  description?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  healthScore?: number;
  source?: string;
  ingredients?: { name?: string; amount?: number | string; unit?: string }[];
}

/** Identité pour l'organisateur / les participants (mode foyer). */
export interface IcsPeople {
  organizerName?: string;
  organizerEmail?: string;
  memberEmails?: string[];
}

const CRLF = "\r\n";

const pad = (n: number): string => String(n).padStart(2, "0");
const toICSDate = (dateStr: string, timeStr: string): string => dateStr.split("-").join("") + "T" + timeStr;
const escapeICS = (s: string): string => (s || "").split("\n").join("\\n").split(",").join("\\,").split(";").join("\\;");

/** Lignes ORGANIZER + ATTENDEE, uniquement en foyer avec plus d'un membre. */
function peopleLinesFor(people: IcsPeople): string[] {
  const myEmail = (people.organizerEmail || "").toLowerCase();
  const memberEmails = people.memberEmails || [];
  if (memberEmails.length <= 1 || !myEmail) return [];
  const lines = [`ORGANIZER;CN=${escapeICS(people.organizerName || myEmail)}:mailto:${myEmail}`];
  for (const email of memberEmails) {
    if (!email || email.toLowerCase() === myEmail) continue;
    lines.push(`ATTENDEE;CN=${escapeICS(email)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`);
  }
  return lines;
}

/**
 * Construit le calendrier ICS du planning. Un événement VEVENT par repas dont la
 * recette existe encore, horodaté selon le créneau (matin / midi / soir).
 *
 * @param mealPlan - Le planning (date ISO → repas).
 * @param recipes - Les recettes de la bibliothèque (pour résoudre chaque repas).
 * @param people - Identité organisateur / participants (mode foyer, optionnel).
 * @param now - Instant de génération (injectable pour les tests), défaut `new Date()`.
 * @returns La chaîne ICS complète, ou `null` si aucun repas exportable.
 */
export function buildMealPlanIcs(
  mealPlan: MealPlan,
  recipes: IcsRecipe[],
  people: IcsPeople = {},
  now: Date = new Date(),
): string | null {
  const byId = new Map(recipes.map(r => [r.id, r]));
  const peopleLines = peopleLinesFor(people);
  const dtstamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`;

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RecipeApp//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  let count = 0;

  for (const [date, meals] of Object.entries(mealPlan)) {
    for (const meal of meals || []) {
      const recipe = meal.recipeId ? byId.get(meal.recipeId) : undefined;
      if (!recipe) continue;
      const slot = meal.slot || "midi";
      const times = SLOT_BY_ID[slot]?.ics || SLOT_BY_ID.midi.ics;
      const slotLabel = SLOT_BY_ID[slot]?.meal || "Repas";

      const descParts = [
        recipe.description,
        (meal.portions || 0) > 1 ? `${recipe.servings} portions sur ${meal.portions} jours` : "",
        `Préparation : ${recipe.prepTime} min`,
        `Cuisson : ${recipe.cookTime} min`,
        `Score santé : ${recipe.healthScore || "–"}/100`,
        recipe.ingredients?.map(i => `• ${i.name} ${i.amount} ${i.unit}`).join("\n") || "",
        recipe.source ? `Source : ${recipe.source}` : "",
      ].filter(Boolean).join("\n");

      lines.push(
        "BEGIN:VEVENT",
        `UID:${date}-${slot}-${recipe.id}@recipeapp`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=Europe/Paris:${toICSDate(date, times.start)}`,
        `DTEND;TZID=Europe/Paris:${toICSDate(date, times.end)}`,
        `SUMMARY:${escapeICS(slotLabel + " – " + recipe.name)}`,
        `DESCRIPTION:${escapeICS(descParts)}`,
        `CATEGORIES:${escapeICS(slotLabel)}`,
        ...peopleLines,
        "END:VEVENT",
      );
      count++;
    }
  }

  if (count === 0) return null;
  lines.push("END:VCALENDAR");
  return lines.join(CRLF);
}
