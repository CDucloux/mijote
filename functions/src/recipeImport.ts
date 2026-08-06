// ─── IMPORT DE RECETTE (Cloud Functions) ─────────────────────────────────────
// `importRecipeFromUrl`   : importe une recette depuis une URL.
// `importRecipeFromImages`: importe une recette depuis 1 ou 2 photos (livre).
// L'accès est vérifié CÔTÉ SERVEUR (admin illimité, abonné avec quota) — jamais
// en masquant seulement un bouton. Extraction par Claude Haiku 4.5 (URL) ou
// Sonnet (photos), assemblée par assignIdsAndLink() (ids stables, _raw, liaisons
// ingrédients/ustensiles ↔ étapes, images d'étape pour l'URL).
import * as fs from "fs";
import * as path from "path";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
// Import de TYPE uniquement (effacé à la compilation) : le SDK reste chargé en
// dynamique (`await import`) dans les fonctions, mais ses types sont disponibles.
import type Anthropic from "@anthropic-ai/sdk";
import {
  htmlToText, imageUrlsInText, extractOgImage,
  assignIdsAndLink, collectUtensils, filterUtensilsToKnown, CUISINE_LABELS,
  type Intermediate,
} from "./recipeExtract.js";
import { assertImportAllowed } from "./access.js";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const ADMIN_EMAIL = defineString("ADMIN_EMAIL"); // e-mail autorisé (le créateur)

const MAX_HTML_BYTES = 3_000_000; // garde-fou : on ne télécharge pas des pages énormes
const FETCH_TIMEOUT_MS = 15_000;
const MODEL = "claude-haiku-4-5";
// L'extraction PHOTO (OCR d'une page de livre) demande une bien meilleure vision
// que l'extraction URL (texte déjà propre) : on la confie à Sonnet, plus fiable
// sur les quantités et la mise en page, et capable de haute résolution.
const VISION_MODEL = "claude-sonnet-5";

// Prompt d'extraction : fichier Markdown éditable (prompts/recipeExtract.md), qui
// reste à la racine `functions/` (le code compilé vit dans `lib/`, d'où le « .. »).
const PROMPT_TEMPLATE = fs
  .readFileSync(path.join(__dirname, "..", "prompts", "recipeExtract.md"), "utf-8")
  .replace("{{CUISINE_LIST}}", CUISINE_LABELS.join(", "));

// Addendum spécifique à l'import PHOTO (mise en page livre/magazine : colonne
// d'ingrédients, deux pages, à ignorer, images d'étape toujours vides…). Ajouté
// après le prompt de base, dont il complète et prime les règles.
const IMG_PROMPT_ADDENDUM = fs.readFileSync(path.join(__dirname, "..", "prompts", "recipeExtractImage.md"), "utf-8");

/** Extrait un objet JSON d'une réponse LLM (tolère les fences ```json et le bruit). */
function parseJsonLoose(s: string): unknown {
  let t = (s || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

/** Récupère le HTML d'une page (timeout, taille bornée, UA de navigateur). */
async function fetchHtml(url: string): Promise<string> {
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
    if (!res.body) throw new HttpsError("unavailable", "Réponse sans contenu.");
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
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
    if (e instanceof Error && e.name === "AbortError") throw new HttpsError("deadline-exceeded", "La page a mis trop de temps à répondre.");
    throw new HttpsError("unavailable", "Impossible de récupérer la page (réseau ou URL invalide).");
  } finally {
    clearTimeout(timer);
  }
}

/** Brouillon LLM brut (JSON externe non fiable). */
type LlmDraft = Record<string, unknown> & {
  name?: string; prepTime?: number; cookTime?: number; servings?: number;
  cuisine?: string; category?: string;
  ingredients?: { name?: string; amount?: unknown; unit?: unknown; raw?: string }[];
  utensils?: { name?: string }[];
  steps?: { text?: string; tip?: string; image?: unknown; ingredients?: unknown[]; utensils?: unknown[] }[];
  coverPhoto?: unknown;
};

// Brouillon LLM brut → forme INTERMÉDIAIRE (avant ids/liaisons). Conserve `_raw`
// (ligne d'origine, éditable) et les listes de noms ingrédients/ustensiles par étape.
function llmToIntermediate(d: LlmDraft, sourceUrl: string): Intermediate {
  const num = (s: unknown): number | undefined => { const n = Number(String(s ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : undefined; };
  return {
    name: (d.name || "").slice(0, 200),
    prepTime: d.prepTime, cookTime: d.cookTime, servings: d.servings,
    cuisine: d.cuisine || "",
    category: d.category || "",
    source: sourceUrl,
    ingredients: (d.ingredients || []).map((i) => {
      const ing: Intermediate["ingredients"][number] = { name: (i.name || "").slice(0, 120), _raw: (i.raw || "").slice(0, 160) };
      const a = num(i.amount); if (a != null) ing.amount = a;
      if (i.unit) ing.unit = String(i.unit).slice(0, 30);
      return ing;
    }).filter((i) => i.name),
    utensils: (d.utensils || []).map((u) => ({ name: (u.name || "").slice(0, 60) })).filter((u) => u.name),
    steps: (d.steps || []).map((s) => ({
      text: (s.text || "").slice(0, 2000),
      tip: (s.tip && s.tip.trim()) ? s.tip.slice(0, 500) : "",
      image: (s.image || "").toString().slice(0, 500),
      ingredients: Array.isArray(s.ingredients) ? s.ingredients.map((x) => String(x)) : [],
      utensils: Array.isArray(s.utensils) ? s.utensils.map((x) => String(x)) : [],
    })).filter((s) => s.text),
  };
}

/** Une image fournie par le client (base64 + type MIME). */
interface InputImage {
  mediaType: string;
  data: string;
}

// Extraction depuis une ou deux PHOTOS (recette d'un livre, éventuellement sur 2
// pages). Même schéma de sortie que l'extraction web, mais sans images d'étape
// (une photo de page n'expose pas d'URL d'illustration exploitable).
const IMG_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMG_B64 = 6_000_000; // ~4,5 Mo par image décodée

async function extractFromImages(images: InputImage[], knownUtensils: string[]): Promise<{ inter: Intermediate; coverIndex: number }> {
  const key = ANTHROPIC_API_KEY.value();
  if (!key || !key.startsWith("sk-ant-")) throw new HttpsError("failed-precondition", "L'extraction IA n'est pas encore configurée (clé API Anthropic à renseigner).");
  const system = PROMPT_TEMPLATE
    .replace("{{UTENSILS}}", knownUtensils.length ? knownUtensils.join(", ") : "(aucun)")
    .replace("depuis le texte brut d'une page web", "depuis une ou plusieurs photos (pages d'un livre ou magazine de cuisine)")
    + "\n\n" + IMG_PROMPT_ADDENDUM;
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const content: Anthropic.ContentBlockParam[] = images.map((im) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: im.mediaType as "image/jpeg", data: im.data },
  }));
  content.push({ type: "text", text: images.length > 1
    ? "Ces photos montrent une même recette (pages successives d'un livre). Extrait-la en un seul objet JSON."
    : "Cette photo montre une recette de livre de cuisine. Extrait-la en JSON. Laisse `image` vide pour chaque étape." });
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: VISION_MODEL, max_tokens: 4096, system,
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    const err = e as { status?: number; name?: string; message?: string };
    console.error("Anthropic API error (images):", err?.status, err?.name, err?.message);
    throw new HttpsError("internal", `Extraction IA échouée : ${err?.message || "erreur API"}`);
  }
  const block = (response.content || []).find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new HttpsError("internal", "Réponse IA vide.");
  let parsed: LlmDraft;
  try { parsed = parseJsonLoose(block.text) as LlmDraft; }
  catch { throw new HttpsError("internal", "Réponse IA illisible (JSON non exploitable)."); }
  // `coverPhoto` : numéro (1-based) de l'image qui est la photo du plat, 0 si aucune.
  // On le convertit en index 0-based validé (-1 = pas de couverture).
  const cp = Number(parsed.coverPhoto);
  const coverIndex = Number.isInteger(cp) && cp >= 1 && cp <= images.length ? cp - 1 : -1;
  return { inter: llmToIntermediate(parsed, ""), coverIndex };
}

async function extractWithLlm(text: string, sourceUrl: string, knownUtensils: string[]): Promise<Intermediate> {
  const key = ANTHROPIC_API_KEY.value();
  // Clé absente ou factice (déploiement sans vraie clé) → message clair, pas d'appel.
  if (!key || !key.startsWith("sk-ant-")) throw new HttpsError("failed-precondition", "Cette page n'a pas de données structurées et l'extraction IA n'est pas encore configurée (clé API Anthropic à renseigner).");
  const system = PROMPT_TEMPLATE.replace("{{UTENSILS}}", knownUtensils.length ? knownUtensils.join(", ") : "(aucun)");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const body = text.slice(0, 24_000); // borne le coût
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: `Texte de la page (source : ${sourceUrl}) :\n\n${body}` }],
    });
  } catch (e) {
    const err = e as { status?: number; name?: string; message?: string };
    console.error("Anthropic API error:", err?.status, err?.name, err?.message);
    throw new HttpsError("internal", `Extraction IA échouée : ${err?.message || "erreur API"}`);
  }
  const block = (response.content || []).find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new HttpsError("internal", "Réponse IA vide.");
  let parsed: LlmDraft;
  try { parsed = parseJsonLoose(block.text) as LlmDraft; }
  catch { throw new HttpsError("internal", "Réponse IA illisible (JSON non exploitable)."); }
  return llmToIntermediate(parsed, sourceUrl);
}

/** Extrait la liste de noms d'ustensiles connus fournie par le client (bornée). */
function knownUtensilsFrom(request: CallableRequest): string[] {
  const raw = (request.data as { knownUtensils?: unknown })?.knownUtensils;
  return Array.isArray(raw) ? raw.map((s) => String(s)).filter(Boolean).slice(0, 200) : [];
}

// NB : réactiver `enforceAppCheck: true` dans les options ci-dessous (ET pour
// importRecipeFromImages) une fois le front déployé avec la clé reCAPTCHA v3
// (VITE_FIREBASE_RECAPTCHA_SITE_KEY), sinon l'import serait rejeté.
export const importRecipeFromUrl = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "europe-west1", timeoutSeconds: 60, memory: "512MiB" },
  async (request) => {
    // ── Accès + quota (côté serveur) : admin illimité, abonné limité ──
    await assertImportAllowed(request, ADMIN_EMAIL.value(), "url");

    const url = String((request.data as { url?: unknown })?.url || "").trim();
    if (!/^https?:\/\/.+/i.test(url)) throw new HttpsError("invalid-argument", "URL invalide.");
    // Ustensiles connus (base master), fournis par le client → borne les propositions du LLM.
    const knownUtensils = knownUtensilsFrom(request);

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
      throw new HttpsError("internal", `Erreur inattendue : ${e instanceof Error ? e.message : e}`);
    }
  }
);

// Import depuis une ou deux photos (livre de cuisine). Garde serveur identique
// (admin illimité, abonné avec quota). Vision Sonnet ; pas d'images d'étape.
export const importRecipeFromImages = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "europe-west1", timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    // ── Accès + quota (côté serveur) : admin illimité, abonné limité ──
    await assertImportAllowed(request, ADMIN_EMAIL.value(), "photo");

    const rawImages = (request.data as { images?: unknown })?.images;
    const raw = Array.isArray(rawImages) ? rawImages : [];
    const images: InputImage[] = raw.slice(0, 2).map((im) => ({
      mediaType: String(im?.mediaType || ""),
      data: String(im?.data || ""),
    })).filter((im) => im.data);
    if (!images.length) throw new HttpsError("invalid-argument", "Aucune image fournie.");
    for (const im of images) {
      if (!IMG_MEDIA_TYPES.has(im.mediaType)) throw new HttpsError("invalid-argument", "Format d'image non pris en charge (JPEG, PNG, WebP).");
      if (im.data.length > MAX_IMG_B64) throw new HttpsError("invalid-argument", "Image trop volumineuse (max ~4,5 Mo).");
    }
    const knownUtensils = knownUtensilsFrom(request);

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
      throw new HttpsError("internal", `Erreur inattendue : ${e instanceof Error ? e.message : e}`);
    }
  }
);
