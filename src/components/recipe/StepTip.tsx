import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../ui/Icon.jsx";

interface StepTipProps {
  tip?: ReactNode;
  /** "sm" (fiche mobile/desktop) ou "lg" (mode cuisson, plein écran). */
  size?: "sm" | "lg";
  style?: CSSProperties;
}

// Encart « conseil » réutilisé dans la fiche recette (desktop + mobile) et le
// mode cuisson. Pastille d'icône ampoule + label ASTUCE + texte, teinte bleue.
export function StepTip({ tip, size = "sm", style }: StepTipProps) {
  if (!tip) return null;
  const lg = size === "lg";
  const chip = lg ? 30 : 26;
  return (
    <div style={{
      display: "flex", gap: 11, alignItems: "center",
      background: "rgba(91,156,246,0.10)", border: "1px solid rgba(91,156,246,0.26)",
      borderRadius: 12, padding: lg ? "12px 15px" : "10px 13px", ...style,
    }}>
      <span style={{ width: chip, height: chip, borderRadius: 9, flexShrink: 0, background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px -2px rgba(91,156,246,0.6)" }}>
        <Icon name="bulb" size={lg ? 17 : 15} color="#fff" />
      </span>
      <p style={{ fontSize: lg ? 15 : 13, color: "var(--text2)", lineHeight: 1.5, margin: 0, wordBreak: "break-word", overflowWrap: "break-word" }}>{tip}</p>
    </div>
  );
}
