import { useState, useRef } from "react";
import { Icon } from "../components/Icon.jsx";
import { IngImage } from "../components/Img.jsx";
import { ImageUpload } from "../components/ImageUpload.jsx";
import { TagInput } from "../components/TagInput.jsx";
import { UtensilPicker } from "../components/UtensilPicker.jsx";
import { DraggableStep } from "../components/DraggableStep.jsx";
import { findIngredientMatch } from "../lib/nameMatcher.js";
import { parseIngredientInput } from "../lib/parseIngredient.js";

// ─── RECIPE EDITOR ────────────────────────────────────────────────────────────

export function RecipeEditor({ recipe, onSave, onCancel, ingredientDB, utensilDB, collections, recipes }) {
  const [form, setForm] = useState({ ...recipe, ingredients: recipe.ingredients || [], utensils: recipe.utensils || [], steps: recipe.steps || [], tags: recipe.tags || [], collections: recipe.collections || [], isComponent: !!recipe.isComponent, yield: recipe.yield || { amount: "", unit: "g" } });
  const [section, setSection] = useState("info");
  const up = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const upYield = (f, v) => setForm(p => ({ ...p, yield: { ...(p.yield || { amount: "", unit: "g" }), [f]: v } }));

  // Un ingrédient renseigné doit avoir une quantité strictement positive.
  const ingIsMissingQty = ing => (ing.name || ing.dbId || ing.recipeId) && !(Number(ing.amount) > 0);
  const handleSave = () => {
    if (form.ingredients.some(ingIsMissingQty)) setSection("ingrédients");
    const out = { ...form };
    if (out.isComponent) out.yield = { amount: Number(form.yield?.amount) || 0, unit: form.yield?.unit || "g" };
    else { delete out.yield; out.isComponent = false; }
    onSave(out);
  };

  // Ingredients
  const addIng = () => {
    up("ingredients", [...form.ingredients, { id: "i" + Date.now(), dbId: "", name: "", amount: "", unit: "", _raw: "" }]);
  };
  const updIng = (id, f, v) => up("ingredients", form.ingredients.map(i => i.id === id ? { ...i, [f]: v } : i));
  const remIng = id => up("ingredients", form.ingredients.filter(i => i.id !== id));

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

  const dragRef = useRef(null);
  const isProgrammaticScroll = useRef(false);
  const scrollTimer = useRef(null);

  return (
    <div className="editor-enter" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
        <button onClick={onCancel}><Icon name="close" size={20} /></button>
        <h2 style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>{recipe.id ? "Modifier" : (form.name.trim() || "Nouvelle recette")}</h2>
        <button className="btn btn-primary" style={{ padding: "8px 16px" }} onClick={handleSave}><Icon name="check" size={15} /> Sauvegarder</button>
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
            if (dx > 6 || dy > 6) el._lockAxis = dx > dy ? "x" : "y";
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
                <div><div className="field-label">Prép. (min)</div><input className="field-input" type="number" min="0" value={form.prepTime} onChange={e => up("prepTime", +e.target.value)} /></div>
                <div><div className="field-label">Cuisson (min)</div><input className="field-input" type="number" min="0" value={form.cookTime} onChange={e => up("cookTime", +e.target.value)} /></div>
                <div><div className="field-label">Portions</div><input className="field-input" type="number" min="1" max="24" value={form.servings} onChange={e => up("servings", Math.min(24, Math.max(1, +e.target.value)))} /></div>
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
                    <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>🧈 Préparation de base</div>
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
            {form.ingredients.map(ing => (
              <div key={ing.id} style={{ background: "var(--surface)", borderRadius: 12, padding: 12, border: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <input className="field-input" placeholder="ex: 500g pois chiches, 2 oeufs, 1 c. à soupe huile…"
                    value={ing._raw !== undefined ? ing._raw : ""}
                    onChange={e => {
                      const raw = e.target.value;
                      const parsed = parseIngredientInput(raw);
                      const match = parsed.name ? findIngredientMatch(parsed.name, ingredientDB) : null;
                      up("ingredients", form.ingredients.map(x => x.id === ing.id ? {
                        ...x, _raw: raw, name: parsed.name, amount: parsed.amount, unit: parsed.unit,
                        dbId: match ? match.id : ""
                      } : x));
                    }}
                    style={{ marginBottom: 0 }} />
                  {(ing.name || ing.amount) && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {ing.dbId && (() => {
                        const img = ingredientDB.find(d => d.id === ing.dbId)?.image;
                        return img ? <IngImage src={img} alt={ing.name} size={32} /> : null;
                      })()}
                      {Number(ing.amount) > 0
                        ? <span style={{ fontSize: 11, background: "rgba(240,192,96,0.15)", color: "var(--yellow)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Quantité : {ing.amount}</span>
                        : <span style={{ fontSize: 11, background: "rgba(224,82,82,0.12)", color: "#c04040", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>⚠ Quantité manquante</span>}
                      {ing.unit && <span style={{ fontSize: 11, background: "rgba(91,156,246,0.15)", color: "var(--blue)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Unité : {ing.unit}</span>}
                      {ing.name && <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--text2)", borderRadius: 8, padding: "2px 8px" }}>{ing.name}</span>}
                      {ing.dbId
                        ? <span style={{ fontSize: 11, background: "rgba(76,175,125,0.15)", color: "var(--green)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>✓ Ingrédient reconnu</span>
                        : ing.name ? <span style={{ fontSize: 11, background: "rgba(224,82,82,0.12)", color: "#c04040", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>✕ Non référencé</span> : null}
                    </div>
                  )}
                </div>
                <button onClick={() => remIng(ing.id)} style={{ flexShrink: 0, paddingTop: 10 }}><Icon name="trash" size={14} color="var(--red)" /></button>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ width: "100%" }} onClick={addIng}><Icon name="plus" size={16} /> Ajouter un ingrédient</button>
          </div>
          <div style={{ height: 20 }} />
        </div>

        {/* Slide 3 — Ustensiles */}
        <UtensilPicker utensilDB={utensilDB} selected={form.utensils} onChange={v => up("utensils", v)} />

        {/* Slide 4 — Étapes */}
        <div style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text3)", background: "var(--surface2)", padding: "8px 12px", borderRadius: 10 }}>
              ↕ Glissez les étapes pour les réorganiser
            </div>
            {form.steps.map((step, i) => (
              <DraggableStep key={step.id} step={step} index={i} total={form.steps.length}
                ingredients={form.ingredients} utensils={form.utensils}
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
