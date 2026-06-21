// ─── EXPORT PDF ───────────────────────────────────────────────────────────────
// Génération de la page imprimable d'une recette. `buildRecipePdfHtml` est pure
// (recette + bases → chaîne HTML) et donc testable ; `printRecipe` n'est que la
// fine couche d'effets de bord (ouverture de fenêtre + impression).

const NUTRI_COLORS_PDF = { A: "#1a8a3c", B: "#85bb2f", C: "#f9c813", D: "#e07515", E: "#e63312" };

export function buildRecipePdfHtml(recipe, { ingredientDB = [], utensilDB = [] } = {}) {
  const ingImg = dbId => ingredientDB.find(d => d.id === dbId)?.image || "";
  const utImg = dbId => utensilDB.find(d => d.id === dbId)?.image || "";
  const pill = (img, name, qty) =>
    `<span class="pill"><span class="pill-img">${img ? `<img src="${img}" alt="" />` : ""}</span><span class="pill-name">${name}</span>${qty ? `<span class="pill-qty">${qty}</span>` : ""}</span>`;
  const ingPills = recipe.ingredients.map(i => pill(ingImg(i.dbId), i.name, `${i.amount}${i.unit || ""}`)).join("");
  const nutriBadge = letter => {
    if (!letter) return "";
    return `<div class="nutri-badge">
      ${["A", "B", "C", "D", "E"].map(l => {
        const active = l === letter;
        return `<span class="nl" style="background:${NUTRI_COLORS_PDF[l]};width:${active ? 21 : 15}px;height:${active ? 25 : 18}px;border-radius:${active ? 5 : 3}px;opacity:${active ? 1 : 0.5};font-size:${active ? 14 : 10}px">${l}</span>`;
      }).join("")}
    </div>`;
  };
  const stepLines = recipe.steps.map((s, i) => {
    const linkedIngs = recipe.ingredients.filter(x => s.ingredients?.includes(x.id)).map(x => pill(ingImg(x.dbId), x.name, `${x.amount}${x.unit || ""}`)).join("");
    const linkedUts = (recipe.utensils || []).filter(u => s.utensils?.includes(u.id)).map(u => pill(utImg(u.dbId), u.name, "")).join("");
    const pills = linkedIngs + linkedUts;
    return `
      <div class="step">
        <div class="step-header">
          <div class="step-num">${i + 1}</div>
          <div class="step-title">Étape ${i + 1}</div>
        </div>
        ${s.text ? `<p class="step-text">${s.text}</p>` : ""}
        ${pills ? `<div class="step-pills">${pills}</div>` : ""}
      </div>`;
  }).join("");
  const utPills = (recipe.utensils || []).map(u => pill(utImg(u.dbId), u.name, "")).join("");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${recipe.name} — Mijoté</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,300&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --accent: #e8703a; --text: #1a1714; --text2: #5a5250; --text3: #9a9490; --border: #e8e0d8; --surface: #f9f6f2; }
    body { font-family: 'DM Sans', sans-serif; color: var(--text); background: #fff; max-width: 720px; margin: 0 auto; padding: 40px 22px 56px; font-size: 14px; line-height: 1.6; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hero { width: 100%; height: 230px; object-fit: cover; border-radius: 14px; margin-bottom: 24px; display: block; }
    /* Header */
    .header { padding-bottom: 4px; margin-bottom: 12px; }
    h1 { font-family: 'Fraunces', serif; font-size: 38px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 14px; color: var(--text); }
    .title-rule { width: 48px; height: 4px; border-radius: 4px; background: var(--accent); margin-bottom: 22px; }
    .meta { display: flex; gap: 38px; flex-wrap: wrap; align-items: flex-start; margin-bottom: 0; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; font-weight: 500; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    .meta-val { height: 27px; display: flex; align-items: center; }
    .meta-value { font-size: 16px; font-weight: 600; color: var(--text); line-height: 1; }
    /* Nutri-Score badge */
    .nutri-badge { display: inline-flex; align-items: center; gap: 2px; background: #f9f6f2; border: 1px solid #e8e0d8; border-radius: 6px; padding: 3px 4px; }
    .nl { display: inline-flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; line-height: 1; }
    /* Section titles */
    .section-title { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 500; color: var(--text); margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
    /* Ingredients & step pills */
    .pill { display: inline-flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 4px 13px 4px 4px; font-size: 13px; vertical-align: middle; }
    .pill-img { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: #fff; border: 1px solid var(--border); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
    .pill-img img { width: 100%; height: 100%; object-fit: cover; }
    .pill-name { font-weight: 500; color: var(--text); }
    .pill-qty { color: var(--text3); font-weight: 500; }
    .ing-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    /* Steps */
    .step { margin-bottom: 22px; }
    .step-header { display: flex; align-items: center; gap: 12px; margin-bottom: 2px; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .step-title { font-weight: 700; font-size: 14px; color: var(--accent); }
    .step-text { color: var(--text2); line-height: 1.65; padding-left: 40px; }
    .step-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; padding-left: 40px; }
    /* Footer */
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text3); }
    .footer-brand { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 500; color: var(--text); letter-spacing: -0.01em; }
    .footer-brand .dot { color: var(--accent); }
    @page { margin: 16mm 14mm; }
    @media print {
      body { max-width: none; margin: 0; padding: 0; font-size: 12px; }
      .hero { height: 200px; break-inside: avoid; }
      .header { break-inside: avoid; }
      .section-title { break-after: avoid; page-break-after: avoid; }
      .pill { break-inside: avoid; page-break-inside: avoid; }
      .step { break-inside: avoid; page-break-inside: avoid; }
      .step-pills { break-inside: avoid; page-break-inside: avoid; }
      .footer { break-inside: avoid; page-break-inside: avoid; }
      p { orphans: 3; widows: 3; }
    }
  </style>
</head>
<body>
  ${recipe.image ? `<img class="hero" src="${recipe.image}" alt="${recipe.name}" />` : ""}
  <div class="header">
    <h1>${recipe.name}</h1>
    <div class="title-rule"></div>
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Préparation</span><div class="meta-val"><span class="meta-value">${recipe.prepTime} min</span></div></div>
      <div class="meta-item"><span class="meta-label">Cuisson</span><div class="meta-val"><span class="meta-value">${recipe.cookTime} min</span></div></div>
      <div class="meta-item"><span class="meta-label">Portions</span><div class="meta-val"><span class="meta-value">${recipe.servings}</span></div></div>
      ${recipe.nutriLetter ? `<div class="meta-item"><span class="meta-label">Nutri-Score</span><div class="meta-val">${nutriBadge(recipe.nutriLetter)}</div></div>` : ""}
    </div>
  </div>

  ${recipe.ingredients?.length ? `
  <div class="section-title">Ingrédients</div>
  <div class="ing-pills">${ingPills}</div>` : ""}

  ${utPills ? `
  <div class="section-title">Ustensiles</div>
  <div class="ing-pills" style="margin-bottom:20px">${utPills}</div>` : ""}

  ${recipe.steps?.length ? `
  <div class="section-title">Étapes</div>
  ${stepLines}` : ""}

  <div class="footer">
    <span class="footer-brand">Mijoté<span class="dot">·</span></span>
    ${recipe.source ? `<span>Source : <a href="${recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source}" style="color:var(--accent)">${recipe.source.replace(/^https?:\/\//, "")}</a></span>` : ""}
  </div>
</body>
</html>`;
}

// Ouvre la fenêtre d'impression et déclenche le print une fois le héros chargé.
export function printRecipe(recipe, dbs) {
  const html = buildRecipePdfHtml(recipe, dbs);
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  const heroImg = w.document.querySelector(".hero");
  if (heroImg && !heroImg.complete) {
    heroImg.onload = heroImg.onerror = () => setTimeout(() => w.print(), 300);
  } else {
    setTimeout(() => w.print(), 1200);
  }
}
