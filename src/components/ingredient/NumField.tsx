interface NumFieldProps {
  value: number | undefined;
  /** Valeur brute du champ (`""` quand il est vidé). */
  onChange: (value: string) => void;
  step?: number;
  width?: number;
  suffix?: string;
}

/** Champ nombre éditable inline, aligné à droite façon valeur affichée. */
export function NumField({ value, onChange, step = 0.1, width = 62, suffix }: NumFieldProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
      <input type="number" min="0" step={step} value={value ?? ""} placeholder="0" onChange={e => onChange(e.target.value)}
        style={{ width, textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 7px", outline: "none", fontFamily: "var(--ff-body)" }} />
      {suffix && <span style={{ fontSize: 11, color: "var(--text3)" }}>{suffix}</span>}
    </span>
  );
}
