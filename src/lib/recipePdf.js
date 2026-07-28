// ─── EXPORT PDF ───────────────────────────────────────────────────────────────
// `buildRecipePdfHtml` est pure (recette + bases → chaîne HTML).
// `recipesById` (Map<id, recipe>) permet de résoudre les lignes composant
// et de générer une annexe « Préparations de base » en fin de document.
// `printRecipe` ouvre le document et lance l'impression du navigateur (« Enregistrer
// en PDF ») : texte sélectionnable et rendu fidèle.

import { createIngredientResolver } from "./nameMatcher.js";
import { isRecipeVegan } from "./dietary.js";
import { categoryLabel, categoryEmoji } from "../constants/recipeCategories.js";
import { cuisineEmoji, normalizeCuisine } from "../constants/cuisines.js";
import { DIFFICULTY_LABEL, computeDifficulty } from "./difficulty.js";
import { fmtQtyUnit } from "./format.js";

// Couleur de difficulté en hex (le PDF n'a pas les variables CSS --green/--red).
const diffColorPdf = (lvl) => (lvl <= 2 ? "#4caf7d" : lvl === 3 ? "#e8920a" : "#e05252");

const NUTRI_COLORS_PDF = { A: "#1a8a3c", B: "#85bb2f", C: "#f9c813", D: "#e07515", E: "#e63312" };
const num = v => parseFloat(String(v).replace(",", ".")) || 0;

export function buildRecipePdfHtml(recipe, { ingredientDB = [], utensilDB = [], recipesById, techniques = [] } = {}) {
  const ingImg = dbId => ingredientDB.find(d => d.id === dbId)?.image || "";
  const utImg = dbId => utensilDB.find(d => d.id === dbId)?.image || "";

  // Badges : « Vegan » (même look que dans l'app : pill vert + feuille), type de
  // recette et cuisine. Superposés en haut à droite DANS l'image du plat ; en
  // l'absence d'image, repli en pills claires sous le titre.
  const recipesList = recipesById ? [...recipesById.values()] : [];
  const resolver = createIngredientResolver(ingredientDB || []);
  const vegan = isRecipeVegan(recipe, resolver, { recipes: recipesList });
  const leafSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;
  const cuisineFlag = recipe.cuisine ? cuisineEmoji(normalizeCuisine(recipe.cuisine)) : "";

  // Lien source : badge en bas à gauche DANS l'image (domaine affiché, URL
  // complète cliquable). Repli dans le pied de page en l'absence d'image.
  const sourceUrl = recipe.source ? (recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source) : "";
  const sourceText = recipe.source ? recipe.source.replace(/^https?:\/\//, "").replace(/\/+$/, "") : "";
  const sourceDomain = sourceText.split("/")[0];
  const linkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>`;
  const heroSource = recipe.source ? `<a class="hero-source" href="${sourceUrl}">${linkSvg}<span class="hs-txt">${sourceDomain}</span></a>` : "";
  const heroBadges = [
    vegan ? `<span class="hbadge hbadge-vegan">${leafSvg}<span class="hb-txt">Vegan</span></span>` : "",
    recipe.category ? `<span class="hbadge hbadge-dark"><span class="hb-emoji">${categoryEmoji(recipe.category)}</span><span class="hb-txt">${categoryLabel(recipe.category)}</span></span>` : "",
    recipe.cuisine ? `<span class="hbadge hbadge-dark"><span class="hb-emoji">${cuisineFlag}</span><span class="hb-txt">${recipe.cuisine}</span></span>` : "",
  ].filter(Boolean).join("");
  // Repli (sans image) : pills claires lisibles sur fond blanc.
  const tagChips = [
    vegan ? `<span class="tag tag-vegan"><span class="tag-emoji">🌱</span>Vegan</span>` : "",
    recipe.category ? `<span class="tag"><span class="tag-emoji">${categoryEmoji(recipe.category)}</span>${categoryLabel(recipe.category)}</span>` : "",
    recipe.cuisine ? `<span class="tag"><span class="tag-emoji">${cuisineFlag}</span>${recipe.cuisine}</span>` : "",
  ].filter(Boolean).join("");

  // Difficulté (à droite du Nutri-Score) : calculée comme dans l'app (gestes
  // techniques), pas seulement lue sur recipe.difficulty. 5 pastilles + libellé.
  const diffScore = computeDifficulty(recipe, techniques || [], { recipes: recipesList }).score;
  const difficultyMeta = diffScore
    ? `<div class="meta-item"><span class="meta-label">Difficulté</span><div class="meta-val" style="gap:9px">
        <span class="diff-dots">${[1, 2, 3, 4, 5].map(i => `<span class="dd" style="background:${i <= diffScore ? diffColorPdf(diffScore) : "#e0d8d0"}"></span>`).join("")}</span>
        <span class="meta-value" style="font-size:14px">${DIFFICULTY_LABEL[diffScore] || ""}</span>
      </div></div>`
    : "";

  // Icône « base » (casserole) – SVG inline, cohérente avec l'app.
  const baseIconSvg = (size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#e8703a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1.5 9H7.5L6 8Z"/><line x1="5" y1="8" x2="19" y2="8"/><path d="M6 10H3.5a1.5 1.5 0 0 0 0 3H6"/><path d="M18 10h2.5a1.5 1.5 0 0 1 0 3H18"/><path d="M10 5c0-1 1-1 1-2"/><path d="M14 5c0-1 1-1 1-2"/></svg>`;

  const pill = (imgOrEmoji, name, qty, isComp = false) => {
    const imgHtml = isComp
      ? `<span class="pill-comp-icon">${baseIconSvg(15)}</span>`
      : (imgOrEmoji ? `<span class="pill-img"><img src="${imgOrEmoji}" alt="" /></span>` : `<span class="pill-img"></span>`);
    return `<span class="pill${isComp ? " pill-comp" : ""}">
      ${imgHtml}
      <span class="pill-name">${name}</span>
      ${qty ? `<span class="pill-qty">${qty}</span>` : ""}
    </span>`;
  };

  const ingPill = (ing) => {
    const isComp = !!ing.recipeId && !ing.dbId;
    if (isComp) {
      const comp = recipesById?.get(ing.recipeId);
      const name = comp?.name || ing.name || "Préparation";
      const img = comp?.image || null;
      // Si on a une image de la recette de base, on l'affiche ; sinon icône casserole.
      return img
        ? pill(img, name, fmtQtyUnit(ing.amount, ing.unit))
        : pill(null, name, fmtQtyUnit(ing.amount, ing.unit), true);
    }
    return pill(ingImg(ing.dbId), ing.name, fmtQtyUnit(ing.amount, ing.unit));
  };

  const ingPills = (recipe.ingredients || []).map(ingPill).join("");

  const nutriBadge = letter => {
    if (!letter) return "";
    return `<div class="nutri-badge">
      ${["A", "B", "C", "D", "E"].map(l => {
        const active = l === letter;
        return `<span class="nl" style="background:${NUTRI_COLORS_PDF[l]};width:${active ? 21 : 15}px;height:${active ? 25 : 18}px;border-radius:${active ? 5 : 3}px;opacity:${active ? 1 : 0.5};font-size:${active ? 14 : 10}px">${l}</span>`;
      }).join("")}
    </div>`;
  };

  const stepLines = (recipe.steps || []).map((s, i) => {
    const linkedIngs = (recipe.ingredients || []).filter(x => s.ingredients?.includes(x.id)).map(ingPill).join("");
    const linkedUts = (recipe.utensils || []).filter(u => s.utensils?.includes(u.id)).map(u => pill(utImg(u.dbId), u.name, "")).join("");
    const pills = linkedIngs + linkedUts;
    return `
      <div class="step">
        <div class="step-header">
          <div class="step-num">${i + 1}</div>
          <div class="step-title">Étape ${i + 1}</div>
        </div>
        ${s.text ? `<p class="step-text">${s.text}</p>` : ""}
        ${s.tip ? `<div class="step-tip"><span class="step-tip-ico"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.9 1 1 1.7l.1.5h5l.1-.5c.1-.7.5-1.3 1-1.7A6 6 0 0 0 12 3Z" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="step-tip-body">${s.tip}</span></div>` : ""}
        ${pills ? `<div class="step-pills">${pills}</div>` : ""}
      </div>`;
  }).join("");

  const utPills = (recipe.utensils || []).map(u => pill(utImg(u.dbId), u.name, "")).join("");

  // ── Annexe « Préparations de base » ─────────────────────────────────────────
  // Pour chaque ligne composant, on imprime une mini-recette mise à l'échelle par
  // f = quantité_consommée / rendement, afin que le document soit autonome.
  const componentLines = (recipe.ingredients || []).filter(ing => ing.recipeId && !ing.dbId);
  let annexeHtml = "";
  if (recipesById && componentLines.length > 0) {
    const annexeBlocks = componentLines.map(line => {
      const comp = recipesById.get(line.recipeId);
      if (!comp || !(comp.yield && comp.yield.amount > 0)) return "";
      const f = num(line.amount) / comp.yield.amount;

      const scaledIngPills = (comp.ingredients || []).map(ci => {
        if (ci.recipeId) return ""; // v1 : pas d'imbrication
        const qty = +(num(ci.amount) * f).toFixed(2);
        return pill(ingImg(ci.dbId), ci.name, fmtQtyUnit(qty, ci.unit));
      }).join("");

      // Pill d'un ingrédient du composant, quantité mise à l'échelle par f.
      const compIngPill = ci => {
        if (ci.recipeId) return ""; // v1 : pas d'imbrication
        const qty = +(num(ci.amount) * f).toFixed(2);
        return pill(ingImg(ci.dbId), ci.name, fmtQtyUnit(qty, ci.unit));
      };

      const compStepLines = (comp.steps || []).map((s, i) => {
        const stepIngs = (comp.ingredients || []).filter(x => s.ingredients?.includes(x.id)).map(compIngPill).join("");
        const stepUts = (comp.utensils || []).filter(u => s.utensils?.includes(u.id)).map(u => pill(utImg(u.dbId), u.name, "")).join("");
        const stepPills = stepIngs + stepUts;
        return `
        <div class="step comp-step" style="margin-bottom:12px">
          <div class="step-header" style="gap:10px;margin-bottom:3px">
            <div class="step-num" style="width:22px;height:22px;font-size:11px">${i + 1}</div>
            <div class="step-title" style="font-size:13px">Étape ${i + 1}</div>
          </div>
          ${s.text ? `<p class="step-text" style="font-size:13px;padding-left:32px;line-height:1.5">${s.text}</p>` : ""}
          ${stepPills ? `<div class="step-pills" style="padding-left:32px;margin-top:8px">${stepPills}</div>` : ""}
        </div>`;
      }).join("");

      const yieldScaled = +(comp.yield.amount * f).toFixed(1);

      return `
        <div class="comp-block">
          <div class="comp-header">
            <span class="comp-icon">${baseIconSvg(20)}</span>
            <span class="comp-name">${comp.name}</span>
            <span class="comp-yield">${fmtQtyUnit(yieldScaled, comp.yield.unit)}</span>
          </div>
          ${scaledIngPills ? `<div class="ing-pills" style="margin-bottom:14px">${scaledIngPills}</div>` : ""}
          ${compStepLines}
        </div>`;
    }).filter(Boolean).join("");

    if (annexeBlocks) {
      annexeHtml = `
        <div class="section-title">Bases</div>
        <p style="font-size:13px;color:var(--text3);margin-bottom:20px">À réaliser avant de commencer. Quantités ajustées pour cette recette (${recipe.servings || 1} portion${(recipe.servings || 1) > 1 ? "s" : ""}).</p>
        ${annexeBlocks}`;
    }
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${recipe.name} – Mijoté</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,300&family=Hanken+Grotesk:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --accent: #e8703a; --text: #1a1714; --text2: #5a5250; --text3: #9a9490; --border: #e8e0d8; --surface: #f9f6f2; }
    body { font-family: 'Hanken Grotesk', sans-serif; color: var(--text); background: #fff; max-width: 720px; margin: 0 auto; padding: 40px 22px 56px; font-size: 14px; line-height: 1.6; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hero-wrap { position: relative; margin-bottom: 24px; }
    .hero { width: 100%; height: 230px; object-fit: cover; border-radius: 14px; display: block; }
    .hero-badges { position: absolute; top: 12px; right: 12px; display: flex; flex-direction: column; align-items: flex-end; gap: 7px; }
    .hbadge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px 5px 8px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.35); box-shadow: 0 2px 8px rgba(0,0,0,0.28); }
    .hbadge svg { width: 12px; height: 12px; }
    .hbadge .hb-emoji { font-size: 12px; line-height: 1; }
    .hbadge .hb-txt { font-size: 10px; font-weight: 700; color: #fff; letter-spacing: 0.06em; text-transform: uppercase; }
    .hbadge-vegan { background: rgba(76,175,125,0.92); }
    .hbadge-dark { background: rgba(20,18,16,0.58); }
    .hero-source { position: absolute; left: 12px; bottom: 12px; display: inline-flex; align-items: center; gap: 6px; max-width: 62%; padding: 5px 12px 5px 9px; border-radius: 20px; background: rgba(20,18,16,0.58); border: 1px solid rgba(255,255,255,0.35); box-shadow: 0 2px 8px rgba(0,0,0,0.28); text-decoration: none; }
    .hero-source svg { width: 12px; height: 12px; flex-shrink: 0; }
    .hero-source .hs-txt { font-size: 10.5px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .header { padding-bottom: 4px; margin-bottom: 12px; }
    h1 { font-family: 'Fraunces', serif; font-size: 38px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 14px; color: var(--text); }
    .title-rule { width: 48px; height: 4px; border-radius: 4px; background: var(--accent); margin-bottom: 18px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
    .tag { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--text2); background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 4px 12px; }
    .tag-emoji { font-size: 13px; line-height: 1; }
    .tag-vegan { color: #2f8f4e; background: rgba(76,175,125,0.12); border-color: rgba(76,175,125,0.4); }
    .meta { display: flex; gap: 38px; flex-wrap: wrap; align-items: flex-start; margin-bottom: 0; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; font-weight: 500; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    .meta-val { height: 27px; display: flex; align-items: center; }
    .meta-value { font-size: 16px; font-weight: 600; color: var(--text); line-height: 1; }
    .nutri-badge { display: inline-flex; align-items: center; gap: 2px; background: #f9f6f2; border: 1px solid #e8e0d8; border-radius: 6px; padding: 3px 4px; }
    .diff-dots { display: inline-flex; align-items: center; gap: 4px; }
    .dd { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .nl { display: inline-flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; line-height: 1; }
    .section-title { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 500; color: var(--text); margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
    /* Pills */
    .pill { display: inline-flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 4px 13px 4px 4px; font-size: 13px; vertical-align: middle; }
    .pill-comp { border-color: rgba(232,112,58,0.4); background: rgba(232,112,58,0.06); }
    .pill-img { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: #fff; border: 1px solid var(--border); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
    .pill-img img { width: 100%; height: 100%; object-fit: contain; padding: 8%; box-sizing: border-box; }
    .pill-comp-icon { width: 28px; height: 28px; border-radius: 50%; background: rgba(232,112,58,0.12); display: inline-flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
    .pill-name { font-weight: 500; color: var(--text); }
    .pill-comp .pill-name { color: var(--accent); }
    .pill-qty { color: var(--text3); font-weight: 500; }
    .ing-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    /* Steps */
    .step { margin-bottom: 22px; }
    .step-header { display: flex; align-items: center; gap: 12px; margin-bottom: 2px; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .step-title { font-weight: 700; font-size: 14px; color: var(--accent); }
    .step-text { color: var(--text2); line-height: 1.65; padding-left: 40px; }
    .step-tip { display: flex; gap: 9px; align-items: center; margin: 9px 0 0 40px; padding: 8px 12px; background: rgba(91,156,246,0.10); border: 1px solid rgba(91,156,246,0.30); border-left: 3px solid #5b9cf6; border-radius: 9px; font-size: 12.5px; line-height: 1.5; }
    .step-tip-ico { flex-shrink: 0; width: 20px; height: 20px; border-radius: 6px; background: #5b9cf6; display: inline-flex; align-items: center; justify-content: center; }
    .step-tip-body { color: var(--text2); }
    .step-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; padding-left: 40px; }
    /* Annexe composants */
    .comp-block { margin-bottom: 28px; padding: 16px; background: var(--surface); border-radius: 10px; border: 1px solid var(--border); }
    .comp-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .comp-icon { display: inline-flex; align-items: center; }
    .comp-name { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 600; color: var(--text); flex: 1; }
    .comp-yield { font-size: 12px; color: var(--text3); background: rgba(232,112,58,0.1); border-radius: 20px; padding: 3px 10px; }
    /* Footer */
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text3); }
    .footer-brand { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 500; color: var(--text); letter-spacing: -0.01em; }
    .footer-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; text-align: right; }
    .footer-brand .dot { color: var(--accent); }
    .footer-gen { display: inline-flex; align-items: center; gap: 8px; }
    .version-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; color: #fff; background: var(--text); border-radius: 6px; padding: 2px 7px 2px 5px; letter-spacing: 0.02em; }
    .version-badge svg { width: 10px; height: 10px; }
    @page { margin: 16mm 14mm; }
    @media print {
      body { max-width: none; margin: 0; padding: 0; font-size: 12px; }
      .hero { height: 200px; }
      .section-title { break-after: avoid; page-break-after: avoid; }
      .step-header { break-after: avoid; page-break-after: avoid; }
      /* Une étape ne doit jamais être coupée entre deux pages (texte + astuce +
         pastilles restent solidaires). Si elle ne tient pas, elle bascule en entier
         sur la page suivante. */
      .step { break-inside: avoid; page-break-inside: avoid; }
      p { orphans: 3; widows: 3; }
    }
  </style>
</head>
<body>
  ${recipe.image
      ? `<div class="hero-wrap"><img class="hero" src="${recipe.image}" alt="${recipe.name}" />${heroBadges ? `<div class="hero-badges">${heroBadges}</div>` : ""}${heroSource}</div>`
      : ""}
  <div class="header">
    <h1>${recipe.name}</h1>
    <div class="title-rule"></div>
    ${!recipe.image && tagChips ? `<div class="tags">${tagChips}</div>` : ""}
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Préparation</span><div class="meta-val"><span class="meta-value">${recipe.prepTime} min</span></div></div>
      <div class="meta-item"><span class="meta-label">Cuisson</span><div class="meta-val"><span class="meta-value">${recipe.cookTime} min</span></div></div>
      <div class="meta-item"><span class="meta-label">Portions</span><div class="meta-val"><span class="meta-value">${recipe.servings}</span></div></div>
      ${recipe.nutriLetter ? `<div class="meta-item"><span class="meta-label">Nutri-Score</span><div class="meta-val">${nutriBadge(recipe.nutriLetter)}</div></div>` : ""}
      ${difficultyMeta}
    </div>
  </div>

  ${(recipe.ingredients || []).length ? `
  <div class="section-title">Ingrédients</div>
  <div class="ing-pills">${ingPills}</div>` : ""}

  ${utPills ? `
  <div class="section-title">Ustensiles</div>
  <div class="ing-pills" style="margin-bottom:20px">${utPills}</div>` : ""}

  ${annexeHtml}

  ${(recipe.steps || []).length ? `
  <div class="section-title">Étapes</div>
  ${stepLines}` : ""}

  <div class="footer">
    <span class="footer-brand">Mijoté<span class="dot">·</span></span>
    <span class="footer-meta">
      <span class="footer-gen">Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}${recipe.history?.length ? `<span class="version-badge"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="12" x2="15" y2="14"/></svg>${recipe.history[recipe.history.length - 1].label}</span>` : ""}</span>
    </span>
  </div>
</body>
</html>`;
}

// Ouvre le document dans un nouvel onglet et lance l'impression du navigateur
// (l'utilisateur choisit « Enregistrer en PDF »). Texte sélectionnable, rendu
// fidèle. On attend le chargement de l'image de tête pour éviter un aperçu vide.
export function printRecipe(recipe, dbs = {}) {
  const html = buildRecipePdfHtml(recipe, dbs);
  const w = window.open("", "_blank");
  if (!w) return; // popup bloquée
  w.document.write(html);
  w.document.close();
  const heroImg = w.document.querySelector(".hero");
  if (heroImg && !heroImg.complete) {
    heroImg.onload = heroImg.onerror = () => setTimeout(() => w.print(), 300);
  } else {
    setTimeout(() => w.print(), 1200);
  }
}
