import { useState, useMemo } from "react";
import { Icon } from "./Icon.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { IngImage } from "./Img.jsx";
import { cuisineEmoji } from "../constants/cuisines.js";
import { RECIPE_CATEGORIES } from "../constants/recipeCategories.js";
import { DIFFICULTY_LABEL, difficultyColor } from "../lib/difficulty.js";
import { DEFAULT_FILTERS, activeFilterCount } from "../lib/recipeFilters.js";
import { COOKING_METHODS } from "../lib/cooking.js";
import { normalizeStr } from "../lib/parseIngredient.js";

const COOKING_EMOJI = { four: "🔥", airfryer: "🌀", plaques: "🍳", vapeur: "♨️", grill: "🍢", "micro-ondes": "📡" };

// ─── FILTRES AVANCÉS (feuille, sections repliables façon « Mob ») ──────────────
const NUTRI = { A: "#178a3a", B: "#7db52a", C: "#f2c230", D: "#ef8b26", E: "#e5462f" };
const SORT_LABEL = { name: "A → Z", health: "Santé", date: "Récent" };
const TIME_LABEL = { 20: "≤ 20 min", 30: "≤ 30 min", 60: "≤ 1 h" };

// Section repliable : titre + résumé (quand fermée) + chevron.
function Group({ title, summary, defaultOpen = true, first = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: first ? "none" : "1px solid var(--border)", padding: first ? "3px 0 15px" : "15px 0" }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{title}</span>
        {!open && summary && <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{summary}</span>}
        <span style={{ marginLeft: (!open && summary) ? 8 : "auto", display: "inline-flex", transition: "transform 0.2s ease", transform: open ? "rotate(180deg)" : "none" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>
      {open && <div style={{ marginTop: 13 }}>{children}</div>}
    </div>
  );
}

// Puce (toggle) générique.
function Chip({ on, onClick, color, children }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
      padding: "8px 14px", borderRadius: 22, fontSize: 12.5, fontWeight: 500, cursor: "pointer",
      background: on ? (color ? `${color}22` : "rgba(232,112,58,0.16)") : "var(--surface2)",
      color: on ? (color || "var(--accent)") : "var(--text2)",
      border: `1px solid ${on ? (color ? `${color}88` : "rgba(232,112,58,0.5)") : "var(--border)"}`,
    }}>{children}</button>
  );
}
const Row = ({ children }) => <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>;

// Sélection d'ingrédients (multi) avec vignettes.
function IngredientPicker({ ingredientDB, selected, setFilters }) {
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(ingredientDB.map(i => [i.id, i])), [ingredientDB]);
  const toggle = (id) => setFilters(f => ({
    ...f, ingredients: f.ingredients.includes(id) ? f.ingredients.filter(x => x !== id) : [...f.ingredients, id],
  }));
  const matches = useMemo(() => {
    const nq = normalizeStr(q.trim());
    if (!nq) return [];
    return ingredientDB
      .filter(i => !selected.includes(i.id) && normalizeStr(i.name).includes(nq))
      .slice(0, 8);
  }, [q, ingredientDB, selected]);

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 11 }}>
          {selected.map(id => {
            const ing = byId.get(id);
            if (!ing) return null;
            return (
              <button key={id} onClick={() => toggle(id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px 5px 5px", borderRadius: 20, fontSize: 12.5, fontWeight: 500, cursor: "pointer", background: "rgba(232,112,58,0.16)", color: "var(--accent)", border: "1px solid rgba(232,112,58,0.5)" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", background: "var(--surface)", display: "grid", placeItems: "center", flexShrink: 0 }}><IngImage src={ing.image} alt={ing.name} size={22} /></span>
                {ing.name}
                <Icon name="close" size={12} color="var(--accent)" />
              </button>
            );
          })}
        </div>
      )}
      <input className="field-input" placeholder="Rechercher un ingrédient…" value={q} onChange={e => setQ(e.target.value)} />
      {matches.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
          {matches.map(ing => (
            <button key={ing.id} onClick={() => { toggle(ing.id); setQ(""); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "7px 8px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0 }}><IngImage src={ing.image} alt={ing.name} size={30} /></span>
              <span style={{ fontSize: 13.5, color: "var(--text)" }}>{ing.name}</span>
              <span style={{ marginLeft: "auto", display: "inline-flex" }}><Icon name="plus" size={15} color="var(--text3)" /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecipeFilterSheet({ filters, setFilters, sortBy, setSortBy, usedCuisines = [], ingredientDB = [], resultCount = 0, onClose, onSaveAsCarnet, alreadySaved = false, updatingCarnetName = null }) {
  const set = (patch) => setFilters(f => ({ ...f, ...patch }));
  const toggleCuisine = (label) => setFilters(f => ({
    ...f, cuisines: f.cuisines.includes(label) ? f.cuisines.filter(c => c !== label) : [...f.cuisines, label],
  }));
  const toggleCooking = (id) => setFilters(f => ({
    ...f, cooking: f.cooking.includes(id) ? f.cooking.filter(c => c !== id) : [...f.cooking, id],
  }));
  const toggleCategory = (id) => setFilters(f => ({
    ...f, categories: (f.categories || []).includes(id) ? f.categories.filter(c => c !== id) : [...(f.categories || []), id],
  }));
  const reset = () => setFilters({ ...DEFAULT_FILTERS });
  const nActive = activeFilterCount(filters);
  const typeSummary = filters.type === "dish" ? "Plats" : filters.type === "base" ? "Préparations de base" : null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* En-tête — collant en haut de la feuille, fond opaque couvrant la bande de
          padding du haut pour qu'aucun contenu ne transparaisse pendant le défilement */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", margin: "0 -20px 10px", padding: "18px 20px 12px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, margin: 0, lineHeight: 1 }}>Tous les filtres</h2>
        {nActive > 0 && <button onClick={reset} style={{ alignSelf: "center", background: "none", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, lineHeight: 1 }}>Réinitialiser</button>}
        <button onClick={onClose} aria-label="Fermer" style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: "50%", background: "var(--surface2)", border: "none", display: "grid", placeItems: "center", cursor: "pointer" }}><Icon name="close" size={15} color="var(--text2)" /></button>
      </div>

      {/* Trier — présent seulement là où le tri vit dans le panneau de filtres
          (ex. recettes publiques). Sur /recipes, le tri a sa propre feuille. */}
      {setSortBy && (
        <Group title="Trier par" summary={SORT_LABEL[sortBy]} first>
          <Row>
            {["name", "health", "date"].map(s => (
              <Chip key={s} on={sortBy === s} onClick={() => setSortBy(s)}>{SORT_LABEL[s]}</Chip>
            ))}
          </Row>
        </Group>
      )}

      {/* Type de recette (rôle dans le repas) */}
      <Group title="Type de recette" first={!setSortBy} defaultOpen={false} summary={filters.categories?.length ? `${filters.categories.length} sélectionné${filters.categories.length > 1 ? "s" : ""}` : null}>
        <Row>
          {RECIPE_CATEGORIES.map(c => (
            <Chip key={c.id} on={(filters.categories || []).includes(c.id)} onClick={() => toggleCategory(c.id)}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>{c.emoji}</span> {c.label}
            </Chip>
          ))}
        </Row>
      </Group>

      {/* Nature (plat vs préparation de base) */}
      <Group title="Nature" summary={typeSummary}>
        <Row>
          {[["all", "Toutes", false], ["dish", "Plats", false], ["base", "Préparations de base", true]].map(([val, label, isBase]) => (
            <Chip key={val} on={filters.type === val} onClick={() => set({ type: val })}>
              {isBase && <BaseIcon size={12} color={filters.type === val ? "var(--accent)" : "var(--text3)"} />}{label}
            </Chip>
          ))}
        </Row>
      </Group>

      {/* Temps */}
      <Group title="Temps total" summary={filters.timeMax ? TIME_LABEL[filters.timeMax] : null}>
        <Row>
          {[20, 30, 60].map(t => (
            <Chip key={t} on={filters.timeMax === t} onClick={() => set({ timeMax: filters.timeMax === t ? null : t })}>
              <Icon name="clock" size={13} color={filters.timeMax === t ? "var(--accent)" : "var(--text3)"} /> {TIME_LABEL[t]}
            </Chip>
          ))}
        </Row>
      </Group>

      {/* Régime & saison */}
      <Group title="Régime & saison" summary={[filters.vegan && "Vegan", filters.season && "De saison"].filter(Boolean).join(", ") || null}>
        <Row>
          <Chip on={filters.vegan} onClick={() => set({ vegan: !filters.vegan })} color="#4caf7d"><Icon name="leaf" size={13} color={filters.vegan ? "#4caf7d" : "var(--text3)"} /> Vegan</Chip>
          <Chip on={filters.season} onClick={() => set({ season: !filters.season })} color="#e8920a"><Icon name="sun" size={13} color={filters.season ? "#e8920a" : "var(--text3)"} /> De saison</Chip>
        </Row>
      </Group>

      {/* Cuisine */}
      {usedCuisines.length > 0 && (
        <Group title="Cuisine" defaultOpen={false} summary={filters.cuisines.length ? `${filters.cuisines.length} sélectionnée${filters.cuisines.length > 1 ? "s" : ""}` : null}>
          <Row>
            {usedCuisines.map(c => (
              <Chip key={c.label} on={filters.cuisines.includes(c.label)} onClick={() => toggleCuisine(c.label)}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>{cuisineEmoji(c.label)}</span> {c.label}
              </Chip>
            ))}
          </Row>
        </Group>
      )}

      {/* Mode de cuisson (déduit des ustensiles) */}
      <Group title="Mode de cuisson" defaultOpen={false} summary={filters.cooking.length ? `${filters.cooking.length} sélectionné${filters.cooking.length > 1 ? "s" : ""}` : null}>
        <Row>
          {COOKING_METHODS.map(m => (
            <Chip key={m.id} on={filters.cooking.includes(m.id)} onClick={() => toggleCooking(m.id)}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>{COOKING_EMOJI[m.id]}</span> {m.label}
            </Chip>
          ))}
          <Chip on={filters.cooking.includes("mixte")} onClick={() => toggleCooking("mixte")}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>🔀</span> Mixte
          </Chip>
        </Row>
        <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 9 }}>D'après les ustensiles de la recette. « Mixte » = plusieurs modes.</div>
      </Group>

      {/* Nutri-Score */}
      <Group title="Nutri-Score" defaultOpen={false} summary={filters.nutriMax ? `${filters.nutriMax} ou mieux` : null}>
        <div style={{ display: "flex", gap: 8 }}>
          {["A", "B", "C", "D", "E"].map(l => {
            const on = filters.nutriMax === l;
            return <button key={l} onClick={() => set({ nutriMax: on ? null : l })} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", background: on ? NUTRI[l] : "var(--surface2)", color: on ? "#fff" : "var(--text3)", border: `1px solid ${on ? "transparent" : "var(--border)"}` }}>{l}</button>;
          })}
        </div>
      </Group>

      {/* Difficulté — pills libellées */}
      <Group title="Difficulté" defaultOpen={false} summary={filters.diffMax ? `jusqu'à ${DIFFICULTY_LABEL[filters.diffMax]}` : null}>
        <Row>
          {[1, 2, 3, 4, 5].map(n => {
            const on = filters.diffMax === n;
            const col = difficultyColor(n);
            return (
              <button key={n} onClick={() => set({ diffMax: on ? null : n })} style={{
                display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
                padding: "8px 13px", borderRadius: 22, fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                background: on ? `color-mix(in srgb, ${col} 16%, transparent)` : "var(--surface2)",
                color: on ? col : "var(--text2)",
                border: `1px solid ${on ? `color-mix(in srgb, ${col} 55%, transparent)` : "var(--border)"}`,
              }}>
                <span style={{ display: "inline-flex", gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i <= n ? (on ? col : "var(--text3)") : (on ? `color-mix(in srgb, ${col} 30%, transparent)` : "var(--border)") }} />
                  ))}
                </span>
                {DIFFICULTY_LABEL[n]}
              </button>
            );
          })}
        </Row>
        {filters.diffMax && <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 9 }}>Recettes jusqu'à « {DIFFICULTY_LABEL[filters.diffMax]} ».</div>}
      </Group>

      {/* Ingrédients (multi + vignettes) */}
      <Group title="Contient les ingrédients" defaultOpen={false} summary={filters.ingredients.length ? `${filters.ingredients.length} sélectionné${filters.ingredients.length > 1 ? "s" : ""}` : null}>
        <IngredientPicker ingredientDB={ingredientDB} selected={filters.ingredients} setFilters={setFilters} />
      </Group>

      {/* CTA — pied plein, sans liseré, jusqu'au bas de la feuille */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--surface)", margin: "6px -20px 0", padding: "10px 20px calc(16px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 10 }}>
        <button className="btn btn-primary" style={{ width: "100%", borderRadius: 30, padding: "14px 0", fontSize: 14.5 }} onClick={onClose}>
          Voir {resultCount} recette{resultCount > 1 ? "s" : ""}
        </button>
        {/* Enregistrer / mettre à jour la vue comme carnet (bibliothèque perso) */}
        {onSaveAsCarnet && nActive > 0 && (
          alreadySaved && !updatingCarnetName ? (
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--green)", padding: "4px 0" }}>
              <Icon name="check" size={15} color="var(--green)" /> Vue enregistrée comme carnet
            </div>
          ) : (
            <button onClick={onSaveAsCarnet} className="pressable" style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 15, background: "var(--surface2)", border: "1px solid var(--border)", cursor: "pointer", textAlign: "left" }}>
              <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(232,112,58,0.14)" }}>
                <Icon name={updatingCarnetName ? "check" : "book"} size={17} color="var(--accent)" />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{updatingCarnetName ? `Mettre à jour « ${updatingCarnetName} »` : "Enregistrer comme carnet"}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", marginTop: 1 }}>{updatingCarnetName ? "Remplacer les filtres du carnet" : "Retrouve cette sélection en un tap"}</span>
              </span>
              <Icon name="forward" size={15} color="var(--text3)" />
            </button>
          )
        )}
      </div>
    </div>
  );
}
