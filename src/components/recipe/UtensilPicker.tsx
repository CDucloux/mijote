import { useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { UtImage } from "./StepPills.jsx";
import { UTENSIL_CATEGORIES } from "@/lib/household/dataYaml.js";
import { useElasticScroll } from "../../hooks/useElasticScroll.js";
import { useIsDesktop } from "../../hooks/useIsDesktop.js";
import type { Utensil, UtensilDbItem } from "@/lib/types.js";

// Tri « simple » (défilement au clic), cohérent avec Recettes/Découvrir.
const SORT_MODES = [
  { key: "default", label: "Ordre par défaut" },
  { key: "az", label: "A → Z" },
  { key: "selected", label: "Sélectionnés d'abord" },
];

// Grille de cartes d'ustensiles (image détourée + nom + coche si sélectionné).
// Extraite pour être réutilisée en mode plat ET en mode groupé par catégorie.
function UtensilGrid({ list, selectedIds, onGridClick }: { list: UtensilDbItem[]; selectedIds: Set<string | undefined>; onGridClick: (d: UtensilDbItem) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
      {list.map(d => {
        const on = selectedIds.has(d.id);
        return (
          <button key={d.id} onClick={() => onGridClick(d)} aria-pressed={on} className={`ripple ${on ? "hover-tint" : "hover-neutral"}`} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "14px 8px 10px",
            borderRadius: 16, border: "none",
            background: on ? "rgba(var(--accent-rgb),0.14)" : "var(--float-surface)",
            boxShadow: on ? "none" : "var(--float-shadow)",
            cursor: "pointer", position: "relative", transition: "background-color 0.15s, box-shadow 0.15s",
          }}>
            {on && (
              <div style={{ position: "absolute", top: 7, right: 7, width: 18, height: 18, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="check" size={10} color="#fff" />
              </div>
            )}
            <UtImage src={d.image} alt={d.name} size={56} radius={12} />
            <span style={{ fontSize: 11, fontWeight: 500, color: on ? "var(--accent)" : "var(--text2)", textAlign: "center", lineHeight: 1.3, wordBreak: "break-word" }}>{d.name}</span>
          </button>
        );
      })}
    </div>
  );
}

interface UtensilPickerProps {
  utensilDB: UtensilDbItem[];
  selected: Utensil[];
  onChange: (next: Utensil[]) => void;
}

export function UtensilPicker({ utensilDB, selected, onChange }: UtensilPickerProps) {
  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useElasticScroll<HTMLDivElement>({ disabled: isDesktop });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("default");
  const [replacing, setReplacing] = useState<string | null>(null); // id de l'ustensile en cours de remplacement
  const selectedIds = new Set(selected.map(u => u.dbId));
  const replacingName = replacing ? selected.find(u => u.id === replacing)?.name : "";
  const sortLabel = SORT_MODES.find(m => m.key === sortKey)?.label || SORT_MODES[0].label;
  const cycleSort = () => setSortKey(k => SORT_MODES[(SORT_MODES.findIndex(m => m.key === k) + 1) % SORT_MODES.length].key);

  const toggle = (d: { id?: string; name?: string }) => {
    if (selectedIds.has(d.id)) {
      onChange(selected.filter(u => u.dbId !== d.id));
    } else {
      onChange([...selected, { id: "u" + Date.now(), dbId: d.id, name: d.name }]);
    }
  };

  // Remplace l'ustensile en cours par `d` (dédup par dbId si le remplaçant existe déjà).
  const replaceWith = (d: { id?: string; name?: string }) => {
    const next = selected.map(u => u.id === replacing ? { ...u, dbId: d.id, name: d.name } : u);
    onChange(next.filter((u, i) => next.findIndex(x => x.dbId === u.dbId) === i));
    setReplacing(null);
    setSearch("");
  };
  const onGridClick = (d: UtensilDbItem) => (replacing ? replaceWith(d) : toggle(d));

  const filtered = utensilDB.filter(d =>
    !search || (d.name || "").toLowerCase().includes(search.toLowerCase())
  );
  const sorted = (() => {
    if (sortKey === "az") return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    if (sortKey === "selected") return [...filtered].sort((a, b) => (selectedIds.has(b.id) ? 1 : 0) - (selectedIds.has(a.id) ? 1 : 0));
    return filtered;
  })();

  return (
    <div style={{ minWidth: "100%", scrollSnapAlign: "start", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="editor-col" style={{ padding: "14px 20px 0", display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
          {selected.map(u => {
            const db = utensilDB.find(d => d.id === u.dbId);
            const active = replacing === u.id;
            return (
              <div key={u.id} className="slide-up" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 10px 5px 5px", borderRadius: 30, background: active ? "var(--accent)" : "rgba(var(--accent-rgb),0.12)", cursor: "pointer" }}
                onClick={() => setReplacing(active ? null : u.id ?? null)} title="Remplacer cet ustensile">
                <UtImage src={db?.image} alt={u.name} size={26} />
                <span style={{ fontSize: 12, fontWeight: 600, color: active ? "#fff" : "var(--accent)" }}>{u.name}</span>
                <button onClick={e => { e.stopPropagation(); if (active) setReplacing(null); toggle({ id: u.dbId, name: u.name }); }}
                  className="ing-chip-x chip-x-btn" data-on-accent={active || undefined} aria-label={`Retirer ${u.name}`} title="Retirer"
                  style={{ border: "none", padding: 0, cursor: "pointer", color: active ? "#fff" : "var(--accent)", marginRight: -4 }}>
                  <Icon name="close" size={12} color="currentColor" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Bandeau mode remplacement */}
      {replacing && (
        <div className="slide-up editor-col" style={{ marginTop: 12, padding: "0 20px", flexShrink: 0 }}>
          <div style={{ padding: "9px 12px", borderRadius: 12, background: "rgba(var(--accent-rgb),0.12)", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="swap" size={14} color="var(--accent)" />
            <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500, flex: 1 }}>
              Choisis un ustensile pour remplacer <strong>{replacingName}</strong>
            </span>
            <button onClick={() => setReplacing(null)} className="ing-chip-x chip-x-btn" aria-label="Annuler le remplacement" style={{ border: "none", padding: 0, cursor: "pointer", color: "var(--accent)" }}>
              <Icon name="close" size={13} color="currentColor" />
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="editor-col" style={{ padding: "12px 20px 8px", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
            <Icon name="search" size={16} color="var(--text3)" />
          </div>
          <input
            className="field-input recipe-search"
            placeholder="Rechercher un ustensile…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            enterKeyHint="search"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            style={{ paddingLeft: 44, paddingRight: search ? 40 : 16 }}
          />
          {search && <button onClick={() => setSearch("")} aria-label="Effacer la recherche" className="search-clear-btn" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}><Icon name="close" size={13} /></button>}
        </div>
        {/* Tri simple par défilement (pas de filtres ici) */}
        <div style={{ display: "flex", marginTop: 10 }}>
          <button className="toolbar-pill" onClick={cycleSort} title="Changer le tri">
            <Icon name="updown" size={15} color="currentColor" />
            <span style={{ color: "var(--text3)", fontWeight: 500 }}>Trié par :</span>
            <strong style={{ fontWeight: 600 }}>{sortLabel}</strong>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto" }}>
        <div ref={contentRef} className="editor-col" style={{ minHeight: "100%", padding: "4px 20px 20px" }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "32px 0" }}>Aucun ustensile trouvé</div>
        ) : sortKey === "default" ? (
          // Groupé par famille (taxonomie fixe) : plus lisible pour parcourir la base.
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(UTENSIL_CATEGORIES).map(([catKey, catLabel]) => {
              const list = sorted.filter(d => (d.category || "divers") === catKey);
              if (list.length === 0) return null;
              return (
                <div key={catKey}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", margin: "0 2px 8px", letterSpacing: "0.02em" }}>{catLabel}</div>
                  <UtensilGrid list={list} selectedIds={selectedIds} onGridClick={onGridClick} />
                </div>
              );
            })}
          </div>
        ) : (
          <UtensilGrid list={sorted} selectedIds={selectedIds} onGridClick={onGridClick} />
        )}
        </div>
      </div>
    </div>
  );
}
