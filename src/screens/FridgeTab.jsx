import { useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { Img, IngImage } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { findIngredientMatch } from "../lib/nameMatcher.js";
import { normalizeStr, parseIngredientInput } from "../lib/parseIngredient.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries } from "../constants/categories.js";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── FRIDGE CONSTANTS ─────────────────────────────────────────────────────────
const FRIDGE_THRESHOLDS = {
  vegetable: { warn: 5, danger: 8, label: "Légume/Fruit" },
  meat: { warn: 2, danger: 4, label: "Viande" },
  dairy: { warn: 5, danger: 10, label: "Produit laitier" },
  grain: { warn: 30, danger: 60, label: "Céréale" },
  fat_good: { warn: 30, danger: 90, label: "Matière grasse saine" },
  sugar: { warn: 60, danger: 180, label: "Sucre" },
  condiment: { warn: 30, danger: 90, label: "Condiment/Épice" },
  legume: { warn: 3, danger: 5, label: "Légumineuse cuite" },
  alcohol: { warn: 180, danger: 365, label: "Alcool" },
  other: { warn: 7, danger: 14, label: "Autre" },
};

function fridgeDaysAge(addedAt) {
  return Math.floor((Date.now() - new Date(addedAt).getTime()) / 86400000);
}
function fridgeStatus(item) {
  const days = fridgeDaysAge(item.addedAt);
  const t = FRIDGE_THRESHOLDS[item.category] || FRIDGE_THRESHOLDS["other"];
  if (days >= t.danger) return "danger";
  if (days >= t.warn) return "warn";
  return "ok";
}
const FRIDGE_STATUS_COLOR = { ok: "var(--green)", warn: "var(--yellow)", danger: "var(--red)" };
const FRIDGE_STATUS_BG = { ok: "rgba(76,175,125,0.12)", warn: "rgba(240,192,96,0.12)", danger: "rgba(224,82,82,0.12)" };
const FRIDGE_STATUS_LABEL = { ok: "Frais", warn: "À utiliser bientôt", danger: "À jeter" };

// ─── FRIDGE TAB ───────────────────────────────────────────────────────────────
export function FridgeTab({ fridge, setFridge, fridgeSettings, setFridgeSettings, pantry, setPantry, recipes, ingredientDB, onSelectRecipe, categories = DEFAULT_CATEGORIES }) {
  const { notify } = useAppShell();
  const [view, setView] = useState("stock"); // "stock" | "pantry" | "recipes"
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [newItem, setNewItem] = useState({ name: "", category: "vegetable", quantity: "", unit: "", addedAt: new Date().toISOString().slice(0, 10) });
  const [showSettings, setShowSettings] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [addText, setAddText] = useState("");
  const [showPantryAdd, setShowPantryAdd] = useState(false);
  const [pantryText, setPantryText] = useState("");
  const [editPantryItem, setEditPantryItem] = useState(null); // { id, name, quantity, unit, image, category }
  // Catégories autorisées par emplacement
  const FRIDGE_CATS = new Set(["vegetable", "fruit", "legume", "meat", "fish_seafood", "dairy", "mushroom"]);
  const PANTRY_CATS = new Set(["grain", "fat_good", "nuts_seeds", "condiment", "canned", "herbs", "sugar", "alcohol", "other"]);

  const deletePantryItem = id => setPantry(prev => prev.filter(i => i.id !== id));
  const savePantryEdit = () => {
    if (!editPantryItem?.name?.trim()) return;
    const m = findIngredientMatch(editPantryItem.name, ingredientDB);
    setPantry(prev => prev.map(i => i.id === editPantryItem.id ? { ...editPantryItem, image: m?.image || editPantryItem.image || "" } : i));
    setEditPantryItem(null);
  };

  const saveItem = () => {
    if (!newItem.name.trim()) return;
    const m = findIngredientMatch(newItem.name, ingredientDB);
    const withImg = { ...newItem, image: m?.image || newItem.image || "" };
    if (editItem) {
      setFridge(prev => prev.map(i => i.id === editItem ? { ...withImg, id: editItem } : i));
    } else {
      setFridge(prev => [...prev, { ...withImg, id: "f" + Date.now() }]);
    }
    setNewItem({ name: "", category: "vegetable", quantity: "", unit: "", addedAt: new Date().toISOString().slice(0, 10) });
    setEditItem(null); setShowAdd(false);
  };

  const addFridgeItem = () => {
    if (!addText.trim()) return;
    const p = parseIngredientInput(addText);
    const name = p.name || addText.trim();
    const m = findIngredientMatch(name, ingredientDB);
    const cat = m?.category || "other";
    if (!FRIDGE_CATS.has(cat)) {
      notify?.(`"${name}" n'est pas un produit frais`, "warning");
      return;
    }
    setFridge(prev => [...prev, { id: "f" + Date.now(), name, category: cat, quantity: p.amount || "", unit: p.unit || "", image: m?.image || "", addedAt: new Date().toISOString().slice(0, 10) }]);
    setAddText("");
  };

  const addPantryItem = () => {
    if (!pantryText.trim()) return;
    const p = parseIngredientInput(pantryText);
    const name = p.name || pantryText.trim();
    const m = findIngredientMatch(name, ingredientDB);
    const cat = m?.category || "other";
    if (!PANTRY_CATS.has(cat)) {
      notify?.(`"${name}" est un produit frais`, "warning");
      return;
    }
    setPantry(prev => [...prev, { id: "p" + Date.now(), name, category: cat, quantity: p.amount || "", unit: p.unit || "", image: m?.image || "" }]);
    setPantryText("");
  };

  const deleteItem = id => setFridge(prev => prev.filter(i => i.id !== id));
  const startEdit = item => { setNewItem({ ...item, addedAt: item.addedAt.slice(0, 10) }); setEditItem(item.id); setShowAdd(true); };

  // Filtered stock
  const filteredFridge = fridge.filter(item => filterStatus === "all" || fridgeStatus(item) === filterStatus)
    .sort((a, b) => fridgeDaysAge(b.addedAt) - fridgeDaysAge(a.addedAt));

  // Recipe matching — frigo + étagères combinés
  const threshold = fridgeSettings.matchThreshold / 100;
  const stockNames = [...fridge, ...pantry].map(i => normalizeStr(i.name));
  const matchedRecipes = recipes.map(recipe => {
    const ings = recipe.ingredients || [];
    if (ings.length === 0) return null;
    const matched = ings.filter(ing => stockNames.some(fn => normalizeStr(ing.name).includes(fn) || fn.includes(normalizeStr(ing.name))));
    const pct = matched.length / ings.length;
    return pct >= threshold ? { recipe, matched: matched.length, total: ings.length, pct } : null;
  }).filter(Boolean).sort((a, b) => b.pct - a.pct);

  const counts = { all: fridge.length, ok: fridge.filter(i => fridgeStatus(i) === "ok").length, warn: fridge.filter(i => fridgeStatus(i) === "warn").length, danger: fridge.filter(i => fridgeStatus(i) === "danger").length };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Mon Frigo</h1>
            <span className="app-brand" style={{ fontSize: 11, fontWeight: 500, color: "var(--text3)", letterSpacing: "0.04em", fontFamily: "var(--ff-body)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span> <span style={{ opacity: 0.5 }}>{`v${__APP_VERSION__}`}</span></span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setShowSettings(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="settings" size={16} color="var(--text2)" /></button>
            <UserAvatar />
          </div>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
          <button onClick={() => setView("stock")} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: view === "stock" ? "var(--accent)" : "var(--surface2)", color: view === "stock" ? "#fff" : "var(--text2)", border: `1px solid ${view === "stock" ? "transparent" : "var(--border)"}` }}>🧊 Frigo</button>
          <button onClick={() => setView("pantry")} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: view === "pantry" ? "var(--accent)" : "var(--surface2)", color: view === "pantry" ? "#fff" : "var(--text2)", border: `1px solid ${view === "pantry" ? "transparent" : "var(--border)"}`, display: "flex", alignItems: "center", gap: 6 }}>
            🫙 Étagères
            {pantry.length > 0 && <span style={{ background: view === "pantry" ? "rgba(255,255,255,0.25)" : "var(--surface3)", color: view === "pantry" ? "#fff" : "var(--text2)", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{pantry.length}</span>}
          </button>
          <button onClick={() => setView("recipes")} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: view === "recipes" ? "var(--accent)" : "var(--surface2)", color: view === "recipes" ? "#fff" : "var(--text2)", border: `1px solid ${view === "recipes" ? "transparent" : "var(--border)"}`, display: "flex", alignItems: "center", gap: 6 }}>
            🍽 Recettes possibles
            {matchedRecipes.length > 0 && <span style={{ background: view === "recipes" ? "rgba(255,255,255,0.25)" : "var(--accent)", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{matchedRecipes.length}</span>}
          </button>
        </div>

        {/* Status filters — only in stock view */}
        {view === "stock" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 2, paddingBottom: 12 }}>
            {[["all", "Tous", "var(--text2)"], ["ok", "Frais", "var(--green)"], ["warn", "À surveiller", "var(--yellow)"], ["danger", "Urgents", "var(--red)"]].map(([key, label, color]) => (
              <button key={key} onClick={() => setFilterStatus(key)}
                style={{ flexShrink: 0, padding: "4px 11px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: filterStatus === key ? (key === "all" ? "var(--surface3)" : color) : "var(--surface2)", color: filterStatus === key ? (key === "all" ? "var(--text)" : "#fff") : "var(--text3)", border: `1px solid ${filterStatus === key ? (key === "all" ? "var(--border)" : color) : "var(--border)"}`, display: "flex", alignItems: "center", gap: 5, opacity: counts[key] === 0 && key !== "all" ? 0.4 : 1 }}>
                {label}
                <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>{counts[key]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>

        {/* ── STOCK VIEW ── */}
        {view === "stock" && (
          <>
            {/* Ajout rapide : saisie libre → nom/quantité/unité + catégorie/image auto */}
            <div style={{ background: "var(--surface)", borderRadius: 14, padding: 14, border: "1px solid var(--border)", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Ajouter un produit</div>
              <input className="field-input" placeholder="ex: 500g poulet, 2 yaourts, 1 courgette…"
                value={addText} onChange={e => setAddText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addFridgeItem()} style={{ marginBottom: 8 }} />
              {addText.trim() && (() => {
                const p = parseIngredientInput(addText);
                const name = p.name || addText.trim();
                const m = findIngredientMatch(name, ingredientDB);
                const cat = categories[m?.category || "other"];
                return (
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <IngImage src={m?.image || ""} alt={name} size={34} />
                    {p.amount && <span style={{ fontSize: 11, background: "rgba(240,192,96,0.15)", color: "var(--yellow)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Quantité : {p.amount}</span>}
                    {p.unit && <span style={{ fontSize: 11, background: "rgba(91,156,246,0.15)", color: "var(--blue)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Unité : {p.unit}</span>}
                    {p.name && <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--text2)", borderRadius: 8, padding: "2px 8px" }}>{p.name}</span>}
                    {m
                      ? <span style={{ fontSize: 11, background: "rgba(76,175,125,0.15)", color: "var(--green)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>✓ {cat?.icon} {cat?.label}</span>
                      : <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--text2)", borderRadius: 8, padding: "2px 8px" }}>{cat?.icon} Autres · non référencé</span>}
                  </div>
                );
              })()}
              <button className="btn btn-primary" style={{ width: "100%" }} onClick={addFridgeItem} disabled={!addText.trim()}>
                <Icon name="plus" size={15} /> Ajouter
              </button>
            </div>
            {filteredFridge.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 40 }}>🧊</span>
                <p style={{ fontSize: 14, fontWeight: 500 }}>{filterStatus === "all" ? "Frigo vide" : "Aucun produit dans cette catégorie"}</p>
                <p style={{ fontSize: 12 }}>Ajoute tes produits pour suivre leur fraîcheur.</p>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredFridge.map((item, idx) => {
                const status = fridgeStatus(item);
                const days = fridgeDaysAge(item.addedAt);
                const thresh = FRIDGE_THRESHOLDS[item.category] || FRIDGE_THRESHOLDS["other"];
                return (
                  <div key={item.id} className="slide-up" style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", borderRadius: 14, padding: "12px 14px", border: `1px solid ${status === "danger" ? "rgba(224,82,82,0.3)" : status === "warn" ? "rgba(240,192,96,0.25)" : "var(--border)"}`, animationDelay: `${idx * 0.04}s` }}>
                    {/* Image de l'ingrédient (comme dans les autres menus), avec repli si non référencé */}
                    <IngImage src={item.image || (findIngredientMatch(item.name, ingredientDB)?.image || "")} alt={item.name} size={46} />
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {(item.quantity || item.unit) && (
                          <span style={{ fontSize: 11, color: "var(--text3)" }}>{item.quantity}{item.unit && ` ${item.unit}`}</span>
                        )}
                        <span style={{ fontSize: 11, color: FRIDGE_STATUS_COLOR[status], fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: FRIDGE_STATUS_COLOR[status], display: "inline-block" }} />
                          {days === 0 ? "Ajouté aujourd'hui" : `${days}j — ${FRIDGE_STATUS_LABEL[status]}`}
                        </span>
                      </div>
                      {/* Freshness bar */}
                      <div style={{ height: 3, background: "var(--surface2)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, background: FRIDGE_STATUS_COLOR[status], width: `${Math.min(100, (days / thresh.danger) * 100)}%`, transition: "width 0.4s" }} />
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => startEdit(item)} style={{ color: "var(--text3)" }}><Icon name="edit" size={15} /></button>
                      <button onClick={() => deleteItem(item.id)} style={{ color: "var(--red)" }}><Icon name="trash" size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── PANTRY VIEW ── */}
        {view === "pantry" && (
          <>
            {/* Quick add */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input className="field-input" placeholder="ex: 400g tomates pelées, huile d'olive…" value={pantryText}
                onChange={e => { setPantryText(e.target.value); }}
                onKeyDown={e => e.key === "Enter" && addPantryItem()}
                style={{ flex: 1 }} />
              <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={addPantryItem} disabled={!pantryText.trim()}>
                <Icon name="plus" size={15} /> Ajouter
              </button>
            </div>
            {pantry.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 40 }}>🫙</span>
                <p style={{ fontSize: 14, fontWeight: 500 }}>Étagères vides</p>
                <p style={{ fontSize: 12, maxWidth: 260 }}>Ajoute tes conserves, condiments, épices et autres produits de longue conservation.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[...pantry].sort((a, b) => a.name.localeCompare(b.name, "fr")).map(item => (
                  <div key={item.id} className="slide-up" style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", borderRadius: 14, padding: "12px 14px", border: "1px solid var(--border)" }}>
                    {(() => { const img = item.image || findIngredientMatch(item.name, ingredientDB)?.image || ""; return img
                      ? <div style={{ width: 38, height: 38, borderRadius: 10, overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={img} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
                      : <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>🫙</div>
                    ; })()}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{item.name}</div>
                      {(item.quantity || item.unit) && (
                        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 1 }}>
                          {[item.quantity, item.unit].filter(Boolean).join(" ")}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setEditPantryItem({ ...item })} style={{ color: "var(--text3)" }}><Icon name="edit" size={15} /></button>
                      <button onClick={() => deletePantryItem(item.id)} style={{ color: "var(--red)" }}><Icon name="trash" size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── RECIPES VIEW ── */}
        {view === "recipes" && (
          <>
            {fridge.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 40 }}>🍽</span>
                <p style={{ fontSize: 14, fontWeight: 500 }}>Frigo vide</p>
                <p style={{ fontSize: 12 }}>Ajoute des produits dans ton frigo pour voir les recettes possibles.</p>
              </div>
            ) : matchedRecipes.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 40 }}>🤔</span>
                <p style={{ fontSize: 14, fontWeight: 500 }}>Aucune recette trouvée</p>
                <p style={{ fontSize: 12 }}>Essaie de baisser le seuil de correspondance dans les réglages.</p>
                <button onClick={() => setShowSettings(true)} className="btn btn-ghost btn-sm"><Icon name="settings" size={13} /> Réglages</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>{matchedRecipes.length} recette{matchedRecipes.length > 1 ? "s" : ""} avec au moins {fridgeSettings.matchThreshold}% des ingrédients disponibles</p>
                {matchedRecipes.map(({ recipe, matched, total, pct }, idx) => (
                  <button key={recipe.id} onClick={() => onSelectRecipe(recipe.id)} className="slide-up"
                    style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", borderRadius: 14, padding: "12px 14px", border: "1px solid var(--border)", textAlign: "left", transition: "border-color 0.15s", animationDelay: `${idx * 0.04}s` }}>
                    <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}><Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{recipe.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: "var(--surface2)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: pct >= 0.75 ? "var(--green)" : pct >= 0.5 ? "var(--yellow)" : "var(--accent)", borderRadius: 2, width: `${pct * 100}%`, transition: "width 0.4s" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: pct >= 0.75 ? "var(--green)" : pct >= 0.5 ? "var(--yellow)" : "var(--accent)", flexShrink: 0 }}>{matched}/{total} ingr.</span>
                      </div>
                    </div>
                    <Icon name="forward" size={16} color="var(--text3)" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {showAdd && (
        <SwipeableSheet onClose={() => { setShowAdd(false); setEditItem(null); }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editItem ? "Modifier le produit" : "Ajouter au frigo"}</h3>
          <div className="field-label">Nom du produit</div>
          <input className="field-input" placeholder="ex: Poulet, Yaourt, Courgette…" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 12 }} autoFocus />
          <div className="field-label">Catégorie</div>
          <select className="field-input" value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} style={{ marginBottom: 12 }}>
            {sortedCategoryEntries(categories).filter(([k]) => FRIDGE_CATS.has(k)).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <div className="field-label">Quantité</div>
              <input className="field-input" type="number" min="0" placeholder="ex: 500" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">Unité</div>
              <input className="field-input" placeholder="g, ml, pièce…" value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} />
            </div>
          </div>
          <div className="field-label">Date d'ajout</div>
          <input type="date" className="field-input" value={newItem.addedAt} onChange={e => setNewItem(p => ({ ...p, addedAt: e.target.value }))} style={{ marginBottom: 16 }} />
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontSize: 12 }}>
            <span style={{ color: "var(--text3)" }}>Seuil d'alerte pour </span>
            <span style={{ fontWeight: 600 }}>{categories[newItem.category]?.label}</span>
            <span style={{ color: "var(--text3)" }}> : </span>
            <span style={{ color: "var(--yellow)", fontWeight: 600 }}>⚠ {FRIDGE_THRESHOLDS[newItem.category]?.warn}j</span>
            <span style={{ color: "var(--text3)" }}> · </span>
            <span style={{ color: "var(--red)", fontWeight: 600 }}>🔴 {FRIDGE_THRESHOLDS[newItem.category]?.danger}j</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowAdd(false); setEditItem(null); }}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveItem} disabled={!newItem.name.trim()}>Sauvegarder</button>
          </div>
        </SwipeableSheet>
      )}

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <SwipeableSheet onClose={() => setShowSettings(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Réglages du Frigo</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Configure le seuil de correspondance pour les suggestions de recettes.</p>
          <div className="field-label">Seuil de correspondance — {fridgeSettings.matchThreshold}%</div>
          <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>Une recette est suggérée si tu as au moins ce pourcentage de ses ingrédients dans le frigo.</p>
          <input type="range" min="10" max="100" step="5" value={fridgeSettings.matchThreshold}
            onChange={e => setFridgeSettings(p => ({ ...p, matchThreshold: +e.target.value }))}
            style={{ width: "100%", accentColor: "var(--accent)", marginBottom: 8 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)", marginBottom: 20 }}>
            <span>10% (permissif)</span><span>100% (exact)</span>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text2)", marginBottom: 20 }}>
            Actuellement : <strong>{matchedRecipes.length} recette{matchedRecipes.length > 1 ? "s" : ""}</strong> correspondent avec tes {fridge.length} produits en frigo.
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setShowSettings(false)}>Fermer</button>
        </SwipeableSheet>
      )}

      {/* Étagères — édition d'un item */}
      {editPantryItem && (
        <SwipeableSheet onClose={() => setEditPantryItem(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Modifier l'article</h3>
          <div className="field-label">Nom</div>
          <input className="field-input" value={editPantryItem.name} autoFocus onChange={e => setEditPantryItem(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 12 }} />
          <div className="field-label">Catégorie</div>
          <select className="field-input" value={editPantryItem.category || "other"} onChange={e => setEditPantryItem(p => ({ ...p, category: e.target.value }))} style={{ marginBottom: 12 }}>
            {sortedCategoryEntries(categories).filter(([k]) => PANTRY_CATS.has(k)).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="field-label">Quantité</div>
              <input className="field-input" value={editPantryItem.quantity} onChange={e => setEditPantryItem(p => ({ ...p, quantity: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="field-label">Unité</div>
              <input className="field-input" value={editPantryItem.unit} onChange={e => setEditPantryItem(p => ({ ...p, unit: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditPantryItem(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={savePantryEdit}>Enregistrer</button>
          </div>
        </SwipeableSheet>
      )}
    </div>
  );
}
