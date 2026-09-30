import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../ui/Icon.jsx";

interface GroupHeaderProps {
  label: ReactNode;
  showIcon?: boolean;
  style?: CSSProperties;
}

/**
 * En-tête de section (« Pour la pâte », « Montage »…), toujours en accent pour une
 * palette cohérente. Une vraie sous-préparation nommée porte l'icône « layers » ; les
 * blocs hors section n'en ont pas, la distinction se fait par l'icône et le libellé.
 */
export function GroupHeader({ label, showIcon = false, style }: GroupHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, ...style }}>
      {showIcon && <Icon name="layers" size={15} color="var(--accent)" />}
      <span style={{ fontFamily: "var(--ff-display)", fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--accent)", flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}
