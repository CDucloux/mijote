// ─── CLOUD FUNCTIONS MIJOTÉ ──────────────────────────────────────────────────
// `importRecipeFromUrl` : importe une recette depuis une URL. Réservé à l'admin
// (le créateur) — la vérification se fait CÔTÉ SERVEUR sur l'e-mail du token Auth,
// pas seulement en masquant un bouton. Deux chemins : JSON-LD schema.org (gratuit)
// puis, à défaut, extraction via Claude Haiku 4.5 (structured outputs).
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { extractJsonLdRecipe, mapJsonLdToMijote, htmlToText } = require("./recipeExtract.js");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const ADMIN_EMAIL = defineString("ADMIN_EMAIL"); // e-mail autorisé (le créateur)

const MAX_HTML_BYTES = 3_000_000; // garde-fou : on ne télécharge pas des pages énormes
const FETCH_TIMEOUT_MS = 15_000;
const MODEL = "claude-haiku-4-5";

// Schéma de sortie imposé au LLM (structured outputs) : brouillon Mijoté.
// Format JSON attendu du LLM, décrit dans le prompt (plus robuste et compatible
// que output_config selon la version du SDK) ; on parse le texte renvoyé.
const LLM_SYSTEM = `Tu extrais une recette de cuisine depuis le texte brut d'une page web, en français.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni balises Markdown, au format exact :
{"name": string, "prepTime": number, "cookTime": number, "servings": number, "cuisine": string,
 "ingredients": [{"name": string, "amount": string, "unit": string}],
 "utensils": [{"name": string}],
 "steps": [{"text": string, "tip": string}]}
Règles : prepTime/cookTime en minutes (0 si inconnu) ; pour chaque ingrédient, "amount" = le chiffre seul (ou "" si absent), "unit" = l'unité (ou ""), "name" = l'ingrédient ; "steps" dans l'ordre de préparation ; "tip" = astuce optionnelle ("" sinon). N'invente rien qui ne soit pas dans la page. Si la page n'est pas une recette, renvoie "name": "".`;

function parseJsonLoose(s) {
  let t = (s || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // UA de navigateur : beaucoup de sites renvoient une page vide aux bots.
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "fr,en;q=0.8",
      },
    });
    if (!res.ok) throw new HttpsError("unavailable", `La page a répondu ${res.status}.`);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("xml")) throw new HttpsError("invalid-argument", "L'URL ne pointe pas vers une page web.");
    const reader = res.body.getReader();
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_HTML_BYTES) { controller.abort(); throw new HttpsError("invalid-argument", "Page trop volumineuse."); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf-8");
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    if (e.name === "AbortError") throw new HttpsError("deadline-exceeded", "La page a mis trop de temps à répondre.");
    throw new HttpsError("unavailable", "Impossible de récupérer la page (réseau ou URL invalide).");
  } finally {
    clearTimeout(timer);
  }
}

// Nettoie le brouillon LLM (amount "" → absent / nombre) au schéma Mijoté.
function normalizeLlmDraft(d, sourceUrl) {
  const num = (s) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : undefined; };
  return {
    name: (d.name || "").slice(0, 200),
    prepTime: Math.max(0, Math.round(d.prepTime || 0)),
    cookTime: Math.max(0, Math.round(d.cookTime || 0)),
    servings: Math.max(1, Math.round(d.servings || 2)),
    cuisine: (d.cuisine || "").slice(0, 60),
    source: sourceUrl,
    image: "",
    ingredients: (d.ingredients || []).map(i => {
      const ing = { name: (i.name || "").slice(0, 120) };
      const a = num(i.amount); if (a != null) ing.amount = a;
      if (i.unit) ing.unit = String(i.unit).slice(0, 30);
      return ing;
    }).filter(i => i.name),
    utensils: (d.utensils || []).map(u => ({ name: (u.name || "").slice(0, 60) })).filter(u => u.name),
    steps: (d.steps || []).map(s => {
      const step = { text: (s.text || "").slice(0, 2000) };
      if (s.tip && s.tip.trim()) step.tip = s.tip.slice(0, 500);
      return step;
    }).filter(s => s.text),
  };
}

async function extractWithLlm(text, sourceUrl) {
  const key = ANTHROPIC_API_KEY.value();
  // Clé absente ou factice (déploiement sans vraie clé) → message clair, pas d'appel.
  if (!key || !key.startsWith("sk-ant-")) throw new HttpsError("failed-precondition", "Cette page n'a pas de données structurées et l'extraction IA n'est pas encore configurée (clé API Anthropic à renseigner).");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const body = text.slice(0, 24_000); // borne le coût
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: LLM_SYSTEM,
      messages: [{ role: "user", content: `Texte de la page (source : ${sourceUrl}) :\n\n${body}` }],
    });
  } catch (e) {
    console.error("Anthropic API error:", e?.status, e?.name, e?.message);
    throw new HttpsError("internal", `Extraction IA échouée : ${e?.message || "erreur API"}`);
  }
  const block = (response.content || []).find(b => b.type === "text");
  if (!block) throw new HttpsError("internal", "Réponse IA vide.");
  let parsed;
  try { parsed = parseJsonLoose(block.text); }
  catch { throw new HttpsError("internal", "Réponse IA illisible (JSON non exploitable)."); }
  return normalizeLlmDraft(parsed, sourceUrl);
}

exports.importRecipeFromUrl = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "europe-west1", timeoutSeconds: 60, memory: "512MiB" },
  async (request) => {
    // ── Garde admin (côté serveur) ──
    const email = (request.auth?.token?.email || "").toLowerCase();
    if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
    const admin = (ADMIN_EMAIL.value() || "").toLowerCase();
    if (!admin || email !== admin) throw new HttpsError("permission-denied", "Fonctionnalité réservée au créateur.");

    const url = String(request.data?.url || "").trim();
    if (!/^https?:\/\/.+/i.test(url)) throw new HttpsError("invalid-argument", "URL invalide.");

    try {
      const html = await fetchHtml(url);

      // 1. Chemin gratuit : JSON-LD schema.org/Recipe.
      const jsonld = extractJsonLdRecipe(html);
      if (jsonld && jsonld.name && (jsonld.recipeIngredient || jsonld.recipeInstructions)) {
        return { recipe: mapJsonLdToMijote(jsonld, url), method: "jsonld" };
      }

      // 2. Fallback : LLM sur le texte de la page.
      const text = htmlToText(html);
      if (text.length < 200) throw new HttpsError("invalid-argument", "Page sans contenu exploitable (site protégé ou vide).");
      const recipe = await extractWithLlm(text, url);
      if (!recipe.name || !recipe.ingredients.length) throw new HttpsError("not-found", "Aucune recette détectée sur cette page.");
      return { recipe, method: "llm" };
    } catch (e) {
      if (e instanceof HttpsError) throw e; // messages déjà lisibles
      console.error("importRecipeFromUrl — erreur inattendue:", e);
      throw new HttpsError("internal", `Erreur inattendue : ${e?.message || e}`);
    }
  }
);
