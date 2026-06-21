import { useState, useRef } from "react";

// ─── TAG INPUT ────────────────────────────────────────────────────────────────
export function TagInput({ tags, onChange, allTags, label = "Tags", placeholder = "Végétarien, Rapide…", inputId = "tag-input-field", commitOnBlur = false, dedupeInsensitive = false }) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef("");
  inputRef.current = input;
  const suggestions = allTags.filter(t =>
    t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t) && input.length > 0
  );

  const addTag = tag => {
    const t = tag.trim();
    if (!t) { setInput(""); return; }
    const isDup = dedupeInsensitive
      ? tags.some(x => x.localeCompare(t, undefined, { sensitivity: "base" }) === 0) // ignore casse + accents
      : tags.includes(t);
    if (!isDup) onChange([...tags, t]);
    setInput("");
  };
  const removeTag = t => onChange(tags.filter(x => x !== t));

  return (
    <div>
      {label ? <div className="field-label">{label}</div> : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", minHeight: 42, cursor: "text" }}
        onClick={() => document.getElementById(inputId).focus()}>
        {tags.map(t => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: "rgba(232,112,58,0.15)", color: "var(--accent)", border: "1px solid rgba(232,112,58,0.3)" }}>
            {t}
            <button onClick={e => { e.stopPropagation(); removeTag(t); }} style={{ fontSize: 14, lineHeight: 1, color: "var(--accent)", padding: 0 }}>×</button>
          </span>
        ))}
        <input id={inputId} value={input} onChange={e => setInput(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => { setFocused(false); if (commitOnBlur && inputRef.current.trim()) addTag(inputRef.current); }, 150)}
          onKeyDown={e => { if ((e.key === "," || e.key === "Enter") && input.trim()) { e.preventDefault(); addTag(input); } if (e.key === "Backspace" && !input && tags.length) removeTag(tags[tags.length - 1]); }}
          placeholder={tags.length === 0 ? placeholder : ""}
          style={{ border: "none", background: "none", outline: "none", fontSize: 14, color: "var(--text)", minWidth: 100, flex: 1, fontFamily: "var(--ff-body)", padding: "1px 2px" }} />
      </div>
      {focused && suggestions.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, marginTop: 4, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
          {suggestions.slice(0, 6).map(s => (
            <button key={s} onMouseDown={() => addTag(s)}
              style={{ display: "block", width: "100%", padding: "9px 14px", fontSize: 13, textAlign: "left", color: "var(--text2)" }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
