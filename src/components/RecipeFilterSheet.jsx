import { Icon } from "./Icon.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { cuisineEmoji } from "../constants/cuisines.js";
import { DIFFICULTY_LABEL, difficultyColor } from "../lib/difficulty.js";
import { DEFAULT_FILTERS, activeFilterCount } from "../lib/recipeFilters.js";

// ─── FILTRES AVANCÉS (contenu de la feuille) ──────────────────────────────────
// État `filters` : { season, vegan, type, cuisines[], nutriMax, diffMax, ingredient }.
const NUTRI = { A: "#178a3a", B: "#7db52a", C: "#f2c230", D: "#ef8b26", E: "#e5462f" };

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

// Puce générique (toggle).
function Chip({ on, onClick, color, children }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
      padding: "7px 13px", borderRadius: 20, fontSize: 12.5, fontWeight: 500, cursor: "pointer",
      background: on ? (color ? `${color}22` : "rgba(232,112,58,0.16)") : "var(--surface2)",
      color: on ? (color || "var(--accent)") : "var(--text2)",
      border: `1px solid ${on ? (color ? `${color}88` : "rgba(232,112,58,0.5)") : "var(--border)"}`,
    }}>{children}</button>
  );
}

export function RecipeFilterSheet({ filters, setFilters, usedCuisines = [], resultCount = 0, onClose }) {
  const set = (patch) => setFilters(f => ({ ...f, ...patch }));
  const toggleCuisine = (label) => setFilters(f => ({
    ...f, cuisines: f.cuisines.includes(label) ? f.cuisines.filter(c => c !== label) : [...f.cuisines, label],
  }));
  const reset = () => setFilters({ ...DEFAULT_FILTERS });
  const nActive = activeFilterCount(filters);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, margin: 0 }}>Filtres</h2>
        {nActive > 0 && <button onClick={reset} className="btn btn-ghost btn-sm" style={{ borderRadius: 20 }}>Réinitialiser ({nActive})</button>}
      </div>

      <Section title="Type de recette">
        <div style={{ display: "flex", gap: 8 }}>
          {[["all", "Toutes", null], ["dish", "Plats", null], ["base", "Préparations de base", "base"]].map(([val, label, ic]) => (
            <button key={val} onClick={() => set({ type: val })} style={{
              flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
              padding: "9px 6px", borderRadius: 12, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              background: filters.type === val ? "var(--accent)" : "var(--surface2)",
              color: filters.type === val ? "#fff" : "var(--text2)",
              border: `1px solid ${filters.type === val ? "transparent" : "var(--border)"}`,
            }}>{ic === "base" && <BaseIcon size={13} color={filters.type === val ? "#fff" : "var(--text3)"} />}{label}</button>
          ))}
        </div>
      </Section>

      <Section title="Régime & saison">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip on={filters.vegan} onClick={() => set({ vegan: !filters.vegan })} color="#4caf7d"><Icon name="leaf" size={13} color={filters.vegan ? "#4caf7d" : "var(--text3)"} /> Vegan</Chip>
          <Chip on={filters.season} onClick={() => set({ season: !filters.season })} color="#e8920a"><Icon name="sun" size={13} color={filters.season ? "#e8920a" : "var(--text3)"} /> De saison</Chip>
        </div>
      </Section>

      {usedCuisines.length > 0 && (
        <Section title="Cuisine">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {usedCuisines.map(c => (
              <Chip key={c.label} on={filters.cuisines.includes(c.label)} onClick={() => toggleCuisine(c.label)}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>{cuisineEmoji(c.label)}</span> {c.label}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      <Section title="Nutri-Score (au mieux)">
        <div style={{ display: "flex", gap: 8 }}>
          {["A", "B", "C", "D", "E"].map(l => {
            const on = filters.nutriMax === l;
            return (
              <button key={l} onClick={() => set({ nutriMax: on ? null : l })} style={{
                flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer",
                background: on ? NUTRI[l] : "var(--surface2)", color: on ? "#fff" : "var(--text3)",
                border: `1px solid ${on ? "transparent" : "var(--border)"}`,
              }}>{l}</button>
            );
          })}
        </div>
        {filters.nutriMax && <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 7 }}>Recettes notées {filters.nutriMax} ou mieux.</div>}
      </Section>

      <Section title="Difficulté (au plus)">
        <div style={{ display: "flex", gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => {
            const on = filters.diffMax === n;
            return (
              <button key={n} onClick={() => set({ diffMax: on ? null : n })} style={{
                flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                background: on ? difficultyColor(n) : "var(--surface2)", color: on ? "#fff" : "var(--text3)",
                border: `1px solid ${on ? "transparent" : "var(--border)"}`,
              }}>{n}</button>
            );
          })}
        </div>
        {filters.diffMax && <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 7 }}>Jusqu'à « {DIFFICULTY_LABEL[filters.diffMax]} ».</div>}
      </Section>

      <Section title="Contient l'ingrédient">
        <input className="field-input" placeholder="ex: courgette, feta…" value={filters.ingredient}
          onChange={e => set({ ingredient: e.target.value })} />
      </Section>

      <div style={{ position: "sticky", bottom: 0, background: "var(--surface)", paddingTop: 10, marginTop: 4 }}>
        <button className="btn btn-primary" style={{ width: "100%", borderRadius: 14, padding: "13px 0" }} onClick={onClose}>
          Voir {resultCount} recette{resultCount > 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
