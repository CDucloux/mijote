import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { Img, IngImage } from "../components/Img.jsx";
import { IngredientStatusBadge } from "../components/IngredientStatusBadge.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { ImageUpload } from "../components/ImageUpload.jsx";
import { TagInput } from "../components/TagInput.jsx";
import { OverscrollRow } from "../components/OverscrollRow.jsx";
import { ReadOnlyBanner, AdminBanner } from "../components/Banners.jsx";
import { IngredientDetail } from "../components/IngredientDetail.jsx";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { deleteImageByUrl } from "@/lib/firebase/storage.js";
import { ING_MD_COLUMNS, formatTips } from "@/lib/food/ingredientsMarkdown.js";
import {
  parseIngredientsYaml, parseUtensilsYaml, parseTechniquesYaml,
  formatTechniquesMarkdown, formatTechniquesYaml, formatIngredientsYaml, formatUtensilsYaml,
  TECHNIQUE_CATEGORIES, UTENSIL_CATEGORIES, slugifyId,
} from "@/lib/household/dataYaml.js";
import { APPLIANCE_LABELS } from "@/lib/utensils/appliances.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries } from "../constants/categories.js";
import { formatMonths } from "@/lib/food/seasonality.js";
import { CONFIG_SECTION_BY_PATH, CONFIG_PATH_BY_SECTION } from "../constants/tabs.js";
import { AdminDashboard } from "../components/AdminDashboard.jsx";
import { loadReports, resolveReport, resolveReportsForRecipe, deletePublicRecipe } from "@/lib/firebase/firestore.js";
import { DISCOVER_PREFIX } from "../hooks/usePublicRecipeView.js";

// ─── CONFIG TAB ───────────────────────────────────────────────────────────────

// Déclenche le téléchargement d'un fichier texte généré (export).
function downloadText(filename, text, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Zone d'import YAML réutilisable (ingrédients / ustensiles / techniques).
// Gère son propre input fichier et son état de survol ; délègue la lecture à
// `onText(contenu, nomFichier)`. L'export reste en Markdown (boutons dédiés).
function YamlImport({ onText, warn }) {
  const ref = useRef();
  const [over, setOver] = useState(false);
  const read = (f) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => { try { onText(String(ev.target.result), f.name); } catch { onText("", f.name); } };
    r.readAsText(f);
  };
  return (
    <>
      {warn && (
        <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12, lineHeight: 1.45 }}>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>Fusion dans la base</span> : chaque entrée est mise à jour (par id, sinon par nom) ou ajoutée – <span style={{ fontWeight: 600 }}>aucune entrée existante n'est supprimée</span>. À la moindre erreur, l'import est annulé en entier.
        </p>
      )}
      <input ref={ref} type="file" accept=".yaml,.yml,.txt" style={{ display: "none" }}
        onChange={e => { read(e.target.files[0]); e.target.value = ""; }} />
      <div
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); read(Array.from(e.dataTransfer.files).find(f => /\.(ya?ml|txt)$/i.test(f.name))); }}
        onClick={() => ref.current.click()}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "28px 20px", borderRadius: 12, border: `2px dashed ${over ? "var(--accent)" : "var(--border)"}`, background: over ? "rgba(var(--accent-rgb),0.06)" : "var(--surface2)", cursor: "pointer", transition: "all 0.15s" }}>
        <Icon name="import" size={28} color={over ? "var(--accent)" : "var(--text3)"} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: over ? "var(--accent)" : "var(--text)" }}>Dépose un fichier YAML ici</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>ou clique pour sélectionner</div>
        </div>
      </div>
    </>
  );
}


// Bloc réutilisable Export/Import YAML+Markdown d'une base master (ingrédients,
// ustensiles, techniques) : rendu et espacement IDENTIQUES quelle que soit la
// section. Autonome (gap interne) → plus de cartes « collées » selon le parent.
function BaseImportExport({ count, noun, exportTitle = "Exporter la base", importTitle = "Importer dans la base", onExportYaml, onExportMarkdown, onImportYaml, mdError, mdInfo }) {
  const card = { background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" };
  return (
    <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{exportTitle}</h3>
            <p style={{ fontSize: 12, color: "var(--text2)" }}>{count} {noun}{count > 1 ? "s" : ""} · <strong>YAML</strong> (réimportable, pour <code style={{ fontSize: 11 }}>data/</code>) ou Markdown (lecture)</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="btn btn-primary btn-sm" onClick={onExportYaml} style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="download" size={14} /> YAML</button>
            <button className="btn btn-ghost btn-sm" onClick={onExportMarkdown} style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="download" size={14} /> Markdown</button>
          </div>
        </div>
      </div>
      <div style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{importTitle}</h3>
        <YamlImport warn onText={onImportYaml} />
        {mdError && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{mdError}</p>}
        {mdInfo && <p style={{ color: "var(--accent)", fontSize: 12, marginTop: 8 }}>✓ {mdInfo}</p>}
      </div>
    </div>
  );
}

// Niveau de difficulté d'un geste : 5 pastilles, colorées vert→ambre→rouge.
const DIFFICULTY_COLOR = (lvl) => lvl <= 2 ? "var(--green)" : lvl === 3 ? "#e8920a" : "var(--red)";
const DIFFICULTY_LABEL = { 1: "Très facile", 2: "Facile", 3: "Intermédiaire", 4: "Difficile", 5: "Expert" };
function DifficultyPips({ level }) {
  if (!level) return null;
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }} title={`Difficulté ${level}/5 · ${DIFFICULTY_LABEL[level]}`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= level ? DIFFICULTY_COLOR(level) : "var(--surface3)" }} />)}
    </span>
  );
}

export function ConfigPage({ ingredientDB, setIngredientDB, utensilDB, setUtensilDB, isAdmin, categories = DEFAULT_CATEGORIES, setCategories, techniques = [], setTechniques }) {
  const navigate = useNavigate();
  const location = useLocation();
  const configSectionParam = location.pathname.startsWith("/admin/")
    ? location.pathname.slice(7) || undefined
    : undefined;
  const section = CONFIG_SECTION_BY_PATH[configSectionParam] || "dashboard";
  // Fiche ingrédient : /admin/ingredients/{id}
  const ingDetailMatch = location.pathname.match(/^\/admin\/ingredients\/(.+)$/);
  const ingDetailId = ingDetailMatch ? decodeURIComponent(ingDetailMatch[1]) : null;
  const setSection = (s) => navigate(`/admin/${CONFIG_PATH_BY_SECTION[s] || "ingredients"}`, { replace: true });
  useEffect(() => {
    if (!configSectionParam) navigate("/admin/dashboard", { replace: true });
  }, [configSectionParam]);
  // Filtre actif de la liste d'ingrédients (piloté par le dashboard).
  const [ingFilter, setIngFilter] = useState(null); // null | validated | draft | no-image | no-nutrition
  const gotoSection = (s, filter = null) => { setIngFilter(filter); setSection(s); };
  const [newIngId, setNewIngId] = useState(null); // brouillon d'ingrédient à ouvrir en édition
  const [editUt, setEditUt] = useState(null);
  const [editTech, setEditTech] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null); // { type: "ing" | "ut", item }
  const [dragCat, setDragCat] = useState(null); // key being dragged
  const [overCat, setOverCat] = useState(null); // key currently hovered as drop target

  // ── Modération : signalements de recettes publiques ─────────────────────────
  const [reports, setReports] = useState([]);
  const [modBusy, setModBusy] = useState(null);          // id (rejet) ou pubId (suppression) en cours
  const [confirmMod, setConfirmMod] = useState(null);    // { pubId, name }, confirmation de suppression
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    loadReports().then(r => { if (alive) setReports(r); }).catch(() => { });
    return () => { alive = false; };
  }, [isAdmin]);
  const dismissReport = async (id) => {
    setModBusy(id);
    try { await resolveReport(id); setReports(rs => rs.filter(r => r.id !== id)); } finally { setModBusy(null); }
  };
  const deleteReportedRecipe = async (pubId) => {
    setModBusy(pubId);
    try { await deletePublicRecipe(pubId); await resolveReportsForRecipe(pubId); setReports(rs => rs.filter(r => r.pubId !== pubId)); }
    finally { setModBusy(null); setConfirmMod(null); }
  };
  const [openCats, setOpenCats] = useState({});
  const [mdError, setMdError] = useState("");
  const [mdInfo, setMdInfo] = useState("");
  const toggleCat = k => setOpenCats(p => ({ ...p, [k]: !p[k] }));
  const [openTechCats, setOpenTechCats] = useState({}); // catégories de techniques repliées par défaut
  const toggleTechCat = k => setOpenTechCats(p => ({ ...p, [k]: !p[k] }));

  const saveIng = raw => {
    // Conseils : on retire les lignes vides, on supprime le champ si plus rien.
    const tips = (raw.tips || []).map(t => ({ type: t.type, text: (t.text || "").trim() })).filter(t => t.text);
    const item = { ...raw };
    if (tips.length) item.tips = tips; else delete item.tips;
    if ((item.description || "").trim()) item.description = item.description.trim(); else delete item.description;
    if (Array.isArray(item.months) && item.months.length) item.months = [...new Set(item.months)].sort((a, b) => a - b);
    else delete item.months;
    if (item.status !== "validated") delete item.status; // absent = « en cours de rédaction »
    item.name = (item.name || "").trim();
    if (ingredientDB.find(d => d.id === item.id)) setIngredientDB(prev => prev.map(d => d.id === item.id ? item : d));
    else setIngredientDB(prev => [...prev, { ...item, id: "db_i" + Date.now() }]);
    setNewIngId(null);
  };
  // Création : on crée un brouillon vide en base et on ouvre SA fiche en édition.
  // (Annuler un brouillon jamais nommé le supprime, cf. onCancelNew côté fiche.)
  const createIngredient = (catKey) => {
    const id = "db_i" + Date.now();
    setIngredientDB(prev => [...prev, { id, name: "", category: catKey, image: "", nutrition: null }]);
    setNewIngId(id);
    navigate(`/admin/ingredients/${encodeURIComponent(id)}`);
  };
  const delIng = id => {
    const item = ingredientDB.find(d => d.id === id);
    if (item?.image) deleteImageByUrl(item.image);
    setIngredientDB(prev => prev.filter(d => d.id !== id));
  };
  const saveUt = item => {
    if (utensilDB.find(d => d.id === item.id)) setUtensilDB(prev => prev.map(d => d.id === item.id ? item : d));
    else setUtensilDB(prev => [...prev, { ...item, id: "db_u" + Date.now() }]);
    setEditUt(null);
  };
  const delUt = id => {
    const item = utensilDB.find(d => d.id === id);
    if (item?.image) deleteImageByUrl(item.image);
    setUtensilDB(prev => prev.filter(d => d.id !== id));
  };
  // Upsert d'un geste technique (master). N'inclut que des clés définies (Firestore).
  const saveTech = raw => {
    const name = (raw.name || "").trim();
    const definition = (raw.definition || "").trim();
    if (!name || !definition) { setMdError("Nom et définition sont requis."); return; }
    const id = raw.id || slugifyId("tech_", name);
    const item = { id, name, category: raw.category || "preparation", definition };
    const aliases = [...new Set((raw.aliases || []).map(a => (a || "").trim().toLowerCase()).filter(Boolean))];
    if (aliases.length) item.aliases = aliases;
    if (raw.difficulty) item.difficulty = raw.difficulty;
    if ((raw.source || "").trim()) item.source = raw.source.trim();
    setTechniques?.(prev => prev.find(t => t.id === id) ? prev.map(t => t.id === id ? item : t) : [...prev, item]);
    setEditTech(null);
  };
  const delTech = id => setTechniques?.(prev => prev.filter(t => t.id !== id));

  // ── Categories (admin only) ─────────────────────────────────────────────────────
  // Reorder categories by drag & drop: move `fromKey` to the position of `toKey`.
  const moveCategory = (fromKey, toKey) => {
    if (fromKey === toKey) return;
    const ordered = sortedCategoryEntries(categories).map(([k]) => k);
    const from = ordered.indexOf(fromKey), to = ordered.indexOf(toKey);
    if (from < 0 || to < 0) return;
    ordered.splice(to, 0, ordered.splice(from, 1)[0]);
    setCategories(prev => {
      const next = { ...prev };
      ordered.forEach((k, i) => { next[k] = { ...next[k], order: i }; });
      return next;
    });
  };

  // Export Markdown COMPLET de toute la base d'ingrédients (admin/master).
  // Toutes les colonnes de ING_MD_COLUMNS (identité + nutrition). Aller-retour
  // fidèle : le fichier produit est réimportable tel quel. Trié par catégorie puis nom.
  const exportIngredientsMarkdown = () => {
    const esc = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
    const cell = (r, col) => {
      if (col.nut) { const v = r.nutrition?.[col.key]; return v == null || v === "" ? "" : esc(v); }
      if (col.key === "aliases") return esc((r.aliases || []).join(", "));
      if (col.months) return esc(formatMonths(r.months));
      if (col.tips) return esc(formatTips(r.tips));
      if (col.key === "category") return esc(r.category || "other");
      return esc(r[col.key]);
    };
    const order = sortedCategoryEntries(categories).map(([k]) => k);
    const rows = [...ingredientDB].sort((a, b) => {
      const ca = order.indexOf(a.category || "other"), cb = order.indexOf(b.category || "other");
      return ca !== cb ? ca - cb : (a.name || "").localeCompare(b.name || "", "fr");
    });
    const header = `| ${ING_MD_COLUMNS.map(c => c.label).join(" | ")} |\n|${ING_MD_COLUMNS.map(() => "---").join("|")}|`;
    const body = rows.map(r => `| ${ING_MD_COLUMNS.map(c => cell(r, c)).join(" | ")} |`).join("\n");
    const md = `# Base d'ingrédients Cardamome (${rows.length})\n\nValeurs nutritionnelles pour 100g. Oméga-3 inclus dans les lipides. \`Légume\` est recalculé depuis la catégorie à l'import.\n\n${header}\n${body}\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "ingredients_cardamome.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportUtensilsMarkdown = () => {
    const esc = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
    const rows = [...utensilDB].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    const header = `| Nom | dbid | Image |\n|---|---|---|`;
    const body = rows.map(r => `| ${esc(r.name)} | ${esc(r.id)} | ${esc(r.image)} |`).join("\n");
    const md = `# Base d'ustensiles Cardamome (${rows.length})\n\n${header}\n${body}\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "ustensiles_cardamome.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Affiche la liste d'erreurs de validation YAML, tronquée. Annulation totale.
  const reportErrors = (errors) => {
    setMdError(`Import annulé – ${errors.length} erreur${errors.length > 1 ? "s" : ""} : ` + errors.slice(0, 3).join(" ") + (errors.length > 3 ? " …" : ""));
  };

  // Import YAML des ingrédients (master). Upsert par id puis par nom normalisé.
  const importIngredientsYaml = (text) => {
    setMdInfo("");
    const { items: parsed, errors } = parseIngredientsYaml(text, { validCategories: new Set(Object.keys(categories)) });
    if (errors.length) return reportErrors(errors);
    if (!parsed.length) { setMdError("Aucun ingrédient reconnu dans le YAML."); return; }
    let created = 0, updated = 0;
    setIngredientDB(prev => {
      const next = [...prev];
      const idxById = new Map(next.map((d, i) => [d.id, i]));
      const idxByName = new Map(next.map((d, i) => [normalizeStr(d.name), i]));
      parsed.forEach((row, n) => {
        const idx = (row.id != null && idxById.has(row.id)) ? idxById.get(row.id)
          : idxByName.has(normalizeStr(row.name)) ? idxByName.get(normalizeStr(row.name)) : -1;
        if (idx >= 0) {
          const cur = next[idx];
          next[idx] = { ...cur, ...row, id: cur.id, nutrition: row.nutrition || cur.nutrition };
          updated++;
        } else {
          const id = row.id || ("db_i" + Date.now() + "_" + n);
          next.push({ ...row, id });
          idxById.set(id, next.length - 1);
          idxByName.set(normalizeStr(row.name), next.length - 1);
          created++;
        }
      });
      return next;
    });
    setMdError("");
    setMdInfo(`${created} créé${created > 1 ? "s" : ""}, ${updated} mis à jour.`);
  };

  // Import YAML des ustensiles (master). Upsert par id puis par nom.
  const importUtensilsYaml = (text) => {
    setMdInfo("");
    const { items: parsed, errors } = parseUtensilsYaml(text);
    if (errors.length) return reportErrors(errors);
    if (!parsed.length) { setMdError("Aucun ustensile reconnu dans le YAML."); return; }
    let created = 0, updated = 0;
    setUtensilDB(prev => {
      const next = [...prev];
      const idxById = new Map(next.map((d, i) => [d.id, i]));
      const idxByName = new Map(next.map((d, i) => [normalizeStr(d.name), i]));
      parsed.forEach((row, n) => {
        const idx = (row.id != null && idxById.has(row.id)) ? idxById.get(row.id)
          : idxByName.has(normalizeStr(row.name)) ? idxByName.get(normalizeStr(row.name)) : -1;
        if (idx >= 0) { next[idx] = { ...next[idx], ...row, id: next[idx].id }; updated++; }
        else {
          const id = row.id || ("db_u" + Date.now() + "_" + n);
          next.push({ ...row, id });
          idxById.set(id, next.length - 1);
          idxByName.set(normalizeStr(row.name), next.length - 1);
          created++;
        }
      });
      return next;
    });
    setMdError("");
    setMdInfo(`${created} créé${created > 1 ? "s" : ""}, ${updated} mis à jour.`);
  };

  // Import YAML du glossaire des techniques (master). Upsert par id.
  const importTechniquesYaml = (text) => {
    setMdInfo("");
    const { items: parsed, errors } = parseTechniquesYaml(text);
    if (errors.length) return reportErrors(errors);
    if (!parsed.length) { setMdError("Aucune technique reconnue dans le YAML."); return; }
    let created = 0, updated = 0;
    setTechniques?.(prev => {
      const next = [...prev];
      const idxById = new Map(next.map((d, i) => [d.id, i]));
      parsed.forEach(row => {
        if (idxById.has(row.id)) { next[idxById.get(row.id)] = row; updated++; }
        else { next.push(row); idxById.set(row.id, next.length - 1); created++; }
      });
      return next;
    });
    setMdError("");
    setMdInfo(`${created} créée${created > 1 ? "s" : ""}, ${updated} mise${updated > 1 ? "s" : ""} à jour.`);
  };

  const exportTechniquesMarkdown = () => downloadText("techniques_cardamome.md", formatTechniquesMarkdown(techniques), "text/markdown");

  // Exports YAML réimportables (à committer dans data/). Aller-retour fidèle.
  const catOrder = sortedCategoryEntries(categories).map(([k]) => k);
  const exportIngredientsYaml = () => downloadText("ingredients.yaml", formatIngredientsYaml(ingredientDB.map(({ _ro, ...r }) => r), { categoryOrder: catOrder }), "text/yaml");
  const exportUtensilsYaml = () => downloadText("utensils.yaml", formatUtensilsYaml(utensilDB.map(({ _ro, ...r }) => r)), "text/yaml");
  const exportTechniquesYaml = () => downloadText("techniques.yaml", formatTechniquesYaml(techniques), "text/yaml");

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {ingDetailId ? (
        <IngredientDetail
          ingredient={ingredientDB.find(d => d.id === ingDetailId)}
          ingredientDB={ingredientDB}
          categories={categories}
          isAdmin={isAdmin}
          autoEdit={ingDetailId != null && ingDetailId === newIngId}
          onBack={() => navigate(-1)}
          onSave={saveIng}
          onCancelNew={(ing) => { if (!ing?.name?.trim()) { delIng(ing.id); setNewIngId(null); navigate(-1); } }}
          onDelete={() => { const it = ingredientDB.find(d => d.id === ingDetailId); if (it) setConfirmDel({ type: "ing", item: it }); }}
        />
      ) : (
      <>
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(var(--admin-rgb),0.14)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="terminal" size={16} color="var(--admin)" />
            </span>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Console admin</h1>
          </div>
          <UserAvatar />
        </div>
        <OverscrollRow stretch style={{ gap: 6 }}>
          {[["dashboard", "Vue d'ensemble", "grid"], ["ingredients", "Ingrédients", "leaf"], ["ustensiles", "Ustensiles", "utensils"], ["techniques", "Techniques", "list2"], ["modération", "Modération", "warning"]].map(([s, label, ic]) => (
            <button key={s} onClick={() => gotoSection(s)} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: section === s ? "var(--accent)" : "var(--surface)", color: section === s ? "#fff" : "var(--text2)", border: `1px solid ${section === s ? "transparent" : "var(--border)"}` }}>
              <Icon name={ic} size={13} color="currentColor" /> {label}
              {s === "modération" && reports.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: section === s ? "rgba(255,255,255,0.28)" : "var(--red)", color: "#fff" }}>{reports.length}</span>
              )}
            </button>
          ))}
        </OverscrollRow>
        {/* Compteur + bannière admin : figés avec l'en-tête (restent visibles au scroll), pour Ingrédients et Ustensiles */}
        {(section === "ingredients" || section === "ustensiles" || section === "techniques") && (() => {
          const n = section === "ingredients" ? ingredientDB.length : section === "ustensiles" ? utensilDB.length : techniques.length;
          const noun = section === "ingredients" ? "ingrédient" : section === "ustensiles" ? "ustensile" : "technique";
          return (
            <div style={{ paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12, color: "var(--text2)", padding: "0 2px", marginBottom: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", fontFamily: "var(--ff-display)" }}>{n}</span>
                <span>{noun}{n > 1 ? "s" : ""} dans la base</span>
              </div>
              {isAdmin ? <AdminBanner style={{ marginBottom: 6 }} /> : <ReadOnlyBanner style={{ marginBottom: 6 }} />}
            </div>
          );
        })()}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
        {section === "dashboard" && (
          <AdminDashboard ingredientDB={ingredientDB} utensilDB={utensilDB} techniques={techniques} onGoto={gotoSection} />
        )}

        {section === "ingredients" && (() => {
          const matchFilter = (i) =>
            !ingFilter ? true
              : ingFilter === "validated" ? i.status === "validated"
              : ingFilter === "draft" ? i.status !== "validated"
              : ingFilter === "no-image" ? !i.image
              : ingFilter === "no-nutrition" ? (!i.nutrition || i.nutrition.calories == null)
              : true;
          const FILTERS = [[null, "Tous"], ["draft", "En cours"], ["validated", "Validés"], ["no-image", "Sans photo"], ["no-nutrition", "Sans nutrition"]];
          return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Filtre de suivi (piloté aussi par le dashboard) */}
            <OverscrollRow stretch style={{ gap: 6 }} outerStyle={{ marginBottom: 2 }}>
              {FILTERS.map(([val, lbl]) => {
                const on = ingFilter === val;
                return (
                  <button key={lbl} onClick={() => setIngFilter(val)} style={{ flexShrink: 0, padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", background: on ? "var(--accent)" : "var(--surface2)", color: on ? "#fff" : "var(--text2)", border: `1px solid ${on ? "transparent" : "var(--border)"}` }}>{lbl}</button>
                );
              })}
            </OverscrollRow>
            {sortedCategoryEntries(categories).map(([catKey, cat], ci) => {
              const catIngs = ingredientDB.filter(d => d.category === catKey && matchFilter(d))
                .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" }));
              if (ingFilter && catIngs.length === 0) return null; // sous filtre : on masque les catégories vides
              const isOpen = ingFilter ? true : openCats[catKey];
              return (
                <div key={catKey} className="slide-up"
                  draggable={isAdmin}
                  onDragStart={isAdmin ? (e) => { setDragCat(catKey); e.dataTransfer.effectAllowed = "move"; } : undefined}
                  onDragOver={isAdmin ? (e) => { e.preventDefault(); if (catKey !== overCat) setOverCat(catKey); } : undefined}
                  onDragLeave={isAdmin ? () => { if (overCat === catKey) setOverCat(null); } : undefined}
                  onDrop={isAdmin ? (e) => { e.preventDefault(); if (dragCat && dragCat !== catKey) moveCategory(dragCat, catKey); setDragCat(null); setOverCat(null); } : undefined}
                  onDragEnd={isAdmin ? () => { setDragCat(null); setOverCat(null); } : undefined}
                  style={{
                    background: "var(--surface)", borderRadius: 14, overflow: "hidden",
                    border: `1px solid ${overCat === catKey && dragCat && dragCat !== catKey ? "var(--accent)" : "var(--border)"}`,
                    opacity: dragCat === catKey ? 0.4 : 1,
                    boxShadow: overCat === catKey && dragCat && dragCat !== catKey ? "0 0 0 2px var(--accent)" : "none",
                    transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.15s",
                    animationDelay: `${ci * 0.04}s`,
                  }}>
                  {/* Category header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                    {isAdmin && (
                      <span style={{ cursor: "grab", color: "var(--text3)", display: "flex", flexShrink: 0, touchAction: "none" }} title="Glisser pour réordonner">
                        <Icon name="drag" size={16} color="var(--text3)" />
                      </span>
                    )}
                    <button onClick={() => toggleCat(catKey)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                      <span style={{ fontSize: 20 }}>{cat.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{cat.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{catIngs.length} ingrédient{catIngs.length !== 1 ? "s" : ""} · <code style={{ fontSize: 10, background: "var(--surface2)", borderRadius: 4, padding: "1px 4px" }}>{catKey}</code></div>
                      </div>
                      <span style={{
                        display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%",
                        background: "var(--surface2)", border: "1px solid var(--border)",
                        transition: "transform 0.25s ease", transform: isOpen ? "rotate(-90deg)" : "rotate(90deg)"
                      }}>
                        <Icon name="forward" size={12} color="var(--text3)" />
                      </span>
                    </button>
                    {isAdmin && (
                      <button className="btn btn-primary btn-sm" style={{ flexShrink: 0, padding: "4px 10px", fontSize: 11 }}
                        onClick={() => createIngredient(catKey)}>
                        <Icon name="plus" size={12} /> Ajouter
                      </button>
                    )}
                  </div>
                  {/* Ingredients list */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)", animation: "expandDown 0.2s ease" }}>
                      {catIngs.length === 0 && (
                        <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>
                          Aucun ingrédient dans cette catégorie.
                        </div>
                      )}
                      {catIngs.map((item, i) => (
                        <button key={item.id} onClick={() => navigate(`/admin/ingredients/${encodeURIComponent(item.id)}`)} title="Voir la fiche" className="ing-row-btn" style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                          borderTop: i > 0 ? "1px solid var(--border)" : "none",
                          background: "var(--surface)", textAlign: "left", cursor: "pointer", border: "none", transition: "background 0.15s",
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface2)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}>
                          <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
                            <IngImage src={item.image} alt={item.name} size={42} />
                            <IngredientStatusBadge status={item.status} />
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--accent)", marginTop: 2, fontWeight: 600 }}>
                              <Icon name="fileText" size={10} color="var(--accent)" /> Découvrir la fiche
                            </div>
                          </div>
                          {item._ro && <span style={{ fontSize: 10, color: "rgba(155,135,245,1)", fontWeight: 600, padding: "2px 8px", background: "rgba(155,135,245,0.14)", border: "1px solid rgba(155,135,245,0.35)", borderRadius: 8, flexShrink: 0 }}>Master</span>}
                          <Icon name="forward" size={14} color="var(--text3)" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Import / Export de la base master (admin) – en bas ── */}
            {isAdmin && (
              <BaseImportExport count={ingredientDB.length} noun="ingrédient"
                onExportYaml={exportIngredientsYaml} onExportMarkdown={exportIngredientsMarkdown}
                onImportYaml={importIngredientsYaml} mdError={mdError} mdInfo={mdInfo} />
            )}
          </div>
          );
        })()}

        {section === "ustensiles" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Ustensiles groupés par famille (taxonomie fixe UTENSIL_CATEGORIES).
                Les entrées sans catégorie retombent dans « divers ». */}
            {Object.entries(UTENSIL_CATEGORIES).map(([catKey, catLabel], ci) => {
              const list = utensilDB
                .filter(d => (d.category || "divers") === catKey)
                .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
              if (list.length === 0) return null; // famille vide : masquée
              return (
                <div key={catKey} className="slide-up" style={{ animationDelay: `${ci * 0.04}s` }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "2px 2px 10px" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{catLabel}</span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>{list.length}</span>
                    <code style={{ fontSize: 10, color: "var(--text3)", background: "var(--surface2)", borderRadius: 4, padding: "1px 5px" }}>{catKey}</code>
                  </div>
                  <div className="config-ut-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {list.map((item, ui) => (
                      <div key={item.id} className="slide-up" style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animationDelay: `${ui * 0.03}s` }}>
                        <div style={{ width: 50, height: 50, borderRadius: 10, overflow: "hidden", background: "#fff", display: "grid", placeItems: "center" }}><Img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 5, boxSizing: "border-box" }} /></div>
                        <span style={{ fontSize: 13, fontWeight: 500, textAlign: "center" }}>{item.name}</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          {item._ro
                            ? <span style={{ fontSize: 10, color: "rgba(155,135,245,1)", fontWeight: 600, padding: "2px 8px", background: "rgba(155,135,245,0.14)", border: "1px solid rgba(155,135,245,0.35)", borderRadius: 8 }}>Master</span>
                            : <>
                              <button onClick={() => setEditUt({ ...item })} style={{ color: "var(--text3)" }}><Icon name="edit" size={14} /></button>
                              <button onClick={() => setConfirmDel({ type: "ut", item })} style={{ color: "var(--red)" }}><Icon name="trash" size={14} /></button>
                            </>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* ── Import / Export de la base ustensiles (admin) – en bas ── */}
            {isAdmin && (
              <BaseImportExport count={utensilDB.length} noun="ustensile"
                onExportYaml={exportUtensilsYaml} onExportMarkdown={exportUtensilsMarkdown}
                onImportYaml={importUtensilsYaml} mdError={mdError} mdInfo={mdInfo} />
            )}
          </div>
        )}

        {section === "techniques" && (() => {
          const cats = Object.keys(TECHNIQUE_CATEGORIES);
          // Admin : toutes les catégories (pour pouvoir ajouter partout). Sinon : non vides.
          const byCat = cats
            .map(c => [c, [...techniques].filter(t => t.category === c).sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"))])
            .filter(([, list]) => isAdmin || list.length);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }} className="slide-up">
              {!isAdmin && techniques.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "24px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 14 }}>
                  Aucune technique pour l'instant.
                </div>
              )}

              {byCat.map(([catKey, list]) => {
                const isOpen = openTechCats[catKey];
                return (
                <div key={catKey} style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px" }}>
                    <button onClick={() => toggleTechCat(catKey)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                      <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {TECHNIQUE_CATEGORIES[catKey]} <span style={{ color: "var(--text3)", opacity: 0.7 }}>· {list.length}</span>
                      </div>
                      <span style={{
                        display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                        background: "var(--surface2)", border: "1px solid var(--border)",
                        transition: "transform 0.25s ease", transform: isOpen ? "rotate(-90deg)" : "rotate(90deg)",
                      }}>
                        <Icon name="forward" size={12} color="var(--text3)" />
                      </span>
                    </button>
                    {isAdmin && (
                      <button className="btn btn-primary btn-sm" style={{ flexShrink: 0, padding: "4px 10px", fontSize: 11 }}
                        onClick={() => setEditTech({ id: "", name: "", category: catKey, definition: "", aliases: [], difficulty: undefined, source: "" })}>
                        <Icon name="plus" size={12} /> Ajouter
                      </button>
                    )}
                  </div>
                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)", animation: "expandDown 0.2s ease" }}>
                      {list.map((t, i) => (
                        <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</span>
                              <DifficultyPips level={t.difficulty} />
                              {t.source && <span style={{ fontSize: 10.5, color: "var(--text3)" }}>· {t.source}</span>}
                            </div>
                            <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5, margin: "5px 0 0" }}>{t.definition}</p>
                            {t.aliases?.length > 0 && (
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                                {t.aliases.map(a => <span key={a} style={{ fontSize: 10.5, color: "var(--text3)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "1px 7px" }}>{a}</span>)}
                              </div>
                            )}
                          </div>
                          {isAdmin && (
                            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                              <button onClick={() => setEditTech({ ...t, aliases: t.aliases || [], source: t.source || "" })} title="Modifier" style={{ color: "var(--text3)", padding: 4 }}><Icon name="edit" size={14} /></button>
                              <button onClick={() => setConfirmDel({ type: "tech", item: t })} title="Supprimer" style={{ color: "var(--text3)", padding: 4 }}><Icon name="trash" size={14} /></button>
                            </div>
                          )}
                        </div>
                      ))}
                      {list.length === 0 && (
                        <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--text3)", fontStyle: "italic" }}>Aucun geste dans cette catégorie.</div>
                      )}
                    </div>
                  )}
                </div>
                );
              })}

              {/* Import / Export (admin) */}
              {isAdmin && (
                <BaseImportExport count={techniques.length} noun="technique"
                  exportTitle="Exporter le glossaire" importTitle="Importer le glossaire"
                  onExportYaml={exportTechniquesYaml} onExportMarkdown={exportTechniquesMarkdown}
                  onImportYaml={importTechniquesYaml} mdError={mdError} mdInfo={mdInfo} />
              )}
            </div>
          );
        })()}


        {section === "modération" && (() => {
          // Regroupe les signalements par recette (pubId) pour agir d'un bloc.
          const groups = Object.values(reports.reduce((acc, r) => {
            (acc[r.pubId] ||= { pubId: r.pubId, name: r.recipeName || "Recette", items: [] }).items.push(r);
            return acc;
          }, {}));
          const fmtDate = (ms) => ms ? new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
          if (!groups.length) {
            return (
              <div className="slide-up" style={{ minHeight: "46vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--text3)", gap: 12 }}>
                <span style={{ width: 60, height: 60, borderRadius: 20, background: "rgba(76,175,125,0.12)", display: "grid", placeItems: "center" }}>
                  <Icon name="check" size={26} color="var(--green)" />
                </span>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>Aucun signalement</div>
                <div style={{ fontSize: 12.5, maxWidth: 260, lineHeight: 1.5 }}>Rien à modérer pour l'instant. Les recettes signalées par la communauté apparaîtront ici.</div>
              </div>
            );
          }
          return (
            <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {groups.map(g => {
                const busy = modBusy === g.pubId;
                return (
                <div key={g.pubId} style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
                  {/* En-tête recette */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(224,82,82,0.12)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Icon name="warning" size={15} color="var(--red)" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 1 }}>{g.items.length} signalement{g.items.length > 1 ? "s" : ""}</div>
                    </div>
                    <button onClick={() => navigate(`${DISCOVER_PREFIX}${encodeURIComponent(g.pubId)}`)} className="pressable"
                      style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)", cursor: "pointer" }}>
                      <Icon name="forward" size={13} color="var(--text2)" /> Ouvrir
                    </button>
                  </div>

                  {/* Détail des signalements */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {g.items.map((r, i) => (
                      <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 15px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: r.note ? 5 : 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.28)", borderRadius: 7, padding: "2px 8px" }}>{r.reason}</span>
                            {r.createdAtMs && <span style={{ fontSize: 11, color: "var(--text3)" }}>{fmtDate(r.createdAtMs)}</span>}
                          </div>
                          {r.note && <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5, margin: "0 0 4px", wordBreak: "break-word" }}>« {r.note} »</p>}
                          {r.reporterEmail && <div style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Signalé par {r.reporterEmail}</div>}
                        </div>
                        <button onClick={() => dismissReport(r.id)} disabled={modBusy === r.id} title="Rejeter ce signalement" className="pressable"
                          style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)", cursor: "pointer", opacity: modBusy === r.id ? 0.5 : 1 }}>
                          <Icon name="close" size={12} color="var(--text3)" /> Rejeter
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Action destructive */}
                  <div style={{ padding: "12px 15px", borderTop: "1px solid var(--border)", background: "rgba(224,82,82,0.03)" }}>
                    <button onClick={() => setConfirmMod({ pubId: g.pubId, name: g.name })} disabled={busy} className="pressable"
                      style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: "rgba(224,82,82,0.12)", color: "var(--red)", border: "1px solid rgba(224,82,82,0.4)", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                      <Icon name="trash" size={14} color="var(--red)" /> Supprimer la recette de la communauté
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          );
        })()}
      </div>
      {/* FAB « + » flottant pour ajouter un ustensile (comme les listes de courses libres) */}
      {isAdmin && section === "ustensiles" && (
        <button onClick={() => setEditUt({ id: "", name: "", category: "divers", appliance: "", image: "" })} title="Nouvel ustensile" className="pressable"
          style={{ position: "absolute", bottom: 16, right: 16, width: 52, height: 52, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(var(--accent-rgb),0.45)", zIndex: 50, border: "none", cursor: "pointer" }}>
          <Icon name="plus" size={22} color="#fff" />
        </button>
      )}
      </>
      )}


      {/* Éditeur de geste technique (admin) */}
      {editTech && (
        <SwipeableSheet onClose={() => setEditTech(null)}>
          {(close) => (<>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editTech.id ? "Modifier" : "Nouveau"} geste</h3>
          <div className="field-label">Nom</div>
          <input className="field-input" placeholder="ex: Émulsionner" value={editTech.name} onChange={e => setEditTech(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 12 }} />
          <div className="field-label">Catégorie</div>
          <select className="field-input" value={editTech.category || "preparation"} onChange={e => setEditTech(p => ({ ...p, category: e.target.value }))} style={{ marginBottom: 12 }}>
            {Object.entries(TECHNIQUE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="field-label">Difficulté</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            {[1, 2, 3, 4, 5].map(n => {
              const on = editTech.difficulty === n;
              return (
                <button key={n} onClick={() => setEditTech(p => ({ ...p, difficulty: p.difficulty === n ? undefined : n }))}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: on ? DIFFICULTY_COLOR(n) : "var(--surface2)", color: on ? "#fff" : "var(--text2)",
                    border: `1px solid ${on ? "transparent" : "var(--border)"}` }}>{n}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>{editTech.difficulty ? DIFFICULTY_LABEL[editTech.difficulty] : "Non définie (clique un chiffre ; re-clique pour effacer)."}</div>
          <div className="field-label">Définition</div>
          <textarea className="field-input" rows={3} placeholder="Que veut dire ce geste ?" value={editTech.definition} onChange={e => setEditTech(p => ({ ...p, definition: e.target.value }))} style={{ marginBottom: 12, resize: "vertical", minHeight: 64 }} />
          <div className="field-label">Alias / synonymes</div>
          <div style={{ marginBottom: 12 }}>
            <TagInput tags={editTech.aliases || []} onChange={v => setEditTech(p => ({ ...p, aliases: v }))} allTags={[]} label="" placeholder="fouetter, battre…" inputId="tech-alias-input" commitOnBlur dedupeInsensitive />
          </div>
          <div className="field-label">Source (optionnel)</div>
          <input className="field-input" placeholder="ex: Escoffier, Le Guide Culinaire" value={editTech.source || ""} onChange={e => setEditTech(p => ({ ...p, source: e.target.value }))} style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveTech(editTech)}>Sauvegarder</button>
          </div>
          </>)}
        </SwipeableSheet>
      )}


      {/* Category delete confirmation */}
      {confirmDel && (
        <ConfirmDialog title={`Supprimer ${confirmDel.type === "ing" ? "l'ingrédient" : confirmDel.type === "tech" ? "le geste" : "l'ustensile"} ?`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => { if (confirmDel.type === "ing") delIng(confirmDel.item.id); else if (confirmDel.type === "tech") delTech(confirmDel.item.id); else delUt(confirmDel.item.id); setConfirmDel(null); if (ingDetailId) navigate(-1); }}>
          <strong style={{ color: "var(--text)" }}>« {confirmDel.item.name} »</strong> sera retiré de la base Master partagée. Cette action est visible par tous les utilisateurs et irréversible.
        </ConfirmDialog>
      )}

      {confirmMod && (
        <ConfirmDialog title="Supprimer cette recette de la communauté ?" busy={modBusy === confirmMod.pubId}
          onCancel={() => setConfirmMod(null)}
          onConfirm={() => deleteReportedRecipe(confirmMod.pubId)}>
          <strong style={{ color: "var(--text)" }}>« {confirmMod.name} »</strong> sera retirée de la communauté et ses signalements résolus. L'auteur en garde sa copie privée. Cette action est irréversible.
        </ConfirmDialog>
      )}

      {/* Utensil editor modal */}
      {editUt && (
        <SwipeableSheet onClose={() => setEditUt(null)}>
          {(close) => (<>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editUt.id ? "Modifier" : "Nouvel"} ustensile</h3>
          <div className="field-label">Nom</div>
          <input className="field-input" placeholder="ex: Casserole" value={editUt.name} onChange={e => setEditUt(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 12 }} />
          <div className="field-label">Catégorie</div>
          {/* Quitter la famille « appareils » retire le type d'appareil : les réglages
              d'étape n'ont de sens que pour un appareil (pas de schéma orphelin). */}
          <select className="field-input" value={editUt.category || "divers"} onChange={e => { const category = e.target.value; setEditUt(p => ({ ...p, category, ...(category === "appareils" ? null : { appliance: "" }) })); }} style={{ marginBottom: 12 }}>
            {Object.entries(UTENSIL_CATEGORIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          {/* Type d'appareil : contextuel à la famille « appareils ». Il précise QUEL
              schéma de réglages (four ≠ blender ≠ cuiseur) exposer au niveau étape. */}
          {editUt.category === "appareils" && (<>
            <div className="field-label">Type d'appareil (réglages par étape)</div>
            <select className="field-input" value={editUt.appliance || ""} onChange={e => setEditUt(p => ({ ...p, appliance: e.target.value }))} style={{ marginBottom: 12 }}>
              <option value="">Aucun réglage</option>
              {Object.entries(APPLIANCE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </>)}
          <div className="field-label">Photo</div>
          <ImageUpload value={editUt.image} onChange={v => setEditUt(p => ({ ...p, image: v }))} style={{ marginBottom: 14, height: 100 }} pathPrefix={isAdmin ? "master/utensils" : "utensils"} />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveUt(editUt)}>Sauvegarder</button>
          </div>
          </>)}
        </SwipeableSheet>
      )}

    </div>
  );
}