import { useState, useRef, useEffect, Fragment } from "react";
import { Icon } from "../components/Icon.jsx";
import { ImageUpload } from "../components/ImageUpload.jsx";
import { CUISINES } from "../constants/cuisines.js";
import { RECIPE_CATEGORIES, BASE_CATEGORIES, BASE_CATEGORY_IDS } from "../constants/recipeCategories.js";
import { UtensilPicker } from "../components/UtensilPicker.jsx";
import { DraggableStep } from "../components/DraggableStep.jsx";
import { DraggableIngredient } from "../components/DraggableIngredient.jsx";
import { findIngredientMatch } from "@/lib/food/nameMatcher.js";
import { parseIngredientInput } from "@/lib/food/parseIngredient.js";
import { groupOrder, relabelGroup, moveWithAdopt, sectionRuns } from "@/lib/recipes/recipeGroups.js";
import { BaseIcon } from "../components/BaseIcon.jsx";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";

// ─── RECIPE EDITOR ────────────────────────────────────────────────────────────

// Carte de section (« Pour la pâte »…) dans l'éditeur : en-tête avec nom renommable
// (clic → champ) et bouton de dissolution, puis le contenu (items + bouton d'ajout).
function SectionCard({ name, onRename, onDelete, onZoneDrop, children }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [eraseHover, setEraseHover] = useState(false);
  const [zoneOver, setZoneOver] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { setDraft(name); }, [name]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  const commit = () => { setEditing(false); onRename(draft); };
  return (
    <div
      onDragOver={onZoneDrop ? (e => { e.preventDefault(); setZoneOver(true); }) : undefined}
      onDragLeave={onZoneDrop ? (() => setZoneOver(false)) : undefined}
      onDrop={onZoneDrop ? (e => { setZoneOver(false); onZoneDrop(e); }) : undefined}
      style={{ background: zoneOver ? "rgba(var(--accent-rgb),0.1)" : "rgba(var(--accent-rgb),0.04)", border: `1px solid ${zoneOver ? "var(--accent)" : "rgba(var(--accent-rgb),0.3)"}`, borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 10, transition: "background 0.15s, border-color 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="layers" size={15} color="var(--accent)" />
        {editing ? (
          <input ref={inputRef} className="field-input" value={draft} onChange={e => setDraft(e.target.value)}
            onBlur={commit} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { setDraft(name); setEditing(false); } }}
            style={{ marginBottom: 0, flex: 1, minWidth: 0, height: 32, fontSize: 13.5, fontWeight: 600 }} />
        ) : (
          <button type="button" onClick={() => setEditing(true)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "text", padding: 0, fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</button>
        )}
        <button type="button" onClick={onDelete} title="Dissoudre la section" onMouseEnter={() => setEraseHover(true)} onMouseLeave={() => setEraseHover(false)}
          style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: eraseHover ? "var(--surface2)" : "transparent", border: "none", display: "grid", placeItems: "center", cursor: "pointer", transition: "background 0.15s" }}>
          <Icon name="eraser" size={14} color="var(--text3)" />
        </button>
      </div>
      {children}
    </div>
  );
}

// En-tête de section EN LIGNE (liste à plat) : nom renommable (clic) + dissolution.
// Les items suivent directement dessous dans le flux (pas de carte englobante).
function EditorSectionHeader({ name, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [eraseHover, setEraseHover] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { setDraft(name); }, [name]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  const commit = () => { setEditing(false); onRename(draft); };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <Icon name="layers" size={15} color="var(--accent)" />
      {editing ? (
        <input ref={inputRef} className="field-input" value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { setDraft(name); setEditing(false); } }}
          style={{ marginBottom: 0, flex: 1, minWidth: 0, height: 32, fontSize: 14, fontWeight: 600 }} />
      ) : (
        <button type="button" onClick={() => setEditing(true)} style={{ minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "text", padding: 0, fontFamily: "var(--ff-display)", fontSize: 15.5, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</button>
      )}
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <button type="button" onClick={onDelete} title="Dissoudre la section" onMouseEnter={() => setEraseHover(true)} onMouseLeave={() => setEraseHover(false)}
        style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", background: eraseHover ? "var(--surface2)" : "transparent", border: "none", display: "grid", placeItems: "center", cursor: "pointer", transition: "background 0.15s" }}>
        <Icon name="eraser" size={13} color="var(--text3)" />
      </button>
    </div>
  );
}

// Bouton « Nouvelle section », volontairement DISTINCT des ajouts d'ingrédient/étape
// (fond teinté accent + icône layers), pour ne pas les confondre. Au clic, il se
// déplie en une petite carte de nommage soignée.
function NewSectionButton({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  const close = () => { setDraft(""); setOpen(false); };
  const submit = () => { const t = draft.trim(); if (t) { onAdd(t); close(); } };
  const chip = (
    <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.16)" }}>
      <Icon name="layers" size={17} color="var(--accent)" />
    </span>
  );
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 14px", borderRadius: 16, cursor: "pointer", textAlign: "left",
        border: "1px solid rgba(var(--accent-rgb),0.4)", background: hover ? "rgba(var(--accent-rgb),0.12)" : "rgba(var(--accent-rgb),0.07)",
        boxShadow: hover ? "0 6px 18px -10px rgba(var(--accent-rgb),0.6)" : "none", transition: "background 0.15s, box-shadow 0.2s" }}>
      {chip}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--accent)" }}>Nouvelle section</span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", marginTop: 1 }}>Regrouper en sous-préparation</span>
      </span>
      <Icon name="plus" size={17} color="var(--accent)" />
    </button>
  );
  return (
    <div style={{ padding: 12, borderRadius: 16, border: "1px solid rgba(var(--accent-rgb),0.45)", background: "rgba(var(--accent-rgb),0.07)", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {chip}
        <span style={{ flex: 1, fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--accent)" }}>Nommer la section</span>
        <button type="button" onClick={close} aria-label="Annuler" style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "transparent", display: "grid", placeItems: "center", cursor: "pointer" }}><Icon name="close" size={15} color="var(--text3)" /></button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") close(); }}
          placeholder="ex. La pâte, La crème, Le sirop…"
          style={{ flex: 1, minWidth: 0, height: 42, padding: "0 15px", borderRadius: 12, border: "1px solid transparent", background: "var(--surface)", color: "var(--text)", fontSize: 14, fontWeight: 500, outline: "none" }} />
        <button type="button" onClick={submit} disabled={!draft.trim()}
          style={{ flexShrink: 0, height: 42, padding: "0 16px", borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: draft.trim() ? "pointer" : "default", opacity: draft.trim() ? 1 : 0.45, display: "inline-flex", alignItems: "center", gap: 6, transition: "opacity 0.15s" }}>
          <Icon name="check" size={15} color="#fff" /> Créer
        </button>
      </div>
    </div>
  );
}

// Barre d'ajout d'une zone d'ingrédients (principale ou section) : le choix est
// toujours présenté, ajouter un ingrédient brut OU assigner une préparation de base.
// `canBase` = false uniquement quand on édite soi-même un composant (mono-niveau v1).
function SectionAddBar({ onAddIngredient, components, canBase = true }) {
  const [picking, setPicking] = useState(false);
  if (picking) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px 2px" }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text3)" }}>Assigner une préparation de base</span>
          <button type="button" onClick={() => setPicking(false)} style={{ fontSize: 11.5, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="close" size={11} color="var(--text3)" /> Annuler</button>
        </div>
        {components.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", padding: "10px 0", lineHeight: 1.5 }}>Aucune base disponible.<br />Crée d'abord une recette en « préparation de base ».</p>
        ) : components.map(comp => (
          <button key={comp.id} onClick={() => { comp.onPick(); setPicking(false); }} className="complete-row" style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "left", cursor: "pointer" }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.1)" }}><BaseIcon size={16} /></span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{comp.name}</span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>{comp.yield?.amount} {comp.yield?.unit}</span>
            <span className="complete-add" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.12)", color: "var(--accent)" }}><Icon name="plus" size={15} color="currentColor" /></span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button className="editor-add" onClick={onAddIngredient} style={{ flex: 1 }}><Icon name="plus" size={16} /> Ingrédient</button>
      {canBase && <button className="editor-add" onClick={() => setPicking(true)} style={{ flex: 1 }}><BaseIcon size={14} /> Base</button>}
    </div>
  );
}

export function RecipeEditor({ recipe, onSave, onCancel, ingredientDB, utensilDB, recipes }) {
  const [form, setForm] = useState({ ...recipe, ingredients: recipe.ingredients || [], utensils: recipe.utensils || [], steps: recipe.steps || [], cuisine: recipe.cuisine || "", category: recipe.category || "", collections: recipe.collections || [], isComponent: !!recipe.isComponent, yield: recipe.yield || { amount: "", unit: "g" } });
  const [section, setSection] = useState("info");
  const up = (f, v) => setForm(p => ({ ...p, [f]: v }));
  // Bascule « préparation de base » : les types de recette diffèrent (rôle repas vs
  // familles de base), on nettoie donc la catégorie si elle n'a plus de sens.
  const RECIPE_CATEGORY_IDS = new Set(RECIPE_CATEGORIES.map(c => c.id));
  const toggleComponent = () => setForm(p => {
    const isComp = !p.isComponent;
    const valid = isComp ? BASE_CATEGORY_IDS : RECIPE_CATEGORY_IDS;
    return { ...p, isComponent: isComp, category: valid.has(p.category) ? p.category : "" };
  });
  const upYield = (f, v) => setForm(p => ({ ...p, yield: { ...(p.yield || { amount: "", unit: "g" }), [f]: v } }));

  const [saveError, setSaveError] = useState("");
  // Une ligne totalement vide est ignorée ; une ligne nommée doit avoir une quantité > 0.
  const ingIsEmpty = ing => !ing.name && !ing.dbId && !ing.recipeId && !(Number(ing.amount) > 0);
  const ingIsMissingQty = ing => (ing.name || ing.dbId || ing.recipeId) && !(Number(ing.amount) > 0);
  const handleSave = () => {
    // On retire silencieusement les lignes complètement vides.
    const cleaned = form.ingredients.filter(i => !ingIsEmpty(i));
    const invalid = cleaned.filter(ingIsMissingQty);
    if (invalid.length > 0) {
      setForm(p => ({ ...p, ingredients: cleaned }));
      setSaveError(`${invalid.length} ingrédient${invalid.length > 1 ? "s" : ""} sans quantité valide. Renseigne une quantité ou supprime la ligne.`);
      goSection("ingrédients", 1);
      return;
    }
    setSaveError("");
    const out = { ...form, ingredients: cleaned };
    if (out.isComponent) out.yield = { amount: Number(form.yield?.amount) || 0, unit: form.yield?.unit || "g" };
    else { delete out.yield; out.isComponent = false; }
    onSave(out);
  };

  // Ingredients
  const lastAddedIdRef = useRef(null);
  // Insère un ingrédient à la position `index` (dans la liste globale) avec la section
  // `group`. Le réordonnancement libre se fait ensuite via `moveIngGlobal`.
  const addIngAt = (index, group) => {
    const id = "i" + Date.now();
    lastAddedIdRef.current = id;
    const arr = form.ingredients.slice();
    arr.splice(index, 0, { id, dbId: "", name: "", amount: "", unit: "", _raw: "", group });
    up("ingredients", arr);
  };
  // Déplacement LIBRE (index globaux) : l'item adopte la section du bloc d'arrivée.
  const moveIngGlobal = (from, to) => up("ingredients", moveWithAdopt(form.ingredients, from, to));
  const updIng = (id, f, v) => { if (saveError) setSaveError(""); up("ingredients", form.ingredients.map(i => i.id === id ? { ...i, [f]: v } : i)); };
  const remIng = id => { if (saveError) setSaveError(""); up("ingredients", form.ingredients.filter(i => i.id !== id)); };
  // Retour arrière sur une ligne vide : supprime la ligne et refocalise la précédente.
  const removeIngBackspace = (id) => {
    const idx = form.ingredients.findIndex(i => i.id === id);
    const prev = form.ingredients[idx - 1];
    lastAddedIdRef.current = prev ? prev.id : null;
    remIng(id);
  };
  // Parse + rapprochement base d'ingrédients à chaque frappe dans le champ « raw ».
  const handleRawChange = (id, raw) => {
    if (saveError) setSaveError("");
    const parsed = parseIngredientInput(raw);
    const match = parsed.name ? findIngredientMatch(parsed.name, ingredientDB) : null;
    up("ingredients", form.ingredients.map(x => x.id === id ? {
      ...x, _raw: raw, name: parsed.name, amount: parsed.amount, unit: parsed.unit,
      dbId: match ? match.id : "",
    } : x));
  };

  // Composants disponibles (préparations de base), hors la recette courante et hors
  // celles déjà référencées. Indisponible si on édite soi-même un composant (mono-niveau v1).
  const usedRecipeIds = new Set(form.ingredients.filter(i => i.recipeId).map(i => i.recipeId));
  const availableComponents = (recipes || []).filter(r => r.isComponent && r.id !== form.id && !usedRecipeIds.has(r.id));
  const addComponentAt = (index, comp, group = "") => {
    const arr = form.ingredients.slice();
    arr.splice(index, 0, { id: "i" + Date.now(), recipeId: comp.id, name: comp.name, amount: "", unit: comp.yield?.unit || "g", group });
    up("ingredients", arr);
  };

  // Étapes, mêmes primitives : insertion positionnelle + déplacement libre.
  const addStepAt = (index, group) => {
    const arr = form.steps.slice();
    arr.splice(index, 0, { id: "s" + Date.now(), title: "", text: "", ingredients: [], utensils: [], group });
    up("steps", arr);
  };
  const updStep = (id, f, v) => up("steps", form.steps.map(s => s.id === id ? { ...s, [f]: v } : s));
  const remStep = id => up("steps", form.steps.filter(s => s.id !== id));
  const moveStepGlobal = (from, to) => up("steps", moveWithAdopt(form.steps, from, to));

  // ── Sections partagées (ingrédients + étapes) ───────────────────────────────
  // `sectionNames` porte l'ORDRE des sections et permet les sections VIDES (créées
  // avant d'y ajouter le moindre item, le modèle « libellé » ne peut pas les stocker).
  const [sectionNames, setSectionNames] = useState(() => groupOrder(form));
  // Union ordonnée : sections déclarées + toute section présente dans les données.
  const allSections = [...new Set([...sectionNames, ...groupOrder(form)])];
  const addSection = (name) => { const t = (name || "").trim(); if (t && !allSections.includes(t)) setSectionNames(s => [...s, t]); };
  const renameSection = (from, to) => {
    const t = (to || "").trim();
    if (!t || t === from) return;
    up("ingredients", relabelGroup(form.ingredients, from, t));
    up("steps", relabelGroup(form.steps, from, t));
    setSectionNames(s => s.map(x => (x === from ? t : x)));
  };
  const deleteSection = (name) => {
    // Dissout la section : ses items repassent en principale (aucune suppression).
    up("ingredients", relabelGroup(form.ingredients, name, ""));
    up("steps", relabelGroup(form.steps, name, ""));
    setSectionNames(s => s.filter(x => x !== name));
  };
  const ingsOf = (g) => form.ingredients.filter(i => (i.group || "") === g);
  // Bases disponibles pour une zone d'ajout : insérées à `index` avec la section `group`.
  const compsAt = (group, index) => (form.isComponent ? [] : availableComponents.map(c => ({ id: c.id, name: c.name, yield: c.yield, onPick: () => addComponentAt(index, c, group) })));

  const isDesktop = useIsDesktop();

  // Élastique vertical (rubber-band + rebond d'inertie) pour les panneaux du pager
  // (chacun a son propre `overflow-y`). Le panneau Ustensiles est un composant à part
  // (UtensilPicker) qui gère son propre élastique. Désactivé sur desktop.
  const paneInfo = useElasticScroll({ disabled: isDesktop });
  const paneIng = useElasticScroll({ disabled: isDesktop });
  const paneStep = useElasticScroll({ disabled: isDesktop });
  // Ligne visée par un glisser en cours (index global), par liste.
  const [ingDropIdx, setIngDropIdx] = useState(null);
  const [stepDropIdx, setStepDropIdx] = useState(null);

  const swiperRef = useRef(null);
  // Onglet visé par un défilement programmé : tant qu'il n'est pas atteint, les
  // panneaux TRAVERSÉS ne doivent pas s'allumer au passage (le saut Infos → Étapes
  // dure plus longtemps qu'un délai fixe, d'où le clignotement d'autant plus marqué
  // que l'onglet est loin). `null` = défilement libre au doigt.
  const pendingTab = useRef(null);
  const settleTimer = useRef(null);
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const TABS = [
    { id: "info", label: "Infos", icon: "info" },
    { id: "ingrédients", label: "Ingrédients", icon: "leaf" },
    { id: "ustensiles", label: "Ustensiles", icon: "utensils" },
    { id: "étapes", label: "Étapes", icon: "list2" },
  ];
  const goSection = (id, i) => {
    setSection(id);
    const el = swiperRef.current;
    if (!el) return;
    const left = i * el.offsetWidth;
    // Déjà en place : ne pas armer la garde, elle ne serait jamais levée (aucun
    // événement de défilement) et bloquerait le balayage au doigt.
    if (Math.abs(el.scrollLeft - left) < 2) { pendingTab.current = null; return; }
    pendingTab.current = i;
    el.scrollTo({ left, behavior: "smooth" });
  };
  const onSwiperScroll = (e) => {
    const el = e.currentTarget;
    const width = el.offsetWidth || 1;
    const idx = Math.round(el.scrollLeft / width);
    if (pendingTab.current !== null) {
      if (idx === pendingTab.current && Math.abs(el.scrollLeft - idx * width) < 2) pendingTab.current = null;
      // Filet : si le défilement s'interrompt avant la cible (geste concurrent), on
      // rend la main au suivi libre dès qu'il s'est stabilisé.
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => { pendingTab.current = null; }, 140);
      return;
    }
    setSection(TABS[idx]?.id || "info");
  };
  // Petit en-tête de sous-section (pastille d'icône + libellé).
  const head = (icon, label, extra) => (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 2 }}>
      <span style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name={icon} size={13} color="var(--accent)" /></span>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text2)" }}>{label}</span>
      {extra}
    </div>
  );

  return (
    <div className="editor-enter" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Barre d'action. Le fond et le filet restent pleine largeur, le CONTENU suit la
          colonne `.editor-col`, commune aux onglets et aux panneaux : tout s'aligne. */}
      <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
        <div className="editor-col" style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px" }}>
          <button onClick={onCancel} className="cook-close-btn" style={{ flexShrink: 0, width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--surface2)", border: "none", cursor: "pointer" }}><Icon name="close" size={14} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>{recipe.id ? "Modifier la recette" : "Nouvelle recette"}</div>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.15 }}>{form.name.trim() || "Sans titre"}</div>
          </div>
          <button className="btn btn-primary btn-pill" style={{ flexShrink: 0 }} onClick={handleSave}><Icon name="check" size={15} /> Enregistrer</button>
        </div>
      </div>
      {/* Onglets segmentés (icône + libellé), pilotent aussi le glissement */}
      <div style={{ padding: "9px 0", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div className="editor-col" style={{ display: "flex", gap: 5, padding: "0 20px" }}>
          {TABS.map(({ id, label, icon }, i) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => goSection(id, i)} style={{
                flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "7px 3px", borderRadius: 11, border: "none", cursor: "pointer",
                background: active ? "rgba(var(--accent-rgb),0.12)" : "transparent", color: active ? "var(--accent)" : "var(--text3)",
                transition: "color 0.15s ease, background-color 0.15s ease" }}>
                <Icon name={icon} size={17} color="currentColor" />
                <span style={{ fontSize: 10.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div id="editor-swiper" ref={swiperRef}
        onTouchStart={e => {
          const el = e.currentTarget;
          el._touchStartX = e.touches[0].clientX;
          el._touchStartY = e.touches[0].clientY;
          el._lockAxis = null;
        }}
        onTouchMove={e => {
          const el = e.currentTarget;
          if (el._lockAxis === null) {
            const dx = Math.abs(e.touches[0].clientX - el._touchStartX);
            const dy = Math.abs(e.touches[0].clientY - el._touchStartY);
            // Seuil élevé + ratio strict pour éviter les faux déclenchements lors d'un scroll vertical
            if (dx > 20 || dy > 20) el._lockAxis = (dx > dy * 3 && dx > 24) ? "x" : "y";
          }
          if (el._lockAxis === "y") el.style.overflowX = "hidden";
          else el.style.overflowX = "auto";
        }}
        onTouchEnd={e => { e.currentTarget.style.overflowX = "auto"; }}
        onScroll={onSwiperScroll}
        style={{ flex: 1, display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>

        {/* Slide 1 – Infos */}
        <div ref={paneInfo.scrollRef} style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto" }}>
          <div ref={paneInfo.contentRef} className="editor-col" style={{ padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 22 }}>

            {/* Photo + identité */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <ImageUpload value={form.image} onChange={v => up("image", v)} style={{ height: 172, borderRadius: 16 }} pathPrefix="recipes" />
              <div>
                <div className="field-label">Nom <span style={{ color: "var(--accent2)" }}>*</span></div>
                <input className="field-input field-soft" placeholder="ex : Tarte Tatin" value={form.name} onChange={e => up("name", e.target.value)} style={{ background: "var(--surface)", borderRadius: 12, height: 46 }} />
              </div>
              <div>
                <div className="field-label">Source <span style={{ color: "var(--text3)", fontWeight: 400 }}>· optionnel</span></div>
                <input className="field-input field-soft" placeholder="marmiton.org…" value={form.source || ""} onChange={e => up("source", e.target.value)} style={{ background: "var(--surface)", borderRadius: 12, height: 46 }} />
              </div>
            </div>

            {/* Temps & portions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {head("clock", "Temps & portions")}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["Prép. (min)", "prepTime", 5, 0, 999],
                  ["Cuisson (min)", "cookTime", 5, 0, 999],
                  ["Portions", "servings", 1, 1, 24],
                ].map(([label, field, step, min, max]) => (
                  <div key={field}>
                    <div className="field-label" style={{ fontSize: 10.5 }}>{label}</div>
                    <div className="stepper">
                      <button type="button" className="stepper-btn" onClick={() => up(field, Math.max(min, (form[field]||0) - step))}>
                        <svg width="11" height="2" viewBox="0 0 11 2"><rect x="0" y="0" width="11" height="2" rx="1" fill="currentColor"/></svg>
                      </button>
                      <input className="stepper-input no-spin" type="number" min={min} max={max} value={form[field]}
                        onChange={e => up(field, Math.min(max, Math.max(min, +e.target.value || 0)))} />
                      <button type="button" className="stepper-btn" onClick={() => up(field, Math.min(max, (form[field]||0) + step))}>
                        <svg width="11" height="11" viewBox="0 0 11 11"><rect x="4.5" y="0" width="2" height="11" rx="1" fill="currentColor"/><rect x="0" y="4.5" width="11" height="2" rx="1" fill="currentColor"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Préparation de base (composant) : réutilisable comme ingrédient. */}
            <div style={{ background: form.isComponent ? "rgba(var(--accent-rgb),0.05)" : "var(--surface)", border: `1px solid ${form.isComponent ? "rgba(var(--accent-rgb),0.4)" : "var(--border)"}`, borderRadius: 16, padding: 15, transition: "border-color 0.2s, background-color 0.2s" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: form.isComponent ? "rgba(var(--accent-rgb),0.16)" : "var(--surface2)" }}><BaseIcon size={20} color={form.isComponent ? "var(--accent)" : "var(--text2)"} /></span>
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => toggleComponent()}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Préparation de base</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, lineHeight: 1.4 }}>Réutilisable comme ingrédient (béchamel, sauce, pâte…)</div>
                </div>
                <button type="button" onClick={() => toggleComponent()}
                  style={{ width: 44, height: 25, borderRadius: 13, flexShrink: 0, border: "none", cursor: "pointer", background: form.isComponent ? "var(--accent)" : "var(--surface3)", position: "relative", transition: "background 0.2s" }}>
                  <span style={{ position: "absolute", top: 2, left: form.isComponent ? 21 : 2, width: 21, height: 21, borderRadius: "50%", background: "#fff", transition: "left 0.18s cubic-bezier(0.4,0,0.2,1)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </button>
              </label>
              {form.isComponent && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(var(--accent-rgb),0.25)" }}>
                  <div className="field-label">Rendement <span style={{ color: "var(--accent2)" }}>*</span> <span style={{ color: "var(--text3)", fontWeight: 400 }}>· ce que produit la préparation</span></div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input className="field-input field-soft" type="number" min="0" step="any" placeholder="ex : 400" value={form.yield?.amount ?? ""} onChange={e => upYield("amount", e.target.value === "" ? "" : +e.target.value)} style={{ flex: 2, background: "var(--surface)", borderRadius: 12 }} />
                    <select className="field-input field-soft" value={form.yield?.unit || "g"} onChange={e => upYield("unit", e.target.value)} style={{ flex: 1, background: "var(--surface)", borderRadius: 12 }}>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="pièce">pièce(s)</option>
                    </select>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>Les recettes qui l'utilisent en consommeront une partie (ex : 150 {form.yield?.unit || "g"}).</div>
                </div>
              )}
            </div>

            {/* Classement */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {head("grid", "Classement")}
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>{form.isComponent ? "Type de préparation" : "Type de recette"}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(form.isComponent ? BASE_CATEGORIES : RECIPE_CATEGORIES).map(c => {
                    const active = form.category === c.id;
                    return (
                      <button key={c.id} type="button" onClick={() => up("category", active ? "" : c.id)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: active ? "rgba(var(--accent-rgb),0.14)" : "var(--surface)", color: active ? "var(--accent)" : "var(--text2)", border: `1px solid ${active ? "rgba(var(--accent-rgb),0.5)" : "var(--border)"}`, transition: "all 0.15s" }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{c.emoji}</span>{c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Style de cuisine</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {CUISINES.map(c => {
                    const active = form.cuisine === c.label;
                    return (
                      <button key={c.label} type="button" onClick={() => up("cuisine", active ? "" : c.label)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: active ? "rgba(var(--accent-rgb),0.14)" : "var(--surface)", color: active ? "var(--accent)" : "var(--text2)", border: `1px solid ${active ? "rgba(var(--accent-rgb),0.5)" : "var(--border)"}`, transition: "all 0.15s" }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{c.emoji}</span>{c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Slide 2 – Ingrédients */}
        <div ref={paneIng.scrollRef} style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto" }}>
          <div ref={paneIng.contentRef} className="editor-col" style={{ padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
            {head("leaf", "Ingrédients", form.ingredients.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "var(--text3)" }}>{form.ingredients.length}</span>)}
            {saveError && (
              <div className="shake" style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", borderRadius: 12, background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.4)", color: "var(--red)", fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>
                <Icon name="warning" size={16} color="var(--red)" /> {saveError}
              </div>
            )}
            {/* Liste À PLAT dans l'ordre réel : en-têtes de section en ligne, chaque
                bloc a son bouton d'ajout (ingrédient / base). Réordonnancement libre. */}
            {sectionRuns(form.ingredients).map(run => {
              const g = run.group; // null = hors section
              const endIdx = run.start + run.items.length; // insertion en fin de bloc
              const rawInSection = g != null && ingsOf(g).some(i => !i.recipeId);
              return (
                <Fragment key={run.start}>
                  {g != null && <EditorSectionHeader name={g} onRename={t => renameSection(g, t)} onDelete={() => deleteSection(g)} />}
                  {run.items.map((ing, j) => {
                    const gi = run.start + j;
                    return (
                      <DraggableIngredient key={ing.id} ing={ing} index={gi} total={form.ingredients.length}
                        draggable={!isDesktop} ingredientDB={ingredientDB} recipes={recipes}
                        autoFocus={ing.id === lastAddedIdRef.current}
                        isDropTarget={ingDropIdx === gi} onTargetChange={setIngDropIdx}
                        onRawChange={handleRawChange}
                        onUpdateAmount={(id, v) => updIng(id, "amount", v)}
                        onRemove={remIng} onMove={moveIngGlobal} onEnter={() => addIngAt(gi + 1, g || "")} onBackspaceEmpty={removeIngBackspace} />
                    );
                  })}
                  {g != null && <SectionAddBar onAddIngredient={() => addIngAt(endIdx, g)} components={compsAt(g, endIdx)} canBase={!form.isComponent && !rawInSection} />}
                </Fragment>
              );
            })}
            {/* Ajout hors section (ingrédient seul) + création de section + sections vides */}
            <SectionAddBar onAddIngredient={() => addIngAt(form.ingredients.length, "")} components={[]} canBase={false} />
            <NewSectionButton onAdd={addSection} />
            {allSections.filter(n => !form.ingredients.some(i => (i.group || "") === n)).map(name => (
              <SectionCard key={name} name={name} onRename={t => renameSection(name, t)} onDelete={() => deleteSection(name)}>
                <SectionAddBar onAddIngredient={() => addIngAt(form.ingredients.length, name)} components={compsAt(name, form.ingredients.length)} canBase={!form.isComponent} />
              </SectionCard>
            ))}
          </div>
        </div>

        {/* Slide 3 – Ustensiles */}
        <UtensilPicker utensilDB={utensilDB} selected={form.utensils} onChange={v => up("utensils", v)} />

        {/* Slide 4 – Étapes */}
        <div ref={paneStep.scrollRef} style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto" }}>
          <div ref={paneStep.contentRef} className="editor-col" style={{ padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
            {head("list2", "Étapes", form.steps.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "var(--text3)" }}>{form.steps.length}</span>)}
            {!isDesktop && form.steps.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--text3)", background: "var(--surface)", border: "1px solid var(--border)", padding: "9px 12px", borderRadius: 12 }}>
                <Icon name="drag" size={14} color="var(--text3)" /> Glisse les étapes pour les réorganiser.
              </div>
            )}
            {/* Liste À PLAT dans l'ordre réel : en-têtes de section en ligne, ajout par
                bloc, réordonnancement libre (l'étape adopte la section du bloc d'arrivée). */}
            {sectionRuns(form.steps).map(run => {
              const g = run.group;
              const endIdx = run.start + run.items.length;
              return (
                <Fragment key={run.start}>
                  {g != null && <EditorSectionHeader name={g} onRename={t => renameSection(g, t)} onDelete={() => deleteSection(g)} />}
                  {run.items.map((step, j) => {
                    const gi = run.start + j;
                    return (
                      <DraggableStep key={step.id} step={step} index={gi} total={form.steps.length}
                        ingredients={form.ingredients} utensils={form.utensils} recipes={recipes} ingredientDB={ingredientDB} utensilDB={utensilDB}
                        draggable={!isDesktop}
                        isDropTarget={stepDropIdx === gi} onTargetChange={setStepDropIdx}
                        onUpdate={updStep} onRemove={remStep} onMove={moveStepGlobal} />
                    );
                  })}
                  {g != null && <button className="editor-add" onClick={() => addStepAt(endIdx, g)}><Icon name="plus" size={16} /> Ajouter une étape</button>}
                </Fragment>
              );
            })}
            <button className="editor-add" onClick={() => addStepAt(form.steps.length, "")}><Icon name="plus" size={16} /> Ajouter une étape</button>
            <NewSectionButton onAdd={addSection} />
            {allSections.filter(n => !form.steps.some(s => (s.group || "") === n)).map(name => (
              <SectionCard key={name} name={name} onRename={t => renameSection(name, t)} onDelete={() => deleteSection(name)}>
                <button className="editor-add" onClick={() => addStepAt(form.steps.length, name)}><Icon name="plus" size={16} /> Ajouter une étape</button>
              </SectionCard>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
