import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon.jsx";

interface RecipeActionDockProps {
  onOpenShopping: () => void;
  onOpenMealPlan: () => void;
}

/**
 * Dock d'actions flottant de la fiche (desktop) : un bouton « + » qui déplie les
 * actions Courses et Planifier. Un clic en dehors le replie.
 */
export function RecipeActionDock({ onOpenShopping, onOpenMealPlan }: RecipeActionDockProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Repli animé : on joue l'animation inverse avant de démonter (évite le flicker).
  const close = () => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 240);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "fixed", right: 24, bottom: 28, zIndex: 60, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
      {open ? (
        <div className={`action-dock${closing ? " closing" : ""}`}>
          <button className="action-dock-btn action-dock-primary" onClick={onOpenShopping}><Icon name="shopping" size={16} color="#fff" /> Courses</button>
          <button className="action-dock-btn action-dock-ghost" onClick={onOpenMealPlan}><Icon name="calendar" size={16} /> Planifier</button>
          <button className="action-dock-close" title="Réduire" onClick={close}><Icon name="close" size={15} /></button>
        </div>
      ) : (
        <button className="fab-toggle" title="Actions" onClick={() => setOpen(true)} style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px -6px rgba(0,0,0,0.45)" }}>
          <Icon name="plus" size={24} color="#fff" />
        </button>
      )}
    </div>
  );
}
