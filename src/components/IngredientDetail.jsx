import { useState, useRef, useEffect } from "react";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { NutriScoreBadge } from "./NutriScoreBadge.jsx";
import { Donut } from "./Donut.jsx";
import { TagInput } from "./TagInput.jsx";
import { SeasonBar } from "./SeasonBar.jsx";
import { SeasonBadge } from "./Badges.jsx";
import { uploadImage, compressImage } from "@/lib/firebase/storage.js";
import { computeNutriInfo } from "@/lib/recipes/nutriscore.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries, isFruitVeg } from "../constants/categories.js";
import { ingredientMonths, isIngredientInSeason, SEASONAL_CATEGORIES, formatMonths } from "@/lib/food/seasonality.js";
import { NUTRI_RI, MACRO_COLORS } from "../constants/nutritionDisplay.js";
import { TIP_TYPES, TIP_ORDER } from "../constants/tipTypes.js";

// Photo ronde éditable en place : clic → change la photo (upload Storage, repli base64).
function RoundImageUpload({ value, onChange, size = 82 }) {
  const inputId = useRef("ingimg_" + Math.random().toString(36).slice(2)).current;
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    try { onChange(await uploadImage(file, "master/ingredients")); }
    catch {
      try { const { blob } = await compressImage(file); const r = new FileReader(); r.onload = ev => onChange(ev.target.result); r.readAsDataURL(blob); }
      catch { /* ignore */ }
    } finally { setUploading(false); e.target.value = ""; }
  };
  return (
    <label htmlFor={inputId} title="Changer la photo" style={{ position: "relative", flexShrink: 0, cursor: "pointer", display: "block", borderRadius: "50%", boxShadow: "0 4px 14px -6px rgba(0,0,0,0.25)" }}>
      <IngImage src={value} alt="" size={size} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.42)", display: "grid", placeItems: "center" }}>
        {uploading
          ? <span style={{ width: 20, height: 20, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          : <Icon name="photo" size={20} color="#fff" />}
      </span>
      <span style={{ position: "absolute", bottom: -2, right: -2, width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--surface)", display: "grid", placeItems: "center" }}><Icon name="edit" size={11} color="#fff" /></span>
      <input id={inputId} type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
    </label>
  );
}

// Champ nombre éditable inline (aligné à droite façon valeur).
function NumField({ value, onChange, step = 0.1, width = 62, suffix }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
      <input type="number" min="0" step={step} value={value ?? ""} placeholder="0" onChange={e => onChange(e.target.value)}
        style={{ width, textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 7px", outline: "none", fontFamily: "var(--ff-body)" }} />
      {suffix && <span style={{ fontSize: 11, color: "var(--text3)" }}>{suffix}</span>}
    </span>
  );
}

// ─── FICHE INGRÉDIENT (consultation ET édition WYSIWYG in-place) ─────────────
// Page publique /admin/ingredients/{id}. L'admin bascule la MÊME page en édition :
// chaque élément affiché devient éditable à sa place (photo, titre, catégorie,
// frise, nutrition, poids…). `autoEdit` ouvre directement en édition (ingrédient
// fraîchement créé). Annuler un ingrédient neuf jamais nommé le supprime.
export function IngredientDetail({ ingredient, ingredientDB, categories = DEFAULT_CATEGORIES, isAdmin, autoEdit = false, onBack, onSave, onCancelNew, onDelete }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  const startEdit = () => {
    setDraft({
      ...ingredient,
      nutrition: ingredient.nutrition ? { ...ingredient.nutrition } : null,
      tips: Array.isArray(ingredient.tips) ? ingredient.tips.map(t => ({ ...t })) : [],
      aliases: Array.isArray(ingredient.aliases) ? [...ingredient.aliases] : [],
      months: Array.isArray(ingredient.months) ? [...ingredient.months] : undefined,
    });
    setEditing(true);
  };
  useEffect(() => { if (autoEdit && ingredient && !editing) startEdit(); /* eslint-disable-next-line */ }, [autoEdit, ingredient?.id]);

  if (!ingredient) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🥕</div>
        <p style={{ color: "var(--text2)", fontSize: 14 }}>Cet ingrédient n'existe pas (ou plus) dans la base.</p>
        <button className="btn btn-primary" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="back" size={15} color="#fff" /> Retour aux ingrédients</button>
      </div>
    );
  }

  const CARD = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };
  const up = (patch) => setDraft(p => ({ ...p, ...patch }));
  const setNut = (k, v) => up({ nutrition: { ...(draft.nutrition || {}), isVegetable: isFruitVeg(draft.category), [k]: v === "" ? undefined : +v } });
  const save = () => { onSave?.(draft); setEditing(false); setDraft(null); };
  const cancel = () => { onCancelNew?.(ingredient); setEditing(false); setDraft(null); };

  // Source effective (draft en édition → aperçu live du Nutri-Score et du donut).
  const src = editing ? draft : ingredient;
  const cat = categories[src.category] || DEFAULT_CATEGORIES.other;
  const n = src.nutrition || {};
  const effDB = editing ? [...ingredientDB.filter(d => d.id !== src.id), src] : ingredientDB;
  const { letter } = computeNutriInfo([{ dbId: src.id, amount: 100, unit: "g" }], effDB);
  const kcal = Math.round(n.calories || 0);
  const kj = Math.round((n.calories || 0) * 4.184);
  const aliases = Array.isArray(src.aliases) ? src.aliases : [];

  const macroSegs = [
    { key: "protein", label: "Protéines", color: MACRO_COLORS.protein, value: (n.protein || 0) * 4, grams: n.protein || 0 },
    { key: "carbs", label: "Glucides", color: MACRO_COLORS.carbs, value: (n.carbs || 0) * 4, grams: n.carbs || 0 },
    { key: "fat", label: "Lipides", color: MACRO_COLORS.fat, value: (n.fat || 0) * 9, grams: n.fat || 0 },
  ];
  const macroTot = macroSegs.reduce((s, x) => s + x.value, 0) || 1;
  const fmt = v => v == null ? "–" : `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10} g`;
  const riPct = (key, v) => NUTRI_RI[key] ? Math.round((v || 0) / NUTRI_RI[key] * 100) : null;
  const detailRows = [
    { key: "saturatedFat", label: "Acides gras saturés", color: "#c8581f" },
    { key: "sugar", label: "Sucres", color: "#d99a10" },
    { key: "omega3", label: "Oméga-3", color: "#2f9e6f", step: 0.01 },
    { key: "fiber", label: "Fibres", color: "#7bb661" },
    { key: "salt", label: "Sel", color: "#9aa0a6", step: 0.01 },
  ];
  const hasNutrition = !!ingredient.nutrition;
  const seasonalCat = SEASONAL_CATEGORIES.has(src.category);
  // Vue : mois dérivés (ingredientMonths). Édition : tableau brut du draft.
  const dispMonths = editing ? draft.months : ingredientMonths(ingredient);
  const monthsSet = new Set(dispMonths || []);
  const toggleMonth = (m) => { const s = new Set(draft.months || []); s.has(m) ? s.delete(m) : s.add(m); const arr = [...s].sort((a, b) => a - b); up({ months: arr.length ? arr : undefined }); };

  return (
    <div key={ingredient.id} className="editor-enter" style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "16px 20px 48px" }}>

        {/* Barre haute */}
        <div className="slide-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, animationDelay: "0.04s" }}>
          {editing ? (
            <>
              <button onClick={cancel} className="pressable" style={{ display: "inline-flex", alignItems: "center", height: 40, padding: "0 16px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--text2)" }}>Annuler</button>
              <button onClick={save} className="pressable" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 40, padding: "0 20px", borderRadius: 999, background: "var(--accent)", border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#fff", boxShadow: "0 6px 16px -8px rgba(232,112,58,0.8)" }}>
                <Icon name="check" size={16} color="#fff" /> Enregistrer
              </button>
            </>
          ) : (
            <>
              <button onClick={onBack} className="pressable" aria-label="Retour" style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", cursor: "pointer", color: "var(--text2)" }}>
                <Icon name="back" size={18} color="currentColor" />
              </button>
              {isAdmin ? (
                <div style={{ display: "flex", gap: 9 }}>
                  <button onClick={startEdit} className="pressable" style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 40, padding: "0 17px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--text2)" }}>
                    <Icon name="edit" size={15} color="currentColor" /> Modifier
                  </button>
                  <button onClick={onDelete} className="pressable" aria-label="Supprimer" style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.3)", cursor: "pointer", color: "var(--red)" }}>
                    <Icon name="trash" size={16} color="var(--red)" />
                  </button>
                </div>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", height: 40, fontSize: 10.5, color: "rgba(155,135,245,1)", fontWeight: 700, padding: "0 13px", background: "rgba(155,135,245,0.14)", border: "1px solid rgba(155,135,245,0.35)", borderRadius: 999 }}>Lecture seule</span>
              )}
            </>
          )}
        </div>

        {/* ── Carte identité (même layout en consultation et édition) ── */}
        <div className="slide-up" style={{ ...CARD, padding: 18, marginBottom: 14, animationDelay: "0.1s" }}>
          {editing && (
            <div style={{ display: "flex", gap: 6, padding: 4, background: "var(--surface2)", borderRadius: 12, marginBottom: 16 }}>
              {[["draft", "En cours", "edit"], ["validated", "Validé", "check"]].map(([val, lbl, ic]) => {
                const on = val === "validated"; const active = (draft.status === "validated" ? "validated" : "draft") === val;
                return (
                  <button key={val} onClick={() => up({ status: on ? "validated" : undefined })} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, background: active ? (on ? "var(--green)" : "var(--surface)") : "transparent", color: active ? (on ? "#fff" : "var(--text)") : "var(--text3)", boxShadow: active && !on ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                    <Icon name={ic} size={13} color="currentColor" /> {lbl}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {editing
              ? <RoundImageUpload value={draft.image} onChange={v => up({ image: v })} size={82} />
              : <div style={{ flexShrink: 0, borderRadius: "50%", boxShadow: "0 4px 14px -6px rgba(0,0,0,0.25)" }}><IngImage src={ingredient.image} alt={ingredient.name} size={82} /></div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing ? (
                <input value={draft.name} onChange={e => up({ name: e.target.value })} placeholder="Nom de l'ingrédient" autoFocus={!draft.name}
                  style={{ width: "100%", fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--text)", background: "transparent", border: "none", borderBottom: "2px solid var(--accent)", padding: "0 0 3px", marginBottom: 9, outline: "none" }} />
              ) : (
                <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 25, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 8 }}>{ingredient.name}</h1>
              )}
              {editing ? (
                <select value={draft.category || "other"} onChange={e => up({ category: e.target.value })}
                  style={{ appearance: "none", WebkitAppearance: "none", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 999, padding: "5px 30px 5px 12px", fontSize: 12, fontWeight: 600, color: "var(--text2)", cursor: "pointer", backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239a9088' stroke-width='2.5' stroke-linecap='round'><path d='M6 9l6 6 6-6'/></svg>\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 11px center" }}>
                  {sortedCategoryEntries(categories).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              ) : (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>
                  <span>{cat.icon}</span> {cat.label}
                </div>
              )}
              {editing ? (
                <div style={{ marginTop: 10 }}>
                  <TagInput tags={draft.aliases || []} onChange={v => up({ aliases: v })} allTags={[]} label="" placeholder="Autres noms (ciboule, cébette…)" inputId="ing-aliases" commitOnBlur dedupeInsensitive />
                </div>
              ) : aliases.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>Aussi : {aliases.join(", ")}</div>
              )}
            </div>
            <div style={{ flexShrink: 0 }}><NutriScoreBadge letter={letter} /></div>
          </div>

          {/* Poids d'une pièce — éditable en place */}
          {editing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text2)", background: "var(--surface2)", borderRadius: 999, padding: "6px 13px", marginTop: 14, width: "fit-content" }}>
              <Icon name="portions" size={14} color="var(--accent)" /> 1 pièce ≈
              <input type="number" min="0" step="1" value={draft.gramsPerPiece ?? ""} placeholder="—" onChange={e => up({ gramsPerPiece: e.target.value === "" ? undefined : +e.target.value })}
                style={{ width: 50, textAlign: "right", fontSize: 12, fontWeight: 700, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 7, padding: "2px 6px", outline: "none" }} /> g
            </div>
          ) : ingredient.gramsPerPiece != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text2)", background: "var(--surface2)", borderRadius: 999, padding: "6px 13px", marginTop: 14, width: "fit-content" }}>
              <Icon name="portions" size={14} color="var(--accent)" /> 1 pièce ≈ <strong>{ingredient.gramsPerPiece} g</strong>
            </div>
          )}

          {/* Description (accroche) — visible/éditable seulement en édition */}
          {editing && (
            <textarea value={draft.description || ""} onChange={e => up({ description: e.target.value })} rows={2} maxLength={280} placeholder="Accroche « ingrédient du moment » (optionnel)…"
              style={{ width: "100%", marginTop: 12, fontSize: 12.5, color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "9px 11px", resize: "vertical", minHeight: 44, outline: "none", fontFamily: "var(--ff-body)" }} />
          )}
        </div>

        {/* ── Saisonnalité (frise éditable en place) ── */}
        {(seasonalCat || (!editing && monthsSet.size > 0)) && (
          <div className="slide-up" style={{ ...CARD, padding: "14px 16px", marginBottom: 14, animationDelay: "0.16s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(232,146,10,0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="calendar" size={15} color="#e8920a" /></span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Saisonnalité</span>
              </div>
              {editing
                ? (monthsSet.size > 0 && <button onClick={() => up({ months: undefined })} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>Effacer</button>)
                : isIngredientInSeason(ingredient)
                  ? <SeasonBadge />
                  : <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 20, padding: "3px 11px", background: "var(--surface2)", border: "1px solid var(--border)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text3)" }}>Hors saison</span>}
            </div>
            <SeasonBar months={dispMonths} onToggle={editing ? toggleMonth : undefined} />
            {editing && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 9 }}>{monthsSet.size === 0 ? "Touche un mois pour le marquer « de saison » (aucun = toute l'année)." : `De saison : ${formatMonths([...monthsSet])}.`}</div>}
          </div>
        )}

        {/* ── Valeurs nutritionnelles (éditables en place) ── */}
        <div className="slide-up" style={{ animationDelay: "0.2s" }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, margin: "18px 0 12px" }}>Valeurs nutritionnelles <span style={{ fontSize: 12, fontFamily: "var(--ff-body)", color: "var(--text3)", fontWeight: 400 }}>· pour 100 g</span></div>

          {(editing || hasNutrition) ? (
            <>
              <div style={{ ...CARD, display: "flex", alignItems: "center", gap: 18, padding: 18, marginBottom: 12 }}>
                <Donut size={128} stroke={17} segments={macroSegs} centerLabel={kcal} centerSub="kcal" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                  {editing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12.5, flex: 1, fontWeight: 600 }}>Énergie</span>
                      <NumField value={n.calories} step={1} width={62} suffix="kcal" onChange={v => setNut("calories", v)} />
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{kj.toLocaleString("fr-FR")} kJ pour 100 g</div>
                  )}
                  {macroSegs.map(seg => (
                    <div key={seg.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, flex: 1 }}>{seg.label}</span>
                      {editing
                        ? <NumField value={n[seg.key]} suffix="g" onChange={v => setNut(seg.key, v)} />
                        : <>
                          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{fmt(seg.grams)}</span>
                          <span style={{ fontSize: 11, color: "var(--text3)", width: 34, textAlign: "right" }}>{Math.round(seg.value / macroTot * 100)}%</span>
                        </>}
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => setDetailOpen(o => !o)} aria-expanded={detailOpen} className="ing-hover"
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, cursor: "pointer", color: "var(--text2)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 600 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--surface2)", display: "grid", placeItems: "center" }}><Icon name="fileText" size={14} color="var(--text3)" /></span> Détail par nutriment
                </span>
                <span style={{ display: "inline-flex", transition: "transform 0.2s ease", transform: detailOpen ? "rotate(90deg)" : "rotate(0deg)" }}><Icon name="forward" size={16} color="var(--text3)" /></span>
              </button>
              {detailOpen && (
                <div style={{ ...CARD, padding: "16px 16px 14px", marginTop: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: editing ? 11 : 12 }}>
                    {detailRows.map(row => {
                      const pct = riPct(row.key, n[row.key]);
                      return (
                        <div key={row.key}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: editing ? 0 : 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text2)" }}>{row.label}</span>
                            {editing
                              ? <NumField value={n[row.key]} step={row.step || 0.1} suffix="g" onChange={v => setNut(row.key, v)} />
                              : <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(n[row.key])}</span>
                                {pct != null && <span style={{ fontSize: 10, color: "var(--text3)", minWidth: 46, textAlign: "right" }}>{pct}% AJR</span>}
                              </span>}
                          </div>
                          {!editing && (
                            <div style={{ height: 6, borderRadius: 3, background: "var(--surface2)", overflow: "hidden", marginTop: 4 }}>
                              <div style={{ width: `${Math.min(100, pct || 0)}%`, height: "100%", borderRadius: 3, background: row.color, transition: "width 0.4s ease" }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {!editing && <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "center", marginTop: 14 }}>% AJR = apports journaliers recommandés (régime de référence 2000 kcal)</div>}
                </div>
              )}
            </>
          ) : (
            <div style={{ ...CARD, fontSize: 13, color: "var(--text3)", fontStyle: "italic", padding: "18px 16px", textAlign: "center" }}>Aucune donnée nutritionnelle renseignée pour cet ingrédient.</div>
          )}
        </div>

        {/* ── Tips ── */}
        {editing ? (
          <div className="slide-up" style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500 }}>Tips utiles</div>
              <button onClick={() => up({ tips: [...(draft.tips || []), { type: "prep", text: "" }] })} className="pressable" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--accent)", background: "rgba(232,112,58,0.1)", border: "1px solid rgba(232,112,58,0.28)", borderRadius: 999, padding: "5px 12px", cursor: "pointer" }}>
                <Icon name="plus" size={13} color="var(--accent)" /> Ajouter
              </button>
            </div>
            {(draft.tips || []).length === 0 && <div style={{ fontSize: 12.5, color: "var(--text3)", fontStyle: "italic", padding: "8px 2px" }}>Aucun conseil. Préparation, choix, utilisation ou anti-gaspi.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(draft.tips || []).map((tip, idx) => (
                <div key={idx} style={{ ...CARD, padding: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <select value={tip.type} onChange={e => up({ tips: draft.tips.map((t, i) => i === idx ? { ...t, type: e.target.value } : t) })}
                    style={{ width: 130, flexShrink: 0, appearance: "none", WebkitAppearance: "none", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9, padding: "7px 9px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
                    {Object.entries(TIP_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                  <textarea rows={2} placeholder="Conseil utile…" value={tip.text} onChange={e => up({ tips: draft.tips.map((t, i) => i === idx ? { ...t, text: e.target.value } : t) })}
                    style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9, padding: "7px 11px", fontSize: 12.5, color: "var(--text)", resize: "vertical", minHeight: 40, outline: "none", fontFamily: "var(--ff-body)" }} />
                  <button onClick={() => up({ tips: draft.tips.filter((_, i) => i !== idx) })} aria-label="Supprimer" style={{ flexShrink: 0, marginTop: 5, background: "none", border: "none", cursor: "pointer", color: "var(--red)" }}><Icon name="trash" size={15} color="var(--red)" /></button>
                </div>
              ))}
            </div>
          </div>
        ) : Array.isArray(ingredient.tips) && ingredient.tips.length > 0 && (
          <div className="slide-up" style={{ animationDelay: "0.26s" }}>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, margin: "28px 0 12px" }}>Tips utiles</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...ingredient.tips].sort((a, b) => TIP_ORDER.indexOf(a.type) - TIP_ORDER.indexOf(b.type)).map((tip, i) => {
                const t = TIP_TYPES[tip.type] || TIP_TYPES.prep;
                return (
                  <div key={i} style={{ ...CARD, display: "flex", gap: 13, padding: "13px 15px", alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 11, background: t.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{t.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: t.color, marginBottom: 3, letterSpacing: "0.01em" }}>{t.label}</div>
                      <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>{tip.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Source Ciqual (consultation uniquement) */}
        {!editing && (
          <a className="slide-up ing-hover" href="https://ciqual.anses.fr/" target="_blank" rel="noopener noreferrer"
            style={{ ...CARD, display: "flex", alignItems: "center", gap: 12, marginTop: 28, padding: "12px 14px", textDecoration: "none", animationDelay: "0.32s" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1a8a3c,#4caf7d)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(26,138,60,0.35)" }}>
              <Icon name="leaf" size={16} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", letterSpacing: "0.01em" }}>Ciqual 2025</div>
              <div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.4, marginTop: 1 }}>Table de composition nutritionnelle · Anses</div>
            </div>
            <Icon name="externalLink" size={13} color="var(--text3)" />
          </a>
        )}
      </div>
    </div>
  );
}
