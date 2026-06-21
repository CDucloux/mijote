// ─── TEXT NORMALIZER (accents + case) ────────────────────────────────────────
export function normalizeStr(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// ─── INGREDIENT INPUT PARSER ──────────────────────────────────────────────────
export function parseIngredientInput(raw) {
  if (!raw || !raw.trim()) return { amount: "", unit: "", name: (raw || "").trim() };
  const s = raw.trim();

  // Unités connues. L'ordre n'a plus d'incidence sur la justesse (on exige une
  // frontière de mot après l'unité), mais on teste les plus longues d'abord
  // comme tie-break défensif.
  const UNITS = [
    "cuillère à soupe", "cuillères à soupe", "c. à soupe", "c.à.s",
    "cuillère à café", "cuillères à café", "c. à café", "c.à.c",
    "kg", "g", "mg", "l", "litre", "litres", "cl", "ml", "dl",
    "pièce", "pièces", "pce", "pc",
    "tranche", "tranches", "botte", "bottes", "sachet", "sachets",
    "gousse", "gousses", "feuille", "feuilles", "branche", "branches",
    "pincée", "pincées", "poignée", "poignées", "verre", "verres",
    "bol", "bols", "tasse", "tasses", "boîte", "boîtes", "pot", "pots",
  ].sort((a, b) => b.length - a.length);

  const fracMap = { "1/2": 0.5, "1/3": 0.333, "2/3": 0.667, "1/4": 0.25, "3/4": 0.75 };
  const numRe = /^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s*/;
  const fracRe = /^(1\/2|1\/3|2\/3|1\/4|3\/4)\s*/;

  let rest = s;
  let amount = "";

  // Extraction du nombre (entier, décimal ou fraction, éventuellement "1 1/2").
  let mFrac = rest.match(fracRe);
  let mNum = rest.match(numRe);
  if (mFrac) {
    amount = String(fracMap[mFrac[1]] || mFrac[1]);
    rest = rest.slice(mFrac[0].length);
  } else if (mNum) {
    amount = mNum[1].replace(",", ".");
    rest = rest.slice(mNum[0].length);
    let mFrac2 = rest.match(fracRe);
    if (mFrac2) {
      amount = String(parseFloat(amount) + (fracMap[mFrac2[1]] || 0));
      rest = rest.slice(mFrac2[0].length);
    }
  }

  if (!amount) return { amount: "", unit: "", name: s };

  // Extraction de l'unité : le préfixe doit être SUIVI d'une frontière de mot
  // (espace ou fin de chaîne), pour que "gousse" ne soit plus avalé par "g",
  // ni "litre" par "l", etc.
  let unit = "";
  const restLower = rest.toLowerCase();
  for (const u of UNITS) {
    const ul = u.toLowerCase();
    if (restLower.startsWith(ul)) {
      const next = rest.charAt(ul.length); // "" en fin de chaîne
      if (next === "" || /\s/.test(next)) {
        unit = u;
        rest = rest.slice(u.length).trim();
        // Retire un "de"/"d'" de liaison après l'unité.
        rest = rest.replace(/^d[e']?\s*/i, "").trim();
        break;
      }
    }
  }

  return { amount: parseFloat(amount) || amount, unit, name: rest.trim() };
}
