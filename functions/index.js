// ─── CLOUD FUNCTIONS MIJOTÉ ──────────────────────────────────────────────────
// `importRecipeFromUrl`   : importe une recette depuis une URL.
// `importRecipeFromImages`: importe une recette depuis 1 ou 2 photos (livre).
// Les deux sont réservées à l'admin (le créateur) — la vérification se fait CÔTÉ
// SERVEUR sur l'e-mail du token Auth, pas seulement en masquant un bouton.
// Extraction par Claude Haiku 4.5 (prompt éditable dans prompts/recipeExtract.md),
// assemblée par assignIdsAndLink() (ids stables, _raw, liaisons ingrédients/
// ustensiles ↔ étapes, images d'étape pour l'URL).
const fs = require("fs");
const path = require("path");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const {
  htmlToText, imageUrlsInText, extractOgImage,
  assignIdsAndLink, collectUtensils, filterUtensilsToKnown, CUISINE_LABELS,
} = require("./recipeExtract.js");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const ADMIN_EMAIL = defineString("ADMIN_EMAIL"); // e-mail autorisé (le créateur)

const MAX_HTML_BYTES = 3_000_000; // garde-fou : on ne télécharge pas des pages énormes
const FETCH_TIMEOUT_MS = 15_000;
const MODEL = "claude-haiku-4-5";
// L'extraction PHOTO (OCR d'une page de livre) demande une bien meilleure vision
// que l'extraction URL (texte déjà propre) : on la confie à Sonnet, plus fiable
// sur les quantités et la mise en page, et capable de haute résolution.
const VISION_MODEL = "claude-sonnet-5";

// Prompt d'extraction : fichier Markdown éditable (prompts/recipeExtract.md). La
// liste des cuisines est fixe (injectée au démarrage) ; la liste des ustensiles
// autorisés est dynamique (fournie par le client à chaque appel).
const PROMPT_TEMPLATE = fs
  .readFileSync(path.join(__dirname, "prompts", "recipeExtract.md"), "utf-8")
  .replace("{{CUISINE_LIST}}", CUISINE_LABELS.join(", "));

// Addendum spécifique à l'import PHOTO (mise en page livre/magazine : colonne
// d'ingrédients, deux pages, à ignorer, images d'étape toujours vides…). Ajouté
// après le prompt de base, dont il complète et prime les règles.
const IMG_PROMPT_ADDENDUM = fs.readFileSync(path.join(__dirname, "prompts", "recipeExtractImage.md"), "utf-8");

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

// Brouillon LLM brut → forme INTERMÉDIAIRE (avant ids/liaisons). Conserve `_raw`
// (ligne d'origine, éditable) et les listes de noms ingrédients/ustensiles par étape.
function llmToIntermediate(d, sourceUrl) {
  const num = (s) => { const n = Number(String(s ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : undefined; };
  return {
    name: (d.name || "").slice(0, 200),
    prepTime: d.prepTime, cookTime: d.cookTime, servings: d.servings,
    cuisine: d.cuisine || "",
    category: d.category || "",
    source: sourceUrl,
    ingredients: (d.ingredients || []).map(i => {
      const ing = { name: (i.name || "").slice(0, 120), _raw: (i.raw || "").slice(0, 160) };
      const a = num(i.amount); if (a != null) ing.amount = a;
      if (i.unit) ing.unit = String(i.unit).slice(0, 30);
      return ing;
    }).filter(i => i.name),
    utensils: (d.utensils || []).map(u => ({ name: (u.name || "").slice(0, 60) })).filter(u => u.name),
    steps: (d.steps || []).map(s => ({
      text: (s.text || "").slice(0, 2000),
      tip: (s.tip && s.tip.trim()) ? s.tip.slice(0, 500) : "",
      image: (s.image || "").toString().slice(0, 500),
      ingredients: Array.isArray(s.ingredients) ? s.ingredients.map(x => String(x)) : [],
      utensils: Array.isArray(s.utensils) ? s.utensils.map(x => String(x)) : [],
    })).filter(s => s.text),
  };
}

// Extraction depuis une ou deux PHOTOS (recette d'un livre, éventuellement sur 2
// pages). Même schéma de sortie que l'extraction web, mais sans images d'étape
// (une photo de page n'expose pas d'URL d'illustration exploitable).
const IMG_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMG_B64 = 6_000_000; // ~4,5 Mo par image décodée

async function extractFromImages(images, knownUtensils) {
  const key = ANTHROPIC_API_KEY.value();
  if (!key || !key.startsWith("sk-ant-")) throw new HttpsError("failed-precondition", "L'extraction IA n'est pas encore configurée (clé API Anthropic à renseigner).");
  const system = PROMPT_TEMPLATE
    .replace("{{UTENSILS}}", knownUtensils.length ? knownUtensils.join(", ") : "(aucun)")
    .replace("depuis le texte brut d'une page web", "depuis une ou plusieurs photos (pages d'un livre ou magazine de cuisine)")
    + "\n\n" + IMG_PROMPT_ADDENDUM;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const content = images.map(im => ({
    type: "image",
    source: { type: "base64", media_type: im.mediaType, data: im.data },
  }));
  content.push({ type: "text", text: images.length > 1
    ? "Ces photos montrent une même recette (pages successives d'un livre). Extrait-la en un seul objet JSON."
    : "Cette photo montre une recette de livre de cuisine. Extrait-la en JSON. Laisse `image` vide pour chaque étape." });
  let response;
  try {
    response = await client.messages.create({
      model: VISION_MODEL, max_tokens: 4096, system,
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    console.error("Anthropic API error (images):", e?.status, e?.name, e?.message);
    throw new HttpsError("internal", `Extraction IA échouée : ${e?.message || "erreur API"}`);
  }
  const block = (response.content || []).find(b => b.type === "text");
  if (!block) throw new HttpsError("internal", "Réponse IA vide.");
  let parsed;
  try { parsed = parseJsonLoose(block.text); }
  catch { throw new HttpsError("internal", "Réponse IA illisible (JSON non exploitable)."); }
  // `coverPhoto` : numéro (1-based) de l'image qui est la photo du plat, 0 si aucune.
  // On le convertit en index 0-based validé (-1 = pas de couverture).
  const cp = Number(parsed.coverPhoto);
  const coverIndex = Number.isInteger(cp) && cp >= 1 && cp <= images.length ? cp - 1 : -1;
  return { inter: llmToIntermediate(parsed, ""), coverIndex };
}

async function extractWithLlm(text, sourceUrl, knownUtensils) {
  const key = ANTHROPIC_API_KEY.value();
  // Clé absente ou factice (déploiement sans vraie clé) → message clair, pas d'appel.
  if (!key || !key.startsWith("sk-ant-")) throw new HttpsError("failed-precondition", "Cette page n'a pas de données structurées et l'extraction IA n'est pas encore configurée (clé API Anthropic à renseigner).");
  const system = PROMPT_TEMPLATE.replace("{{UTENSILS}}", knownUtensils.length ? knownUtensils.join(", ") : "(aucun)");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const body = text.slice(0, 24_000); // borne le coût
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
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
  return llmToIntermediate(parsed, sourceUrl);
}

// NB : réactiver `enforceAppCheck: true` dans les options ci-dessous (ET pour
// importRecipeFromImages) une fois le front déployé avec la clé reCAPTCHA v3
// (VITE_FIREBASE_RECAPTCHA_SITE_KEY), sinon l'import admin serait rejeté.
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
    // Ustensiles connus (base master), fournis par le client → borne les propositions du LLM.
    const knownUtensils = Array.isArray(request.data?.knownUtensils)
      ? request.data.knownUtensils.map(s => String(s)).filter(Boolean).slice(0, 200) : [];

    try {
      const html = await fetchHtml(url);
      const ogImage = extractOgImage(html); // image principale du plat

      // Extraction par IA (Haiku) sur le texte de la page. Le chemin JSON-LD a été
      // abandonné : à qualité de rendu, l'extraction Haiku est bien meilleure
      // (étapes reformulées, quantités estimées, liaisons ingrédients/ustensiles).
      const text = htmlToText(html);
      if (text.length < 200) throw new HttpsError("invalid-argument", "Page sans contenu exploitable (site protégé ou vide).");
      const inter = await extractWithLlm(text, url, knownUtensils);
      inter.image = ogImage; // le texte n'a pas d'image → on prend l'og:image de la page
      inter.utensils = filterUtensilsToKnown(collectUtensils(inter), knownUtensils);
      // Images d'étape : on ne garde que des URLs réellement présentes dans la page
      // (anti-hallucination) et jamais l'image principale du plat.
      const pageImages = imageUrlsInText(text);
      for (const s of inter.steps) s.image = (s.image && s.image !== ogImage && pageImages.has(s.image)) ? s.image : "";
      const recipe = assignIdsAndLink(inter);
      if (!recipe.name || !recipe.ingredients.length) throw new HttpsError("not-found", "Aucune recette détectée sur cette page.");
      return { recipe, method: "llm" };
    } catch (e) {
      if (e instanceof HttpsError) throw e; // messages déjà lisibles
      console.error("importRecipeFromUrl — erreur inattendue:", e);
      throw new HttpsError("internal", `Erreur inattendue : ${e?.message || e}`);
    }
  }
);

// Import depuis une ou deux photos (livre de cuisine). Réservé à l'admin (garde
// serveur identique). Vision Haiku 4.5 ; pas d'images d'étape.
exports.importRecipeFromImages = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "europe-west1", timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const email = (request.auth?.token?.email || "").toLowerCase();
    if (!request.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
    const admin = (ADMIN_EMAIL.value() || "").toLowerCase();
    if (!admin || email !== admin) throw new HttpsError("permission-denied", "Fonctionnalité réservée au créateur.");

    const raw = Array.isArray(request.data?.images) ? request.data.images : [];
    const images = raw.slice(0, 2).map(im => ({
      mediaType: String(im?.mediaType || ""),
      data: String(im?.data || ""),
    })).filter(im => im.data);
    if (!images.length) throw new HttpsError("invalid-argument", "Aucune image fournie.");
    for (const im of images) {
      if (!IMG_MEDIA_TYPES.has(im.mediaType)) throw new HttpsError("invalid-argument", "Format d'image non pris en charge (JPEG, PNG, WebP).");
      if (im.data.length > MAX_IMG_B64) throw new HttpsError("invalid-argument", "Image trop volumineuse (max ~4,5 Mo).");
    }
    const knownUtensils = Array.isArray(request.data?.knownUtensils)
      ? request.data.knownUtensils.map(s => String(s)).filter(Boolean).slice(0, 200) : [];

    try {
      const { inter, coverIndex } = await extractFromImages(images, knownUtensils);
      inter.image = "";
      inter.utensils = filterUtensilsToKnown(collectUtensils(inter), knownUtensils);
      for (const s of inter.steps) s.image = ""; // pas d'URL d'image exploitable depuis une photo
      const recipe = assignIdsAndLink(inter);
      if (!recipe.name || !recipe.ingredients.length) throw new HttpsError("not-found", "Aucune recette détectée sur la photo.");
      // coverIndex : l'image (parmi celles fournies) qui est la photo du plat → le
      // client s'en sert comme image de couverture. -1 si aucune.
      return { recipe, method: "image", coverIndex };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error("importRecipeFromImages — erreur inattendue:", e);
      throw new HttpsError("internal", `Erreur inattendue : ${e?.message || e}`);
    }
  }
);
