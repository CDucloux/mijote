import { useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import { Icon } from "../ui/Icon.jsx";
import { spawnRipple } from "@/lib/ui/ripple.js";
import type { IconName } from "../ui/Icon.jsx";

/** Une action du menu « trois points » : libellé, icône, callback et teinte danger. */
export interface MenuItem {
  label: string;
  icon: IconName;
  onClick: () => void;
  danger?: boolean;
}

/** Délai avant fermeture : laisse l'onde tactile se déployer sous le doigt avant
 *  que le menu ne disparaisse (sinon un tap rapide ne montre aucun retour). */
const RIPPLE_GRACE_MS = 140;

interface HeroMenuProps {
  items: MenuItem[];
  btnStyle?: CSSProperties;
  iconColor?: string;
  iconSize?: number;
  icon?: IconName;
  className?: string;
  align?: "left" | "right";
}

interface MenuPos {
  top: number;
  right?: number;
  left?: number;
}

// Menu « trois points » des actions secondaires d'une recette (hero).
// Se ferme au clic extérieur / Échap. Le dropdown utilise position:fixed pour
// échapper à tout overflow:hidden parent.
export function HeroMenu({ items, btnStyle, iconColor = "#fff", iconSize = 20, icon = "more", className, align = "right" }: HeroMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos>({ top: 0, right: undefined, left: undefined });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--page-zoom") || "1") || 1;
      setPos({
        top: (rect.bottom + 8) / zoom,
        right: align === "right" ? (window.innerWidth - rect.right) / zoom : undefined,
        left: align === "left" ? rect.left / zoom : undefined,
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button ref={btnRef} onClick={() => open ? setOpen(false) : openMenu()} style={btnStyle} className={className} title="Plus d'actions">
        <Icon name={icon} size={iconSize} color={iconColor} />
      </button>
      {open && (
        <div className="hero-menu-pop" style={{
          position: "fixed",
          top: pos.top,
          right: pos.right,
          left: pos.left,
          zIndex: 500,
          minWidth: 190, background: "var(--surface)", borderRadius: 12,
          border: "1px solid var(--border)", boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          padding: 6, display: "flex", flexDirection: "column", gap: 2,
        }}>
          {items.map((it, i) => (
            // `.menu-row` : onde tactile + teinte de maintien/survol partagées avec les
            // autres menus (rouge pour la suppression). Seul le gabarit est resserré ici.
            <button key={i} className={it.danger ? "menu-row menu-row-danger" : "menu-row"}
              onPointerDown={spawnRipple} onClick={() => window.setTimeout(() => { setOpen(false); it.onClick(); }, RIPPLE_GRACE_MS)}
              style={{ gap: 10, padding: "9px 11px", borderRadius: 8, fontSize: 14, fontWeight: 500 }}>
              <Icon name={it.icon} size={16} color={it.danger ? "var(--red)" : "var(--text2)"} />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
