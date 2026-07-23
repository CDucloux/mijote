import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { Img, IngImage } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { ImageUpload } from "../components/ImageUpload.jsx";
import { TagInput } from "../components/TagInput.jsx";
import { ChangelogSection } from "../components/ChangelogSection.jsx";
import { ReadOnlyBanner, AdminBanner } from "../components/Banners.jsx";
import { IngredientDetail } from "../components/IngredientDetail.jsx";
import { normalizeStr } from "../lib/parseIngredient.js";
import { deleteImageByUrl } from "../lib/storage.js";
import { ING_MD_COLUMNS, formatTips } from "../lib/ingredientsMarkdown.js";
import {
  parseIngredientsYaml, parseUtensilsYaml, parseTechniquesYaml,
  formatTechniquesMarkdown, formatTechniquesYaml, formatIngredientsYaml, formatUtensilsYaml,
  TECHNIQUE_CATEGORIES, slugifyId,
} from "../lib/dataYaml.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries } from "../constants/categories.js";
import { DEFAULT_PREFERENCES, DIETS, COMMON_ALLERGENS } from "../constants/preferences.js";
import { CookingHeatmap } from "../components/CookingHeatmap.jsx";
import { buildHeatmap } from "../lib/cookingActivity.js";
import { SEASONAL_CATEGORIES, MONTHS_FR, MONTHS_SHORT_FR, formatMonths } from "../lib/seasonality.js";
import { TIP_TYPES } from "../constants/tipTypes.js";
import { CONFIG_SECTION_BY_PATH, CONFIG_PATH_BY_SECTION } from "../constants/tabs.js";

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
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "28px 20px", borderRadius: 12, border: `2px dashed ${over ? "var(--accent)" : "var(--border)"}`, background: over ? "rgba(232,112,58,0.06)" : "var(--surface2)", cursor: "pointer", transition: "all 0.15s" }}>
        <Icon name="import" size={28} color={over ? "var(--accent)" : "var(--text3)"} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: over ? "var(--accent)" : "var(--text)" }}>Dépose un fichier YAML ici</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>ou clique pour sélectionner</div>
        </div>
      </div>
    </>
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

export function ConfigPage({ ingredientDB, setIngredientDB, utensilDB, setUtensilDB, collections, setCollections, recipes, onExportAll, onImport, isAdmin, categories = DEFAULT_CATEGORIES, setCategories, preferences = DEFAULT_PREFERENCES, setPreferences, techniques = [], setTechniques, user, mealPlan = {}, onPurge }) {
  const navigate = useNavigate();
  const location = useLocation();
  const configSectionParam = location.pathname.startsWith("/config/")
    ? location.pathname.slice(8) || undefined
    : undefined;
  const section = CONFIG_SECTION_BY_PATH[configSectionParam] || "ingredients";
  // Fiche ingrédient : /config/ingredients/{id}
  const ingDetailMatch = location.pathname.match(/^\/config\/ingredients\/(.+)$/);
  const ingDetailId = ingDetailMatch ? decodeURIComponent(ingDetailMatch[1]) : null;
  const setSection = (s) => navigate(`/config/${CONFIG_PATH_BY_SECTION[s] || "ingredients"}`, { replace: true });
  useEffect(() => {
    if (!configSectionParam) navigate("/config/ingredients", { replace: true });
  }, [configSectionParam]);
  const [editIng, setEditIng] = useState(null);
  const [editUt, setEditUt] = useState(null);
  const [editTech, setEditTech] = useState(null);
  const [editCat, setEditCat] = useState(null); // { key, label, color, icon, isNew }
  const [confirmDelCat, setConfirmDelCat] = useState(null); // { key, label }
  const [nameInput, setNameInput] = useState(null);      // édition du nom d'affichage
  const [purgeScope, setPurgeScope] = useState(null);    // { scope, label } en confirmation
  const [confirmDel, setConfirmDel] = useState(null); // { type: "ing" | "ut", item }
  const [dragCat, setDragCat] = useState(null); // key being dragged
  const [overCat, setOverCat] = useState(null); // key currently hovered as drop target
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [openCats, setOpenCats] = useState({});
  const fileRef = useRef();
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
    if (ingredientDB.find(d => d.id === item.id)) setIngredientDB(prev => prev.map(d => d.id === item.id ? item : d));
    else setIngredientDB(prev => [...prev, { ...item, id: "db_i" + Date.now() }]);
    setEditIng(null);
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
  const slugifyCat = (label) => "cat_" + label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 32);
  const saveCat = (form) => {
    const label = (form.label || "").trim();
    if (!label) return;
    let key = form.key;
    if (form.isNew) {
      key = slugifyCat(label) || ("cat_" + Date.now());
      if (categories[key]) key = key + "_" + Date.now().toString(36).slice(-4);
    }
    const entry = {
      label,
      color: form.color || "#9a9490",
      icon: form.icon || "📦",
      order: form.isNew
        ? (Math.max(-1, ...Object.values(categories).map(c => c.order ?? 0)) + 1)
        : (categories[key]?.order ?? Object.keys(categories).length),
    };
    setCategories(prev => ({ ...prev, [key]: entry }));
    setEditCat(null);
  };
  const delCat = (key) => {
    const inUse = ingredientDB.filter(d => (d.category || "other") === key).length;
    if (inUse > 0) return; // guarded in UI too
    setCategories(prev => { const next = { ...prev }; delete next[key]; return next; });
  };
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
    const md = `# Base d'ingrédients Mijoté (${rows.length})\n\nValeurs nutritionnelles pour 100g. Oméga-3 inclus dans les lipides. \`Légume\` est recalculé depuis la catégorie à l'import.\n\n${header}\n${body}\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "ingredients_mijote.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportUtensilsMarkdown = () => {
    const esc = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
    const rows = [...utensilDB].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    const header = `| Nom | dbid | Image |\n|---|---|---|`;
    const body = rows.map(r => `| ${esc(r.name)} | ${esc(r.id)} | ${esc(r.image)} |`).join("\n");
    const md = `# Base d'ustensiles Mijoté (${rows.length})\n\n${header}\n${body}\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "ustensiles_mijote.md";
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

  const exportTechniquesMarkdown = () => downloadText("techniques_mijote.md", formatTechniquesMarkdown(techniques), "text/markdown");

  // Exports YAML réimportables (à committer dans data/). Aller-retour fidèle.
  const catOrder = sortedCategoryEntries(categories).map(([k]) => k);
  const exportIngredientsYaml = () => downloadText("ingredients.yaml", formatIngredientsYaml(ingredientDB.map(({ _ro, ...r }) => r), { categoryOrder: catOrder }), "text/yaml");
  const exportUtensilsYaml = () => downloadText("utensils.yaml", formatUtensilsYaml(utensilDB.map(({ _ro, ...r }) => r)), "text/yaml");
  const exportTechniquesYaml = () => downloadText("techniques.yaml", formatTechniquesYaml(techniques), "text/yaml");

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {ingDetailId ? (
        <IngredientDetail
          ingredient={ingredientDB.find(d => d.id === ingDetailId)}
          ingredientDB={ingredientDB}
          categories={categories}
          isAdmin={isAdmin}
          onBack={() => navigate(-1)}
          onEdit={() => { const it = ingredientDB.find(d => d.id === ingDetailId); if (it) setEditIng({ ...it }); }}
          onDelete={() => { const it = ingredientDB.find(d => d.id === ingDetailId); if (it) setConfirmDel({ type: "ing", item: it }); }}
        />
      ) : (
      <>
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Configuration</h1>
            
          </div>
          <UserAvatar />
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 0, overflowX: "auto", paddingBottom: 0 }}>
          {["profil", "préférences", "ingredients", "ustensiles", "techniques", "données", "nouveautés"].map(s => (
            <button key={s} onClick={() => setSection(s)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: section === s ? "var(--accent)" : "var(--surface2)", color: section === s ? "#fff" : "var(--text2)", border: `1px solid ${section === s ? "transparent" : "var(--border)"}` }}>
              {s === "profil" ? "Profil" : s === "préférences" ? "Préférences" : s === "ingredients" ? "Ingrédients" : s === "ustensiles" ? "Ustensiles" : s === "techniques" ? "Techniques" : s === "collections" ? "Carnets" : s === "données" ? "Données" : "Changelog"}
            </button>
          ))}
        </div>
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
        {section === "profil" && (() => {
          const prefs = preferences || DEFAULT_PREFERENCES;
          const currentName = prefs.displayName || user?.displayName || "";
          const editing = nameInput !== null;
          const stats = buildHeatmap(mealPlan, { weeks: 26 });
          const STAT = [
            { label: "Repas cuisinés", value: stats.total },
            { label: "Jours actifs", value: stats.activeDays },
            { label: "Série en cours", value: `${stats.streak} j` },
            { label: "7 derniers jours", value: stats.thisWeek },
          ];
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 640 }}>
              {/* En-tête profil : avatar + identité */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {user?.photoURL
                  ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)" }} />
                  : <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 700 }}>{(currentName || "?")[0].toUpperCase()}</div>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName || "Sans nom"}</div>
                  {user?.email && <div style={{ fontSize: 12, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>}
                </div>
              </div>

              {/* Nom d'affichage */}
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Nom d'affichage</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="field-input" style={{ flex: 1 }} placeholder={user?.displayName || "Ton prénom"}
                    value={editing ? nameInput : currentName}
                    onChange={e => setNameInput(e.target.value)}
                    onFocus={() => { if (!editing) setNameInput(currentName); }} />
                  {editing && (
                    <button className="btn btn-primary btn-sm" onClick={() => { setPreferences?.(p => ({ ...DEFAULT_PREFERENCES, ...(p || {}), displayName: nameInput.trim() })); setNameInput(null); }}>Enregistrer</button>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>C'est le nom utilisé dans l'interface (accueil, foyer).</div>
              </div>

              {/* Activité cuisine */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Icon name="fire" size={16} color="var(--accent)" />
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Ton activité cuisine</h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                  {STAT.map(s => (
                    <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{s.value}</div>
                      <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 14px" }}>
                  <CookingHeatmap mealPlan={mealPlan} weeks={26} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>D'après tes repas planifiés sur les 6 derniers mois.</div>
              </div>

              {/* Zone danger : purge */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 4 }}>Zone de danger</div>
                <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 12px" }}>Efface définitivement des données de ton espace. Irréversible.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { scope: "planning", label: "Vider le planning" },
                    { scope: "shopping", label: "Vider les courses" },
                    { scope: "stock", label: "Vider le stock" },
                    { scope: "all", label: "Tout effacer" },
                  ].map(o => (
                    <button key={o.scope} onClick={() => setPurgeScope(o)}
                      style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: o.scope === "all" ? "rgba(224,82,82,0.14)" : "var(--surface2)", color: o.scope === "all" ? "var(--red)" : "var(--text2)", border: `1px solid ${o.scope === "all" ? "rgba(224,82,82,0.5)" : "var(--border)"}` }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
        {section === "préférences" && (() => {
          const prefs = preferences || DEFAULT_PREFERENCES;
          const setPref = (patch) => setPreferences?.(p => ({ ...DEFAULT_PREFERENCES, ...(p || {}), ...patch }));
          const toggleIn = (key, value) => setPref({
            [key]: (prefs[key] || []).includes(value) ? prefs[key].filter(v => v !== value) : [...(prefs[key] || []), value],
          });
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }} className="slide-up">
              <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: 0 }}>
                Ces choix personnalisent ton expérience. Ils serviront bientôt à filtrer les recettes publiques selon ce que tu manges (régime, allergènes, ingrédients à éviter).
              </p>

              {/* Régime */}
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Régime alimentaire</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {DIETS.map(d => {
                    const active = prefs.diet === d.id;
                    return (
                      <button key={d.id} onClick={() => setPref({ diet: d.id })} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 22, fontSize: 13, fontWeight: 500, background: active ? "var(--accent)" : "var(--surface2)", color: active ? "#fff" : "var(--text2)", border: `1px solid ${active ? "transparent" : "var(--border)"}`, transition: "all 0.15s" }}>
                        <span style={{ fontSize: 15, lineHeight: 1 }}>{d.emoji}</span>{d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Allergènes */}
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Allergènes à éviter</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COMMON_ALLERGENS.map(a => {
                    const active = (prefs.allergens || []).includes(a);
                    return (
                      <button key={a} onClick={() => toggleIn("allergens", a)} style={{ padding: "7px 13px", borderRadius: 22, fontSize: 13, fontWeight: 500, background: active ? "rgba(224,82,82,0.16)" : "var(--surface2)", color: active ? "var(--red)" : "var(--text2)", border: `1px solid ${active ? "rgba(224,82,82,0.5)" : "var(--border)"}`, transition: "all 0.15s" }}>
                        {active ? "✕ " : ""}{a}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Catégories exclues */}
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Catégories à ne pas proposer</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {sortedCategoryEntries(categories).map(([key, cat]) => {
                    const active = (prefs.excludedCategories || []).includes(key);
                    return (
                      <button key={key} onClick={() => toggleIn("excludedCategories", key)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 22, fontSize: 12.5, fontWeight: 500, background: active ? cat.color + "26" : "var(--surface2)", color: active ? cat.color : "var(--text2)", border: `1px solid ${active ? cat.color + "88" : "var(--border)"}`, transition: "all 0.15s" }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{cat.icon}</span>{cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ingrédients non aimés */}
              <div>
                <TagInput
                  label="Ingrédients que tu n'aimes pas"
                  tags={prefs.dislikes || []}
                  onChange={(tags) => setPref({ dislikes: tags })}
                  allTags={ingredientDB.map(i => i.name).filter(Boolean)}
                  placeholder="Coriandre, Olives…"
                  inputId="pref-dislikes"
                  commitOnBlur
                  dedupeInsensitive
                />
              </div>
            </div>
          );
        })()}
        {section === "ingredients" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sortedCategoryEntries(categories).map(([catKey, cat], ci) => {
              const catIngs = ingredientDB.filter(d => d.category === catKey)
                .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" }));
              const isOpen = openCats[catKey];
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
                        onClick={() => setEditIng({ id: "", name: "", category: catKey, image: "", nutrition: null })}>
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
                        <button key={item.id} onClick={() => navigate(`/config/ingredients/${encodeURIComponent(item.id)}`)} title="Voir la fiche" className="ing-row-btn" style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                          borderTop: i > 0 ? "1px solid var(--border)" : "none",
                          background: "var(--surface)", textAlign: "left", cursor: "pointer", border: "none", transition: "background 0.15s",
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface2)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}>
                          <IngImage src={item.image} alt={item.name} size={42} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
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

            {/* ── Import / Export Markdown de la base master (admin) – en bas ── */}
            {isAdmin && (
              <>
                <div style={{ height: 6 }} />
                {/* Export */}
                <div className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Exporter la base</h3>
                      <p style={{ fontSize: 12, color: "var(--text2)" }}>{ingredientDB.length} ingrédient{ingredientDB.length > 1 ? "s" : ""} · <strong>YAML</strong> (réimportable, pour <code style={{ fontSize: 11 }}>data/</code>) ou Markdown (lecture)</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button className="btn btn-primary btn-sm" onClick={exportIngredientsYaml} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="download" size={14} /> YAML
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={exportIngredientsMarkdown} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="download" size={14} /> Markdown
                      </button>
                    </div>
                  </div>
                </div>
                {/* Import YAML (l'export reste en Markdown) */}
                <div className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Importer dans la base</h3>
                  <YamlImport warn onText={importIngredientsYaml} />
                  {mdError && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{mdError}</p>}
                  {mdInfo && <p style={{ color: "var(--accent)", fontSize: 12, marginTop: 8 }}>✓ {mdInfo}</p>}
                </div>
              </>
            )}
          </div>
        )}

        {section === "ustensiles" && (
          <div>
            {isAdmin && <button className="btn btn-primary btn-sm" style={{ marginBottom: 14 }} onClick={() => setEditUt({ id: "", name: "", image: "" })}><Icon name="plus" size={14} /> Nouvel ustensile</button>}
            <div className="config-ut-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[...utensilDB].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr")).map((item, ui) => (
                <div key={item.id} className="slide-up" style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animationDelay: `${ui * 0.03}s` }}>
                  <div style={{ width: 50, height: 50, borderRadius: 10, overflow: "hidden", background: "#fff" }}><Img src={item.image} alt={item.name} style={{ width: "100%", height: "100%" }} /></div>
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

            {/* ── Export Markdown de la base ustensiles (admin) – en bas ── */}
            {isAdmin && (
              <>
                <div style={{ height: 6 }} />
                <div className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Exporter la base</h3>
                      <p style={{ fontSize: 12, color: "var(--text2)" }}>{utensilDB.length} ustensile{utensilDB.length > 1 ? "s" : ""} · <strong>YAML</strong> (réimportable, pour <code style={{ fontSize: 11 }}>data/</code>) ou Markdown (lecture)</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button className="btn btn-primary btn-sm" onClick={exportUtensilsYaml} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="download" size={14} /> YAML
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={exportUtensilsMarkdown} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Icon name="download" size={14} /> Markdown
                      </button>
                    </div>
                  </div>
                </div>
                {/* Import YAML */}
                <div className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Importer dans la base</h3>
                  <YamlImport warn onText={importUtensilsYaml} />
                  {mdError && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{mdError}</p>}
                  {mdInfo && <p style={{ color: "var(--accent)", fontSize: 12, marginTop: 8 }}>✓ {mdInfo}</p>}
                </div>
              </>
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
                <>
                  <div style={{ height: 2 }} />
                  <div className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Exporter le glossaire</h3>
                        <p style={{ fontSize: 12, color: "var(--text2)" }}>{techniques.length} technique{techniques.length > 1 ? "s" : ""} · <strong>YAML</strong> (réimportable, pour <code style={{ fontSize: 11 }}>data/</code>) ou Markdown (lecture)</p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button className="btn btn-primary btn-sm" onClick={exportTechniquesYaml} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon name="download" size={14} /> YAML
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={exportTechniquesMarkdown} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Icon name="download" size={14} /> Markdown
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Importer le glossaire</h3>
                    <YamlImport warn onText={importTechniquesYaml} />
                    {mdError && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{mdError}</p>}
                    {mdInfo && <p style={{ color: "var(--accent)", fontSize: 12, marginTop: 8 }}>✓ {mdInfo}</p>}
                  </div>
                </>
              )}
            </div>
          );
        })()}


        {section === "données" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Export */}
            <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Exporter des recettes</h3>
                  <p style={{ fontSize: 12, color: "var(--text2)" }}>{recipes.length} recette{recipes.length > 1 ? "s" : ""} sauvegardée{recipes.length > 1 ? "s" : ""}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={onExportAll} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="download" size={14} /> Exporter
                </button>
              </div>
            </div>

            {/* Import drag & drop */}
            <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Importer des recettes</h3>
              <input ref={fileRef} type="file" accept=".json" multiple
                onChange={e => { Array.from(e.target.files).forEach(f => { const r = new FileReader(); r.onload = ev => { try { onImport(ev.target.result); } catch { setJsonError("Fichier invalide : " + f.name); } }; r.readAsText(f); }); e.target.value = ""; }}
                style={{ display: "none" }} />
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".json")).forEach(f => { const r = new FileReader(); r.onload = ev => { try { onImport(ev.target.result); } catch { setJsonError("Fichier invalide : " + f.name); } }; r.readAsText(f); }); }}
                onClick={() => fileRef.current.click()}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "28px 20px",
                  borderRadius: 12, border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                  background: dragOver ? "rgba(232,112,58,0.06)" : "var(--surface2)",
                  cursor: "pointer", transition: "all 0.15s"
                }}>
                <Icon name="import" size={28} color={dragOver ? "var(--accent)" : "var(--text3)"} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: dragOver ? "var(--accent)" : "var(--text)" }}>Dépose tes fichiers JSON ici</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>ou clique pour sélectionner – plusieurs fichiers acceptés</div>
                </div>
              </div>
              {jsonError && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{jsonError}</p>}
            </div>

            {/* JSON schema expander */}
            <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
              <button onClick={() => setSchemaOpen(p => !p)}
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "none", color: "var(--text)", fontFamily: "var(--ff-body)", fontSize: 14, fontWeight: 600 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="book" size={15} color="var(--text3)" />
                  Schéma JSON de référence
                </span>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", transition: "transform 0.25s ease, background 0.15s", transform: schemaOpen ? "rotate(-90deg)" : "rotate(90deg)" }}><Icon name="forward" size={12} color="var(--text3)" style={{ transform: "none" }} /></span>
              </button>
              {schemaOpen && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)", animation: "expandDown 0.35s ease" }}>
                  <div style={{ fontSize: 11, lineHeight: 1.8, overflow: "auto", background: "var(--surface2)", padding: 14, borderRadius: 10, marginTop: 12, fontFamily: "monospace", whiteSpace: "pre" }}
                    dangerouslySetInnerHTML={{
                      __html: [
                        '<span style="color:#9a9490">{</span>',
                        '  <span style="color:#5b9cf6">"name"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>  <span style="color:#5a5754;font-style:italic">← obligatoire, unique</span>',
                        '  <span style="color:#5b9cf6">"image"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"url | base64"</span>',
                        '  <span style="color:#5b9cf6">"prepTime"</span><span style="color:#9a9490">:</span> <span style="color:#f0c060">number</span>  <span style="color:#5a5754;font-style:italic">← minutes</span>',
                        '  <span style="color:#5b9cf6">"cookTime"</span><span style="color:#9a9490">:</span> <span style="color:#f0c060">number</span>  <span style="color:#5a5754;font-style:italic">← minutes</span>',
                        '  <span style="color:#5b9cf6">"servings"</span><span style="color:#9a9490">:</span> <span style="color:#f0c060">number</span>',
                        '  <span style="color:#5b9cf6">"cuisine"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>  <span style="color:#5a5754;font-style:italic">← style de cuisine</span>',
                        '  <span style="color:#5b9cf6">"source"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"url"</span>  <span style="color:#5a5754;font-style:italic">← lien de la recette originale</span>',
                        '  <span style="color:#5b9cf6">"collections"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[</span><span style="color:#4caf7d">"collection_id"</span><span style="color:#9a9490">]</span>',
                        '  <span style="color:#5b9cf6">"ingredients"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[{</span>',
                        '    <span style="color:#5b9cf6">"name"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>',
                        '    <span style="color:#5b9cf6">"amount"</span><span style="color:#9a9490">:</span> <span style="color:#f0c060">number</span>',
                        '    <span style="color:#5b9cf6">"unit"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>  <span style="color:#5a5754;font-style:italic">← "g", "ml", "pièce"…</span>',
                        '  <span style="color:#9a9490">}]</span>',
                        '  <span style="color:#5b9cf6">"utensils"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[{</span>',
                        '    <span style="color:#5b9cf6">"name"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>',
                        '  <span style="color:#9a9490">}]</span>',
                        '  <span style="color:#5b9cf6">"steps"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[{</span>',
                        '    <span style="color:#5b9cf6">"text"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>',
                        '    <span style="color:#5b9cf6">"ingredients"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[</span><span style="color:#4caf7d">"ingredient_name"</span><span style="color:#9a9490">]</span>  <span style="color:#5a5754;font-style:italic">← optionnel</span>',
                        '    <span style="color:#5b9cf6">"utensils"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[</span><span style="color:#4caf7d">"utensil_name"</span><span style="color:#9a9490">]</span>  <span style="color:#5a5754;font-style:italic">← optionnel</span>',
                        '  <span style="color:#9a9490">}]</span>',
                        '<span style="color:#9a9490">}</span>',
                      ].join('\n')
                    }} />
                  <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 8, lineHeight: 1.6 }}>
                    💡 Accepte un objet ou un tableau. Les IDs sont régénérés à l'import. Les images base64 sont supportées.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {section === "nouveautés" && <ChangelogSection />}
      </div>
      </>
      )}

      {/* Ingredient editor modal */}
      {editIng && (
        <SwipeableSheet onClose={() => setEditIng(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editIng.id ? "Modifier" : "Nouvel"} ingrédient</h3>
          <div className="field-label">Nom</div>
          <input className="field-input" placeholder="ex: Tomate" value={editIng.name} onChange={e => setEditIng(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 12 }} />
          <div className="field-label">Description (accroche « ingrédient du moment »)</div>
          <textarea className="field-input" rows={2} maxLength={280} placeholder="ex: Fragile. À déguster sous 2 jours, ou pochée au miel pour la garder plus longtemps."
            value={editIng.description || ""} onChange={e => setEditIng(p => ({ ...p, description: e.target.value }))}
            style={{ marginBottom: 12, resize: "vertical", minHeight: 48 }} />
          <div className="field-label">Alias / synonymes</div>
          <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, lineHeight: 1.4 }}>
            Autres noms qui doivent pointer vers cet ingrédient (ex : ciboule, cébette, oignon nouveau).
          </p>
          <div style={{ marginBottom: 12 }}>
            <TagInput
              tags={editIng.aliases || []}
              onChange={v => setEditIng(p => ({ ...p, aliases: v }))}
              allTags={[]}
              label=""
              placeholder="ciboule, cébette…"
              inputId="alias-input-field"
              commitOnBlur
              dedupeInsensitive />
          </div>
          <div className="field-label">Catégorie nutritionnelle</div>
          <select className="field-input" value={editIng.category || "other"} onChange={e => setEditIng(p => ({ ...p, category: e.target.value }))} style={{ marginBottom: 12 }}>
            {sortedCategoryEntries(categories).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <div className="field-label">Photo</div>
          <ImageUpload value={editIng.image} onChange={v => setEditIng(p => ({ ...p, image: v }))} style={{ marginBottom: 12, height: 100 }} pathPrefix={isAdmin ? "master/ingredients" : "ingredients"} />
          <div className="field-label">Poids moyen d'une pièce (g)</div>
          <div style={{ position: "relative", marginBottom: 4 }}>
            <input className="field-input" type="number" min="0" step="1" placeholder="ex. 125 pour une tomate – optionnel"
              value={editIng.gramsPerPiece ?? ""}
              onChange={e => setEditIng(p => ({ ...p, gramsPerPiece: e.target.value === "" ? undefined : +e.target.value }))}
              style={{ paddingRight: 32 }} />
            <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--text3)", pointerEvents: "none" }}>g</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>Utilisé pour le score quand la quantité est en pièces, tranches, gousses…</div>
          {SEASONAL_CATEGORIES.has(editIng.category) && (() => {
            const sel = new Set(editIng.months || []);
            const toggle = m => setEditIng(p => {
              const s = new Set(p.months || []);
              s.has(m) ? s.delete(m) : s.add(m);
              const arr = [...s].sort((a, b) => a - b);
              return { ...p, months: arr.length ? arr : undefined };
            });
            return (
              <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Mois de saison</div>
                  {sel.size > 0 && <button className="btn btn-ghost btn-sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => setEditIng(p => ({ ...p, months: undefined }))}>Effacer</button>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6 }}>
                  {MONTHS_SHORT_FR.map((lbl, i) => {
                    const m = i + 1, on = sel.has(m);
                    return (
                      <button key={m} title={MONTHS_FR[i]} onClick={() => toggle(m)} style={{
                        padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        background: on ? "var(--green)" : "var(--surface)", color: on ? "#fff" : "var(--text3)",
                        border: `1px solid ${on ? "var(--green)" : "var(--border)"}`, transition: "background 0.12s, color 0.12s",
                      }}>{lbl}</button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>
                  {sel.size === 0 ? "Aucun mois : ignoré pour la saisonnalité (produit disponible toute l'année)."
                    : `De saison : ${formatMonths([...sel])}.`}
                </div>
              </div>
            );
          })()}
          <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>Valeurs nutritionnelles précises (optionnel – pour 100g)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["calories", "Énergie (kcal)", 1], ["protein", "Protéines (g)", 0.1], ["carbs", "Glucides (g)", 0.1], ["sugar", "Sucres (g)", 0.1], ["fat", "Lipides (g)", 0.1], ["saturatedFat", "G. saturées (g)", 0.1], ["omega3", "Oméga-3 (g)", 0.01], ["fiber", "Fibres (g)", 0.1], ["salt", "Sel (g)", 0.01]].map(([k, l, step]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 3 }}>{l}</div>
                  <input className="field-input" type="number" min="0" step={step} placeholder="0"
                    value={editIng.nutrition?.[k] || ""}
                    onChange={e => setEditIng(p => ({ ...p, nutrition: { ...(p.nutrition || {}), isVegetable: p.category === "vegetable" || p.category === "legume", [k]: +e.target.value } }))}
                    style={{ padding: "6px 10px", fontSize: 12 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Conseils (préparation / utilisation / bienfaits) */}
          <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Conseils (optionnel)</div>
              <button className="btn btn-ghost btn-sm" style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", fontSize: 11 }}
                onClick={() => setEditIng(p => ({ ...p, tips: [...(p.tips || []), { type: "prep", text: "" }] }))}>
                <Icon name="plus" size={12} /> Ajouter
              </button>
            </div>
            {(editIng.tips || []).length === 0 && <div style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>Aucun conseil. Astuces de préparation, d'utilisation ou bienfaits.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(editIng.tips || []).map((tip, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <select className="field-input" value={tip.type} style={{ width: 120, flexShrink: 0, padding: "6px 8px", fontSize: 12 }}
                    onChange={e => setEditIng(p => ({ ...p, tips: p.tips.map((t, i) => i === idx ? { ...t, type: e.target.value } : t) }))}>
                    {Object.entries(TIP_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                  <textarea className="field-input" rows={2} placeholder="Conseil utile…" value={tip.text}
                    onChange={e => setEditIng(p => ({ ...p, tips: p.tips.map((t, i) => i === idx ? { ...t, text: e.target.value } : t) }))}
                    style={{ flex: 1, padding: "6px 10px", fontSize: 12, resize: "vertical", minHeight: 38 }} />
                  <button onClick={() => setEditIng(p => ({ ...p, tips: p.tips.filter((_, i) => i !== idx) }))} style={{ color: "var(--red)", flexShrink: 0, marginTop: 6 }}><Icon name="trash" size={14} color="var(--red)" /></button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditIng(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveIng(editIng)}>Sauvegarder</button>
          </div>
        </SwipeableSheet>
      )}

      {/* Éditeur de geste technique (admin) */}
      {editTech && (
        <SwipeableSheet onClose={() => setEditTech(null)}>
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
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditTech(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveTech(editTech)}>Sauvegarder</button>
          </div>
        </SwipeableSheet>
      )}


      {/* Purge de données (confirmation) */}
      {purgeScope && (
        <SwipeableSheet onClose={() => setPurgeScope(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{purgeScope.label} ?</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            {purgeScope.scope === "all"
              ? "Toutes tes recettes, carnets, planning, courses et stock seront définitivement effacés. Cette action est irréversible."
              : "Ces données seront définitivement effacées. Cette action est irréversible."}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPurgeScope(null)}>Annuler</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { onPurge?.(purgeScope.scope); setPurgeScope(null); }}>Effacer</button>
          </div>
        </SwipeableSheet>
      )}

      {/* Category delete confirmation */}
      {confirmDel && (
        <SwipeableSheet onClose={() => setConfirmDel(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Supprimer {confirmDel.type === "ing" ? "l'ingrédient" : confirmDel.type === "tech" ? "le geste" : "l'ustensile"} ?</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            « {confirmDel.item.name} » sera retiré de la base Master partagée. Cette action est visible par tous les utilisateurs et irréversible.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDel(null)}>Annuler</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { if (confirmDel.type === "ing") delIng(confirmDel.item.id); else if (confirmDel.type === "tech") delTech(confirmDel.item.id); else delUt(confirmDel.item.id); setConfirmDel(null); if (ingDetailId) navigate(-1); }}>Supprimer</button>
          </div>
        </SwipeableSheet>
      )}

      {/* Utensil editor modal */}
      {editUt && (
        <SwipeableSheet onClose={() => setEditUt(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editUt.id ? "Modifier" : "Nouvel"} ustensile</h3>
          <div className="field-label">Nom</div>
          <input className="field-input" placeholder="ex: Casserole" value={editUt.name} onChange={e => setEditUt(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 12 }} />
          <div className="field-label">Photo</div>
          <ImageUpload value={editUt.image} onChange={v => setEditUt(p => ({ ...p, image: v }))} style={{ marginBottom: 14, height: 100 }} pathPrefix={isAdmin ? "master/utensils" : "utensils"} />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditUt(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveUt(editUt)}>Sauvegarder</button>
          </div>
        </SwipeableSheet>
      )}

    </div>
  );
}