import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { cuisineEmoji } from "../constants/cuisines.js";
import { DIFFICULTY_LABEL, difficultyColor } from "../lib/difficulty.js";
import { DEFAULT_FILTERS, activeFilterCount } from "../lib/recipeFilters.js";

// ─── FILTRES AVANCÉS (feuille, sections repliables façon « Mob ») ──────────────
const NUTRI = { A: "#178a3a", B: "#7db52a", C: "#f2c230", D: "#ef8b26", E: "#e5462f" };
const SORT_LABEL = { name: "A → Z", health: "Santé", date: "Récent" };
const TIME_LABEL = { 20: "≤ 20 min", 30: "≤ 30 min", 60: "≤ 1 h" };

// Section repliable : titre + résumé (quand fermée) + chevron.
function Group({ title, summary, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "15px 0" }}>
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

export function RecipeFilterSheet({ filters, setFilters, sortBy, setSortBy, usedCuisines = [], resultCount = 0, onClose }) {
  const set = (patch) => setFilters(f => ({ ...f, ...patch }));
  const toggleCuisine = (label) => setFilters(f => ({
    ...f, cuisines: f.cuisines.includes(label) ? f.cuisines.filter(c => c !== label) : [...f.cuisines, label],
  }));
  const reset = () => setFilters({ ...DEFAULT_FILTERS });
  const nActive = activeFilterCount(filters);
  const typeSummary = filters.type === "dish" ? "Plats" : filters.type === "base" ? "Préparations de base" : null;

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, margin: 0 }}>Tous les filtres</h2>
        {nActive > 0 && <button onClick={reset} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "4px 2px" }}>Réinitialiser</button>}
        <button onClick={onClose} aria-label="Fermer" style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: "50%", background: "var(--surface2)", border: "none", display: "grid", placeItems: "center", cursor: "pointer" }}><Icon name="close" size={15} color="var(--text2)" /></button>
      </div>

      {/* Trier */}
      <Group title="Trier par" summary={SORT_LABEL[sortBy]}>
        <Row>
          {["name", "health", "date"].map(s => (
            <Chip key={s} on={sortBy === s} onClick={() => setSortBy(s)}>{SORT_LABEL[s]}</Chip>
          ))}
        </Row>
      </Group>

      {/* Type */}
      <Group title="Type de recette" summary={typeSummary}>
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

      {/* Nutri-Score */}
      <Group title="Nutri-Score" defaultOpen={false} summary={filters.nutriMax ? `${filters.nutriMax} ou mieux` : null}>
        <div style={{ display: "flex", gap: 8 }}>
          {["A", "B", "C", "D", "E"].map(l => {
            const on = filters.nutriMax === l;
            return <button key={l} onClick={() => set({ nutriMax: on ? null : l })} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", background: on ? NUTRI[l] : "var(--surface2)", color: on ? "#fff" : "var(--text3)", border: `1px solid ${on ? "transparent" : "var(--border)"}` }}>{l}</button>;
          })}
        </div>
      </Group>

      {/* Difficulté */}
      <Group title="Difficulté" defaultOpen={false} summary={filters.diffMax ? `jusqu'à ${DIFFICULTY_LABEL[filters.diffMax]}` : null}>
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => {
            const on = filters.diffMax === n;
            return <button key={n} onClick={() => set({ diffMax: on ? null : n })} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", background: on ? difficultyColor(n) : "var(--surface2)", color: on ? "#fff" : "var(--text3)", border: `1px solid ${on ? "transparent" : "var(--border)"}` }}>{n}</button>;
          })}
        </div>
        {filters.diffMax && <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 8 }}>Jusqu'à « {DIFFICULTY_LABEL[filters.diffMax]} ».</div>}
      </Group>

      {/* Ingrédient */}
      <Group title="Contient l'ingrédient" defaultOpen={false} summary={filters.ingredient.trim() || null}>
        <input className="field-input" placeholder="ex: courgette, feta…" value={filters.ingredient} onChange={e => set({ ingredient: e.target.value })} />
      </Group>

      {/* CTA sticky */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--surface)", paddingTop: 12, marginTop: 6, borderTop: "1px solid var(--border)" }}>
        <button className="btn btn-primary" style={{ width: "100%", borderRadius: 30, padding: "14px 0", fontSize: 14.5 }} onClick={onClose}>
          Voir {resultCount} recette{resultCount > 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
