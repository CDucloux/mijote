import { useState, useRef, useEffect } from "react";
import { Icon } from "./Icon.jsx";

// Sélecteur de section/groupe compact pour l'éditeur : rattache une ligne
// (ingrédient ou étape) à une section nommée (« Pour la pâte »…). Affiche une
// pastille cliquable ; le menu liste les sections existantes + création d'une
// nouvelle + « Aucune ». Popover fermé au clic extérieur.
export function GroupSelect({ value, groups = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (rootRef.current && !rootRef.current.contains(e.target)) { setOpen(false); setCreating(false); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  const pick = (g) => { onChange(g); setOpen(false); setCreating(false); setDraft(""); };
  const submit = () => { const t = draft.trim(); if (t) pick(t); };
  const others = groups.filter(g => g !== value);

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, maxWidth: 150, height: 28, padding: "0 10px", borderRadius: 999, cursor: "pointer",
          border: value ? "1px solid rgba(232,112,58,0.4)" : "1px dashed var(--border)",
          background: value ? "rgba(232,112,58,0.1)" : "var(--surface2)",
          color: value ? "var(--accent)" : "var(--text3)", fontSize: 11.5, fontWeight: 600 }}>
        <Icon name={value ? "layers" : "plus"} size={12} color={value ? "var(--accent)" : "var(--text3)"} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || "Section"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, minWidth: 190, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px -8px rgba(0,0,0,0.25)", padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
          {value && (
            <button type="button" onClick={() => pick("")} style={rowStyle("var(--text2)")}>
              <Icon name="close" size={13} color="var(--text3)" /> Aucune section
            </button>
          )}
          {others.map(g => (
            <button type="button" key={g} onClick={() => pick(g)} style={rowStyle("var(--text)")}>
              <Icon name="layers" size={13} color="var(--accent)" /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g}</span>
            </button>
          ))}
          {creating ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px" }}>
              <input ref={inputRef} className="field-input" value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") setCreating(false); }}
                placeholder="Nom de la section" style={{ marginBottom: 0, flex: 1, minWidth: 0, height: 32, fontSize: 12.5 }} />
              <button type="button" onClick={submit} disabled={!draft.trim()} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: draft.trim() ? "pointer" : "default", opacity: draft.trim() ? 1 : 0.5, display: "grid", placeItems: "center" }}><Icon name="check" size={14} color="#fff" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => { setCreating(true); setDraft(""); }} style={rowStyle("var(--accent)")}>
              <Icon name="plus" size={13} color="var(--accent)" /> Nouvelle section…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const rowStyle = (color) => ({ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color, textAlign: "left" });
