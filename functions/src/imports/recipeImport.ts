/**
 * Import de recette par IA (Cloud Functions).
 *
 * Deux points d'entrée `onCall`, tous deux réservés côté serveur (admin illimité,
 * abonné Mijoté+ avec quota, cf. {@link assertImportAllowed}), jamais en masquant
 * un simple bouton :
 * - {@link importRecipeFromUrl} : extraction depuis une URL (Claude Haiku 4.5) ;
 * - {@link importRecipeFromImages} : extraction depuis 1–2 photos de livre (Sonnet).
 *
 * Le résultat brut du modèle est mis en forme par le module `recipeExtract`
 * ({@link assignIdsAndLink} : ids stables, `_raw` éditable, liaisons ingrédients/
 * ustensiles ↔ étapes, images d'étape pour l'URL).
 *
 * @module imports/recipeImport
 */
import * as logger from "firebase-functions/logger";
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
import { assertImportAllowed } from "../quota/access.js";

/** Clé API Anthropic (secret), l'extraction IA est refusée si elle est absente. */
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
/** E-mail de l'admin autorisé (le créateur), paramètre non secret. */
const ADMIN_EMAIL = defineString("ADMIN_EMAIL");

/** Garde-fou : on ne télécharge pas des pages HTML au-delà de cette taille. */
const MAX_HTML_BYTES = 3_000_000;
/** Délai maximal de récupération d'une page avant abandon. */
const FETCH_TIMEOUT_MS = 15_000;
/** Modèle d'extraction pour l'URL (texte déjà propre). */
const MODEL = "claude-haiku-4-5";
/**
 * Modèle d'extraction pour les PHOTOS. L'OCR d'une page de livre exige une bien
 * meilleure vision que l'URL : on confie ce cas à Sonnet, plus fiable sur les
 * quantités et la mise en page, et capable de haute résolution.
 */
const VISION_MODEL = "claude-sonnet-5";

/**
 * Prompt système d'extraction, chargé depuis le Markdown éditable
 * `prompts/recipeExtract.md`. Ce fichier reste à la racine `functions/` alors que
 * le code compilé vit dans `lib/imports/`, d'où les deux « .. ». La liste des
 * cuisines est injectée au démarrage ; les ustensiles connus le sont par appel.
 */
const PROMPT_TEMPLATE = fs
  .readFileSync(path.join(__dirname, "..", "..", "prompts", "recipeExtract.md"), "utf-8")
  .replace("{{CUISINE_LIST}}", CUISINE_LABELS.join(", "));

/**
 * Addendum spécifique à l'import PHOTO (mise en page livre/magazine : colonne
 * d'ingrédients, deux pages, encarts à ignorer, images d'étape toujours vides…).
 * Concaténé après le prompt de base, dont il complète et prime les règles.
 */
const IMG_PROMPT_ADDENDUM = fs.readFileSync(path.join(__dirname, "..", "..", "prompts", "recipeExtractImage.md"), "utf-8");

/**
 * Extrait un objet JSON d'une réponse LLM, en tolérant les fences ```json et le
 * texte parasite autour de l'objet.
 *
 * @param s - La réponse texte brute du modèle.
 * @returns L'objet analysé (typé `unknown` : payload externe non fiable).
 * @throws SyntaxError si aucun JSON exploitable n'est trouvé.
 */
function parseJsonLoose(s: string): unknown {
  let t = (s || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

/**
 * Récupère le HTML d'une page côté serveur (pas de CORS), avec un UA de navigateur
 * (beaucoup de sites renvoient une page vide aux bots), un timeout et une taille
 * bornée pour éviter les abus.
 *
 * @param url - L'URL de la page à récupérer.
 * @returns Le HTML décodé en UTF-8.
 * @throws HttpsError `unavailable` / `invalid-argument` / `deadline-exceeded`
 *   selon l'échec (réseau, type de contenu, page trop lourde ou trop lente).
 */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
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

/** Brouillon JSON brut renvoyé par le LLM (données externes non fiables). */
type LlmDraft = Record<string, unknown> & {
  name?: string; prepTime?: number; cookTime?: number; servings?: number;
  cuisine?: string; category?: string;
  ingredients?: { name?: string; amount?: unknown; unit?: unknown; raw?: string; group?: unknown }[];
  utensils?: { name?: string }[];
  steps?: { text?: string; tip?: string; image?: unknown; ingredients?: unknown[]; utensils?: unknown[]; group?: unknown }[];
  /** Numéro (1-based) de l'image qui est la photo du plat, 0/absent si aucune. */
  coverPhoto?: unknown;
};

/**
 * Normalise le brouillon LLM brut en forme INTERMÉDIAIRE (avant ids/liaisons) :
 * champs tronqués et bornés, `_raw` (ligne d'origine éditable) conservé, listes de
 * noms d'ingrédients/ustensiles par étape préservées pour la liaison ultérieure.
 *
 * @param d - Le brouillon brut du modèle.
 * @param sourceUrl - L'URL source (vide pour un import photo).
 * @returns Le brouillon intermédiaire prêt pour {@link assignIdsAndLink}.
 */
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
      const group = (typeof i.group === "string" ? i.group : "").trim(); if (group) ing.group = group.slice(0, 80);
      return ing;
    }).filter((i) => i.name),
    utensils: (d.utensils || []).map((u) => ({ name: (u.name || "").slice(0, 60) })).filter((u) => u.name),
    steps: (d.steps || []).map((s) => {
      const step: Intermediate["steps"][number] = {
        text: (s.text || "").slice(0, 2000),
        tip: (s.tip && s.tip.trim()) ? s.tip.slice(0, 500) : "",
        image: (s.image || "").toString().slice(0, 500),
        ingredients: Array.isArray(s.ingredients) ? s.ingredients.map((x) => String(x)) : [],
        utensils: Array.isArray(s.utensils) ? s.utensils.map((x) => String(x)) : [],
      };
      const group = (typeof s.group === "string" ? s.group : "").trim(); if (group) step.group = group.slice(0, 80);
      return step;
    }).filter((s) => s.text),
  };
}

/** Une image fournie par le client (base64 + type MIME). */
interface InputImage {
  mediaType: string;
  data: string;
}

/** Types MIME d'image acceptés pour l'import photo. */
const IMG_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
/** Taille maximale d'une image encodée en base64 (~4,5 Mo décodés). */
const MAX_IMG_B64 = 6_000_000;

/**
 * Extrait une recette depuis une ou deux PHOTOS (pages d'un livre de cuisine).
 * Même schéma de sortie que l'extraction web, mais sans images d'étape (une photo
 * de page n'expose pas d'URL d'illustration exploitable).
 *
 * @param images - Les images (base64 + type MIME) déjà validées par l'appelant.
 * @param knownUtensils - Noms d'ustensiles connus (base master) pour borner le modèle.
 * @returns Le brouillon intermédiaire et `coverIndex` : l'index 0-based de l'image
 *   qui est la photo du plat (couverture), ou `-1` si aucune.
 * @throws HttpsError `failed-precondition` si la clé IA manque, `internal` si la
 *   réponse du modèle est vide ou illisible.
 */
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
    logger.error("Anthropic API error (images):", err?.status, err?.name, err?.message);
    throw new HttpsError("internal", `Extraction IA échouée : ${err?.message || "erreur API"}`);
  }
  const block = (response.content || []).find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new HttpsError("internal", "Réponse IA vide.");
  let parsed: LlmDraft;
  try { parsed = parseJsonLoose(block.text) as LlmDraft; }
  catch { throw new HttpsError("internal", "Réponse IA illisible (JSON non exploitable)."); }
  // Conversion du numéro 1-based du modèle en index 0-based validé (-1 = aucune).
  const cp = Number(parsed.coverPhoto);
  const coverIndex = Number.isInteger(cp) && cp >= 1 && cp <= images.length ? cp - 1 : -1;
  logRawModelJson("images", block.text);
  logDetectedGroups("images", parsed);
  return { inter: llmToIntermediate(parsed, ""), coverIndex };
}

/**
 * Extrait une recette depuis le TEXTE d'une page web via le LLM. Le chemin JSON-LD
 * a été abandonné : à qualité de rendu, l'extraction Haiku est meilleure (étapes
 * reformulées, quantités estimées, liaisons ingrédients/ustensiles).
 *
 * @param text - Le texte lisible de la page (issu de {@link htmlToText}).
 * @param sourceUrl - L'URL source (reportée dans le brouillon).
 * @param knownUtensils - Noms d'ustensiles connus pour borner le modèle.
 * @returns Le brouillon intermédiaire.
 * @throws HttpsError `failed-precondition` si la clé IA manque, `internal` si la
 *   réponse est vide ou illisible.
 */
async function extractWithLlm(text: string, sourceUrl: string, knownUtensils: string[]): Promise<Intermediate> {
  const key = ANTHROPIC_API_KEY.value();
  if (!key || !key.startsWith("sk-ant-")) throw new HttpsError("failed-precondition", "Cette page n'a pas de données structurées et l'extraction IA n'est pas encore configurée (clé API Anthropic à renseigner).");
  const system = PROMPT_TEMPLATE.replace("{{UTENSILS}}", knownUtensils.length ? knownUtensils.join(", ") : "(aucun)");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: key });
  const body = text.slice(0, 24_000); // borne le coût (entrée)
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
    logger.error("Anthropic API error:", err?.status, err?.name, err?.message);
    throw new HttpsError("internal", `Extraction IA échouée : ${err?.message || "erreur API"}`);
  }
  const block = (response.content || []).find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new HttpsError("internal", "Réponse IA vide.");
  let parsed: LlmDraft;
  try { parsed = parseJsonLoose(block.text) as LlmDraft; }
  catch { throw new HttpsError("internal", "Réponse IA illisible (JSON non exploitable)."); }
  logRawModelJson("url", block.text);
  logDetectedGroups("url", parsed);
  return llmToIntermediate(parsed, sourceUrl);
}

/** Trace dans Cloud Logging les sections (`group`) renvoyées par le modèle, pour
 *  diagnostiquer un import (voir si la segmentation vient du modèle ou du pipeline). */
function logDetectedGroups(kind: string, d: LlmDraft): void {
  const ig = [...new Set((d.ingredients || []).map((i) => (typeof i.group === "string" ? i.group.trim() : "")).filter(Boolean))];
  const sg = [...new Set((d.steps || []).map((s) => (typeof s.group === "string" ? s.group.trim() : "")).filter(Boolean))];
  logger.info(`import[${kind}] sections détectées`, { ingredientGroups: ig, stepGroups: sg });
}

/** Trace le JSON BRUT renvoyé par le modèle (diagnostic). Tronqué à 12000 caractères
 *  pour rester lisible dans Cloud Logging. À retirer une fois l'import validé. */
function logRawModelJson(kind: string, raw: string): void {
  logger.debug(`import[${kind}] réponse brute du modèle`, { raw: (raw || "").slice(0, 12000) });
}

/**
 * Lit et borne la liste de noms d'ustensiles connus fournie par le client (base
 * master), elle sert à restreindre les propositions du modèle.
 *
 * @param request - La requête onCall.
 * @returns Les noms d'ustensiles (chaînes non vides, plafonnés à 200).
 */
function knownUtensilsFrom(request: CallableRequest): string[] {
  const raw = (request.data as { knownUtensils?: unknown })?.knownUtensils;
  return Array.isArray(raw) ? raw.map((s) => String(s)).filter(Boolean).slice(0, 200) : [];
}

/**
 * Importe une recette depuis une URL.
 *
 * Flux : garde d'accès + quota → récupération du HTML → texte → extraction Haiku →
 * `og:image` comme image principale, filtrage des ustensiles à la base master, et
 * images d'étape restreintes aux URLs réellement présentes dans la page
 * (anti-hallucination). Le brouillon est renvoyé, jamais enregistré directement.
 *
 * NB : réactiver `enforceAppCheck: true` (ici et sur {@link importRecipeFromImages})
 * une fois le front déployé avec la clé reCAPTCHA v3, sinon l'import serait rejeté.
 *
 * @returns `{ recipe, method: "llm" }`.
 * @throws HttpsError selon l'échec (accès/quota, URL, page, extraction).
 */
export const importRecipeFromUrl = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "europe-west1", timeoutSeconds: 60, memory: "512MiB" },
  async (request) => {
    await assertImportAllowed(request, ADMIN_EMAIL.value(), "url");

    const url = String((request.data as { url?: unknown })?.url || "").trim();
    if (!/^https?:\/\/.+/i.test(url)) throw new HttpsError("invalid-argument", "URL invalide.");
    const knownUtensils = knownUtensilsFrom(request);

    try {
      const html = await fetchHtml(url);
      const ogImage = extractOgImage(html); // image principale du plat
      const text = htmlToText(html);
      if (text.length < 200) throw new HttpsError("invalid-argument", "Page sans contenu exploitable (site protégé ou vide).");
      const inter = await extractWithLlm(text, url, knownUtensils);
      inter.image = ogImage;
      inter.utensils = filterUtensilsToKnown(collectUtensils(inter), knownUtensils);
      // Anti-hallucination : on ne garde que des URLs présentes dans la page, et
      // jamais l'image principale du plat.
      const pageImages = imageUrlsInText(text);
      for (const s of inter.steps) s.image = (s.image && s.image !== ogImage && pageImages.has(s.image)) ? s.image : "";
      const recipe = assignIdsAndLink(inter);
      if (!recipe.name || !recipe.ingredients.length) throw new HttpsError("not-found", "Aucune recette détectée sur cette page.");
      return { recipe, method: "llm" };
    } catch (e) {
      if (e instanceof HttpsError) throw e; // messages déjà lisibles
      logger.error("importRecipeFromUrl, erreur inattendue:", e);
      throw new HttpsError("internal", `Erreur inattendue : ${e instanceof Error ? e.message : e}`);
    }
  }
);

/**
 * Importe une recette depuis une ou deux photos (livre de cuisine). Même garde
 * serveur que l'URL (admin illimité, abonné avec quota) ; extraction par Sonnet,
 * sans images d'étape.
 *
 * @returns `{ recipe, method: "image", coverIndex }`, où `coverIndex` désigne
 *   l'image de couverture (photo du plat), ou `-1` si aucune.
 * @throws HttpsError selon l'échec (accès/quota, images invalides, extraction).
 */
export const importRecipeFromImages = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "europe-west1", timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
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
      return { recipe, method: "image", coverIndex };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      logger.error("importRecipeFromImages, erreur inattendue:", e);
      throw new HttpsError("internal", `Erreur inattendue : ${e instanceof Error ? e.message : e}`);
    }
  }
);
