import { Icon } from "../ui/Icon.jsx";
import { ImageUpload } from "../ui/ImageUpload.jsx";
import { BaseIcon } from "../ui/BaseIcon.jsx";
import { ClassementPill, EditorHead } from "./EditorSections.jsx";
import { CUISINES } from "../../constants/cuisines.js";
import { RECIPE_CATEGORIES, BASE_CATEGORIES } from "../../constants/recipeCategories.js";
import type { RefObject } from "react";
import type { EditorForm, EditorFormUpdate } from "./editorForm.js";

/** Champs numériques réglés au pas à pas : libellé, champ, pas, bornes. */
const STEPPERS: [label: string, field: "prepTime" | "cookTime" | "servings", step: number, min: number, max: number][] = [
  ["Prép. (min)", "prepTime", 5, 0, 999],
  ["Cuisson (min)", "cookTime", 5, 0, 999],
  ["Portions", "servings", 1, 1, 24],
];

interface EditorInfoPaneProps {
  form: EditorForm;
  up: EditorFormUpdate;
  upYield: (field: "amount" | "unit", value: number | string) => void;
  onToggleComponent: () => void;
  onOpenChef: () => void;
  /** Refs de l'élastique vertical du panneau (cf. useElasticScroll). */
  pane: { scrollRef: RefObject<HTMLDivElement | null>; contentRef: RefObject<HTMLDivElement | null> };
}

/** Panneau « Infos » de l'éditeur : photo, nom, chef, source, temps, classement. */
export function EditorInfoPane({ form, up, upYield, onToggleComponent, onOpenChef, pane }: EditorInfoPaneProps) {
  return (
  <div ref={pane.scrollRef} style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto" }}>
    <div ref={pane.contentRef} className="editor-col" style={{ padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Photo + identité */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ImageUpload value={form.image} onChange={v => up("image", v)} style={{ height: 172, borderRadius: 16 }} pathPrefix="recipes" />
        <div>
          <div className="field-label">Nom <span style={{ color: "var(--accent2)" }}>*</span></div>
          <input className="field-input field-soft" placeholder="ex : Tarte Tatin" value={form.name} onChange={e => up("name", e.target.value)} style={{ background: "var(--surface)", borderRadius: 12, height: 46 }} />
        </div>
        <div>
          <div className="field-label">Chef</div>
          <button type="button" className="field-input field-soft field-picker" onClick={() => onOpenChef()} aria-haspopup="dialog"
            style={{ background: "var(--surface)", borderRadius: 12, height: 46, paddingLeft: 15, display: "flex", alignItems: "center", gap: 11, cursor: "pointer", textAlign: "left" }}>
            <Icon name="chef" size={18} color={form.chef ? "var(--accent)" : "var(--text3)"} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: form.chef ? "var(--text)" : "var(--text3)" }}>{form.chef || "Choisir un chef"}</span>
            <Icon name="chevronDown" size={16} color="var(--text3)" />
          </button>
        </div>
        <div>
          <div className="field-label">Source</div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 15, top: "50%", marginTop: -9, display: "flex", pointerEvents: "none" }}>
              <Icon name="link" size={18} color={form.source ? "var(--accent)" : "var(--text3)"} />
            </span>
            <input className="field-input field-soft" placeholder="ex : cestmafournee.com" value={form.source || ""} onChange={e => up("source", e.target.value)} style={{ background: "var(--surface)", borderRadius: 12, height: 46, paddingLeft: 44 }} />
          </div>
        </div>
      </div>

      {/* Temps & portions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <EditorHead icon="clock" label="Temps & portions" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {STEPPERS.map(([label, field, step, min, max]) => (
            <div key={field}>
              <div className="field-label" style={{ fontSize: 10.5 }}>{label}</div>
              <div className="stepper">
                <button type="button" className="stepper-btn" onClick={() => up(field, Math.max(min, (Number(form[field]) || 0) - step))}>
                  <svg width="11" height="2" viewBox="0 0 11 2"><rect x="0" y="0" width="11" height="2" rx="1" fill="currentColor"/></svg>
                </button>
                <input className="stepper-input no-spin" type="number" min={min} max={max} value={form[field] ?? ""}
                  onChange={e => up(field, Math.min(max, Math.max(min, +e.target.value || 0)))} />
                <button type="button" className="stepper-btn" onClick={() => up(field, Math.min(max, (Number(form[field]) || 0) + step))}>
                  <svg width="11" height="11" viewBox="0 0 11 11"><rect x="4.5" y="0" width="2" height="11" rx="1" fill="currentColor"/><rect x="0" y="4.5" width="11" height="2" rx="1" fill="currentColor"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Classement */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <EditorHead icon="grid" label="Classement" />
        {/* Préparation de base (composant) : réutilisable comme ingrédient. */}
        <div style={{ background: form.isComponent ? "rgba(var(--accent-rgb),0.1)" : "var(--surface)", borderRadius: 18, overflow: "hidden", transition: "background-color 0.2s" }}>
          {/* `.ripple` sur la rangée seule : l'onde ne déborde pas sur le rendement déplié. */}
          <label className="ripple" style={{ display: "flex", alignItems: "center", gap: 12, padding: 15, cursor: "pointer" }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: form.isComponent ? "rgba(var(--accent-rgb),0.16)" : "var(--surface2)" }}><BaseIcon size={20} color={form.isComponent ? "var(--accent)" : "var(--text2)"} /></span>
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => onToggleComponent()}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Préparation de base</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, lineHeight: 1.4 }}>Réutilisable comme ingrédient (béchamel, sauce, pâte…)</div>
            </div>
            <button type="button" onClick={() => onToggleComponent()}
              style={{ width: 44, height: 25, borderRadius: 13, flexShrink: 0, border: "none", cursor: "pointer", background: form.isComponent ? "var(--accent)" : "var(--surface3)", position: "relative", transition: "background 0.2s" }}>
              <span style={{ position: "absolute", top: 2, left: form.isComponent ? 21 : 2, width: 21, height: 21, borderRadius: "50%", background: "#fff", transition: "left 0.18s cubic-bezier(0.4,0,0.2,1)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
            </button>
          </label>
          {form.isComponent && (
            <div style={{ padding: "2px 15px 16px" }}>
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
        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>{form.isComponent ? "Type de préparation" : "Type de recette"}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(form.isComponent ? BASE_CATEGORIES : RECIPE_CATEGORIES).map(c => {
              const active = form.category === c.id;
              return <ClassementPill key={c.id} active={active} emoji={c.emoji} label={c.label} onClick={() => up("category", active ? "" : c.id)} />;
            })}
          </div>
        </div>
        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>Style de cuisine</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CUISINES.map(c => {
              const active = form.cuisine === c.label;
              return <ClassementPill key={c.label} active={active} emoji={c.emoji} label={c.label} onClick={() => up("cuisine", active ? "" : c.label)} />;
            })}
          </div>
        </div>
      </div>

    </div>
  </div>
  );
}
