import { useState, useRef, useEffect } from "react";
import { Icon } from "./Icon.jsx";

// Menu « trois points » des actions secondaires d'une recette (hero).
// items : [{ label, icon, onClick, danger }]. Se ferme au clic extérieur / Échap.
export function HeroMenu({ items, btnStyle, iconColor = "#fff", iconSize = 16 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={btnStyle} title="Plus d'actions">
        <Icon name="more" size={iconSize} color={iconColor} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50,
          minWidth: 190, background: "var(--surface)", borderRadius: 12,
          border: "1px solid var(--border)", boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          padding: 6, display: "flex", flexDirection: "column", gap: 2,
        }}>
          {items.map((it, i) => (
            <button key={i} onClick={() => { setOpen(false); it.onClick(); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 11px",
                borderRadius: 8, background: "none", border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 500, textAlign: "left", width: "100%",
                color: it.danger ? "var(--red)" : "var(--text)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = it.danger ? "rgba(224,82,82,0.1)" : "var(--surface2)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <Icon name={it.icon} size={16} color={it.danger ? "var(--red)" : "var(--text2)"} />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
