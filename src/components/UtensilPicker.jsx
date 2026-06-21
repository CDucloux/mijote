import { useState } from "react";
import { Icon } from "./Icon.jsx";

export function UtensilPicker({ utensilDB, selected, onChange }) {
  const [search, setSearch] = useState("");
  const selectedIds = new Set(selected.map(u => u.dbId));

  const toggle = (d) => {
    if (selectedIds.has(d.id)) {
      onChange(selected.filter(u => u.dbId !== d.id));
    } else {
      onChange([...selected, { id: "u" + Date.now(), dbId: d.id, name: d.name }]);
    }
  };

  const filtered = utensilDB.filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minWidth: "100%", scrollSnapAlign: "start", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div style={{ padding: "14px 16px 0", display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
          {selected.map(u => {
            const db = utensilDB.find(d => d.id === u.dbId);
            return (
              <div key={u.id} className="slide-up" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 10px 5px 5px", borderRadius: 30, background: "rgba(232,112,58,0.12)", border: "1px solid rgba(232,112,58,0.35)" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {db?.image
                    ? <img src={db.image} alt={u.name} style={{ width: "82%", height: "82%", objectFit: "contain" }} referrerPolicy="no-referrer" loading="lazy" />
                    : <Icon name="photo" size={12} color="#b3afaa" />}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{u.name}</span>
                <button onClick={() => toggle({ id: u.dbId, name: u.name })} style={{ display: "flex", alignItems: "center", opacity: 0.7 }}>
                  <Icon name="close" size={12} color="var(--accent)" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div style={{ padding: "12px 16px 8px", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
            <Icon name="search" size={14} color="var(--text3)" />
          </div>
          <input
            className="field-input"
            placeholder="Rechercher un ustensile…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "32px 0" }}>Aucun ustensile trouvé</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {filtered.map(d => {
              const on = selectedIds.has(d.id);
              return (
                <button key={d.id} onClick={() => toggle(d)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  padding: "14px 8px 10px",
                  borderRadius: 14,
                  background: on ? "rgba(232,112,58,0.1)" : "var(--surface)",
                  border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
                  cursor: "pointer", position: "relative", transition: "all 0.15s",
                }}>
                  {on && (
                    <div style={{ position: "absolute", top: 7, right: 7, width: 18, height: 18, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="check" size={10} color="#fff" />
                    </div>
                  )}
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(0,0,0,0.06)" }}>
                    {d.image
                      ? <img src={d.image} alt={d.name} style={{ width: "82%", height: "82%", objectFit: "contain" }} referrerPolicy="no-referrer" loading="lazy" />
                      : <Icon name="photo" size={22} color="#b3afaa" />}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: on ? "var(--accent)" : "var(--text2)", textAlign: "center", lineHeight: 1.3, wordBreak: "break-word" }}>{d.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
