import { useState, useRef } from "react";
import { Icon } from "../components/Icon.jsx";
import { ImageUpload } from "../components/ImageUpload.jsx";
import { TagInput } from "../components/TagInput.jsx";
import { UtensilPicker } from "../components/UtensilPicker.jsx";
import { DraggableStep } from "../components/DraggableStep.jsx";
import { DraggableIngredient } from "../components/DraggableIngredient.jsx";
import { findIngredientMatch } from "../lib/nameMatcher.js";
import { parseIngredientInput } from "../lib/parseIngredient.js";
import { BaseIcon } from "../components/BaseIcon.jsx";
import { useIsDesktop } from "../hooks/useIsDesktop.js";

// ─── RECIPE EDITOR ────────────────────────────────────────────────────────────

export function RecipeEditor({ recipe, onSave, onCancel, ingredientDB, utensilDB, collections, recipes }) {
  const [form, setForm] = useState({ ...recipe, ingredients: recipe.ingredients || [], utensils: recipe.utensils || [], steps: recipe.steps || [], tags: recipe.tags || [], collections: recipe.collections || [], isComponent: !!recipe.isComponent, yield: recipe.yield || { amount: "", unit: "g" } });
  const [section, setSection] = useState("info");
  const up = (f, v) => setForm(p => ({ ...p, [f]: v }));
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
      setSection("ingrédients");
      setSaveError(`${invalid.length} ingrédient${invalid.length > 1 ? "s" : ""} sans quantité valide. Renseigne une quantité ou supprime la ligne.`);
      const el = document.getElementById("editor-swiper");
      if (el) el.scrollTo({ left: el.offsetWidth, behavior: "smooth" });
      return;
    }
    setSaveError("");
    const out = { ...form, ingredients: cleaned };
    if (out.isComponent) out.yield = { amount: Number(form.yield?.amount) || 0, unit: form.yield?.unit || "g" };
    else { delete out.yield; out.isComponent = false; }
    onSave(out);
  };

  // Ingredients
  const [addMode, setAddMode] = useState("ing"); // "ing" = ingrédient brut | "comp" = composant
  const lastAddedIdRef = useRef(null);
  const addIng = () => {
    const id = "i" + Date.now();
    lastAddedIdRef.current = id;
    up("ingredients", [...form.ingredients, { id, dbId: "", name: "", amount: "", unit: "", _raw: "" }]);
  };
  const moveIng = (fromIdx, toIdx) => {
    const arr = [...form.ingredients];
    const [removed] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, removed);
    up("ingredients", arr);
  };
  const updIng = (id, f, v) => { if (saveError) setSaveError(""); up("ingredients", form.ingredients.map(i => i.id === id ? { ...i, [f]: v } : i)); };
  const remIng = id => { if (saveError) setSaveError(""); up("ingredients", form.ingredients.filter(i => i.id !== id)); };
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
  const addComponent = (comp) => {
    up("ingredients", [...form.ingredients, { id: "i" + Date.now(), recipeId: comp.id, name: comp.name, amount: "", unit: comp.yield?.unit || "g" }]);
  };

  // Utensils
  const addUt = () => {
    const first = utensilDB[0];
    up("utensils", [...form.utensils, { id: "u" + Date.now(), dbId: first?.id || "", name: first?.name || "" }]);
  };
  const updUt = (id, f, v) => up("utensils", form.utensils.map(u => u.id === id ? { ...u, [f]: v } : u));
  const remUt = id => up("utensils", form.utensils.filter(u => u.id !== id));

  // Steps with drag reorder
  const addStep = () => up("steps", [...form.steps, { id: "s" + Date.now(), title: "", text: "", ingredients: [], utensils: [] }]);
  const updStep = (id, f, v) => up("steps", form.steps.map(s => s.id === id ? { ...s, [f]: v } : s));
  const remStep = id => up("steps", form.steps.filter(s => s.id !== id));
  const moveStep = (fromIdx, toIdx) => {
    const arr = [...form.steps];
    const [removed] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, removed);
    up("steps", arr);
  };

  const isDesktop = useIsDesktop();
  const isProgrammaticScroll = useRef(false);
  const scrollTimer = useRef(null);

  return (
    <div className="editor-enter" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
        <button onClick={onCancel} style={{ flexShrink: 0, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "var(--surface2)" }}><Icon name="close" size={12} /></button>
        <h2 style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recipe.id ? "Modifier" : (form.name.trim() || "Nouvelle recette")}</h2>
        <button className="btn btn-primary" style={{ flexShrink: 0, padding: "8px 16px", fontSize: 13 }} onClick={handleSave}><Icon name="check" size={15} /> Sauvegarder</button>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, overflowX: "auto" }}>
        {["info", "ingrédients", "ustensiles", "étapes"].map((s, i) => (
          <button key={s} onClick={() => {
            setSection(s);
            const el = document.getElementById("editor-swiper");
            if (el) {
              isProgrammaticScroll.current = true;
              clearTimeout(scrollTimer.current);
              el.scrollTo({ left: i * el.offsetWidth, behavior: "smooth" });
              scrollTimer.current = setTimeout(() => { isProgrammaticScroll.current = false; }, 350);
            }
          }} style={{ flexShrink: 0, padding: "10px 16px", fontSize: 12, fontWeight: 500, color: section === s ? "var(--accent)" : "var(--text3)", borderBottom: `2px solid ${section === s ? "var(--accent)" : "transparent"}`, textTransform: "capitalize", transition: "color 0.15s, border-color 0.15s" }}>{s}</button>
        ))}
      </div>
      <div id="editor-swiper"
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
            // Seuil relevé + dominance horizontale requise pour éviter les faux déclenchements
            if (dx > 16 || dy > 16) el._lockAxis = (dx > dy * 2) ? "x" : "y";
          }
          if (el._lockAxis === "y") el.style.overflowX = "hidden";
          else el.style.overflowX = "auto";
        }}
        onTouchEnd={e => { e.currentTarget.style.overflowX = "auto"; }}
        onScroll={e => {
          if (isProgrammaticScroll.current) return;
          const idx = Math.round(e.target.scrollLeft / e.target.offsetWidth);
          setSection(["info", "ingrédients", "ustensiles", "étapes"][idx]);
        }} style={{ flex: 1, display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>

        {/* Slide 1 — Info */}
        <div style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto", padding: 20 }}>
          {(
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><div className="field-label">Nom <span style={{ color: "var(--accent2)" }}>*</span></div><input className="field-input" placeholder="ex: Tarte Tatin" value={form.name} onChange={e => up("name", e.target.value)} /></div>
              <div><div className="field-label">Source</div><input className="field-input" placeholder="marmiton.org…" value={form.source || ""} onChange={e => up("source", e.target.value)} /></div>
              <div>
                <div className="field-label">Photo principale</div>
                <ImageUpload value={form.image} onChange={v => up("image", v)} style={{ height: 140 }} pathPrefix="recipes" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  ["Prép. (min)", "prepTime", 5, 0, 999],
                  ["Cuisson (min)", "cookTime", 5, 0, 999],
                  ["Portions", "servings", 1, 1, 24],
                ].map(([label, field, step, min, max]) => (
                  <div key={field}>
                    <div className="field-label">{label}</div>
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

              {/* Préparation de base (composant) : peut être réutilisée comme ingrédient
                  dans d'autres recettes. Le rendement déclare ce qu'elle produit. */}
              <div style={{ background: "var(--surface)", border: `1px solid ${form.isComponent ? "var(--accent)" : "var(--border)"}`, borderRadius: 12, padding: 14, transition: "border-color 0.2s" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <button type="button" onClick={() => up("isComponent", !form.isComponent)}
                    style={{ width: 42, height: 24, borderRadius: 12, flexShrink: 0, background: form.isComponent ? "var(--accent)" : "var(--surface3)", position: "relative", transition: "background 0.2s" }}>
                    <span style={{ position: "absolute", top: 2, left: form.isComponent ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                  </button>
                  <div style={{ flex: 1 }} onClick={() => up("isComponent", !form.isComponent)}>
                    <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><BaseIcon size={18} /> Préparation de base</div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Réutilisable comme ingrédient dans d'autres recettes (béchamel, sauce, pâte…)</div>
                  </div>
                </label>
                {form.isComponent && (
                  <div style={{ marginTop: 14 }}>
                    <div className="field-label">Rendement <span style={{ color: "var(--accent2)" }}>*</span> <span style={{ color: "var(--text3)", fontWeight: 400 }}>— ce que produit la préparation</span></div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input className="field-input" type="number" min="0" step="any" placeholder="ex: 400" value={form.yield?.amount ?? ""} onChange={e => upYield("amount", e.target.value === "" ? "" : +e.target.value)} style={{ flex: 2 }} />
                      <select className="field-input" value={form.yield?.unit || "g"} onChange={e => upYield("unit", e.target.value)} style={{ flex: 1 }}>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="pièce">pièce(s)</option>
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>Les recettes qui l'utilisent en consommeront une partie (ex : 150 {form.yield?.unit || "g"}).</div>
                  </div>
                )}
              </div>
              <TagInput tags={form.tags || []} onChange={v => up("tags", v)} allTags={[...new Set(recipes?.flatMap(r => r.tags || []) || [])]} />
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Collections</div>
                {collections.length === 0 && <p style={{ fontSize: 12, color: "var(--text3)" }}>Aucune collection — créez-en dans Config.</p>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {collections.map(col => {
                    const active = (form.collections || []).includes(col.id);
                    return (
                      <button key={col.id} onClick={() => up("collections", active ? (form.collections || []).filter(id => id !== col.id) : [...(form.collections || []), col.id])}
                        style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: active ? col.color : "var(--surface2)", color: active ? "#fff" : "var(--text2)", border: `1px solid ${active ? col.color : "var(--border)"}`, display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
                        {active && <Icon name="check" size={11} color="#fff" />}
                        {col.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div style={{ height: 20 }} />
        </div>

        {/* Slide 2 — Ingrédients */}
        <div style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {saveError && (
              <div className="shake" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(224,82,82,0.12)", border: "1px solid rgba(224,82,82,0.4)", color: "var(--red)", fontSize: 12.5, fontWeight: 500, lineHeight: 1.4 }}>
                <Icon name="warning" size={16} color="var(--red)" /> {saveError}
              </div>
            )}
            {form.ingredients.map((ing, i) => (
              <DraggableIngredient key={ing.id} ing={ing} index={i} total={form.ingredients.length}
                draggable={!isDesktop} ingredientDB={ingredientDB} recipes={recipes}
                autoFocus={ing.id === lastAddedIdRef.current}
                onRawChange={handleRawChange}
                onUpdateAmount={(id, v) => updIng(id, "amount", v)}
                onRemove={remIng} onMove={moveIng} onEnter={addIng} />
            ))}
            {/* Zone d'ajout : bascule ingrédient brut / composant (préparation de base).
                Onglet Composants masqué quand on édite soi-même un composant (mono-niveau v1). */}
            {!form.isComponent ? (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, justifyContent: "flex-end" }}>
                  {[["ing", "Ingrédient", null], ["comp", "Base", "base"]].map(([k, label, icon], i) => (
                    <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {i > 0 && <span style={{ color: "var(--border)", fontSize: 11 }}>·</span>}
                      <button onClick={() => setAddMode(k)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 0, fontSize: 12, fontWeight: addMode === k ? 600 : 500, background: "transparent", color: addMode === k ? "var(--accent)" : "var(--text3)", border: "none", cursor: "pointer", transition: "color 0.15s" }}>
                        {icon === "base" ? <BaseIcon size={12} color={addMode === k ? "var(--accent)" : "var(--text3)"} /> : <Icon name="leaf" size={11} color={addMode === k ? "var(--accent)" : "var(--text3)"} />}
                        {label}
                      </button>
                    </span>
                  ))}
                </div>
                {addMode === "ing" ? (
                  <button className="btn btn-ghost" style={{ width: "100%" }} onClick={addIng}><Icon name="plus" size={16} /> Ajouter un ingrédient</button>
                ) : availableComponents.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", padding: "8px 0" }}>Aucune base disponible. Crée une recette en « base » d'abord.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {availableComponents.map(comp => (
                      <button key={comp.id} onClick={() => addComponent(comp)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", textAlign: "left" }}>
                        <span style={{ display: "flex", alignItems: "center" }}><BaseIcon size={16} /></span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{comp.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>{comp.yield?.amount} {comp.yield?.unit}</span>
                        <Icon name="plus" size={15} color="var(--accent)" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button className="btn btn-ghost" style={{ width: "100%" }} onClick={addIng}><Icon name="plus" size={16} /> Ajouter un ingrédient</button>
            )}
          </div>
          <div style={{ height: 20 }} />
        </div>

        {/* Slide 3 — Ustensiles */}
        <UtensilPicker utensilDB={utensilDB} selected={form.utensils} onChange={v => up("utensils", v)} />

        {/* Slide 4 — Étapes */}
        <div style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {!isDesktop && (
              <div style={{ fontSize: 12, color: "var(--text3)", background: "var(--surface2)", padding: "8px 12px", borderRadius: 10 }}>
                ↕ Glissez les étapes pour les réorganiser
              </div>
            )}
            {form.steps.map((step, i) => (
              <DraggableStep key={step.id} step={step} index={i} total={form.steps.length}
                ingredients={form.ingredients} utensils={form.utensils} recipes={recipes}
                draggable={!isDesktop}
                onUpdate={updStep} onRemove={remStep} onMove={moveStep} />
            ))}
            <button className="btn btn-ghost" style={{ width: "100%" }} onClick={addStep}><Icon name="plus" size={16} /> Ajouter une étape</button>
          </div>
          <div style={{ height: 20 }} />
        </div>

      </div>
    </div>
  );
}
