import type { ReactNode } from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  label?: ReactNode;
  title?: string;
}

/**
 * Interrupteur animé (piste + pastille glissante) : remplace un bouton plain là où
 * l'état est un vrai on/off. La pastille glisse avec un léger ressort à l'activation.
 */
export function ToggleSwitch({ checked, onChange, label, title }: ToggleSwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange} className="pressable" title={title}
      style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 9, background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: checked ? "var(--accent)" : "var(--text3)", transition: "color 0.2s" }}>{label}</span>
      <span aria-hidden="true" style={{ position: "relative", width: 40, height: 23, borderRadius: 999, flexShrink: 0, background: checked ? "var(--accent)" : "var(--surface3)", transition: "background 0.25s ease", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.14)" }}>
        <span style={{ position: "absolute", top: 2.5, left: 2.5, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.28)", transform: checked ? "translateX(17px)" : "translateX(0)", transition: "transform 0.28s cubic-bezier(0.34,1.5,0.64,1)" }} />
      </span>
    </button>
  );
}
