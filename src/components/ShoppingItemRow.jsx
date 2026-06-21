import React from "react";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";

const SWIPE_MAX = 100, SWIPE_TRIGGER = 64;

export function ShoppingItemRow({ item, striking, onBuy, onEdit, onDelete, imageSrc }) {
  const [dx, setDx] = React.useState(0);
  const [animating, setAnimating] = React.useState(false); // true pendant le retour élastique
  const startX = React.useRef(0), startY = React.useRef(0), axis = React.useRef(null);
  const struck = item.checked || striking;

  const onTouchStart = e => { startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY; axis.current = null; setAnimating(false); };
  const onTouchMove = e => {
    if (item.checked) return; // un article déjà acheté ne se swipe pas
    const dX = e.touches[0].clientX - startX.current, dY = e.touches[0].clientY - startY.current;
    if (!axis.current) { if (Math.abs(dX) > 8 || Math.abs(dY) > 8) axis.current = Math.abs(dX) > Math.abs(dY) ? "h" : "v"; }
    if (axis.current === "h") setDx(Math.max(0, Math.min(SWIPE_MAX, dX)));
  };
  const onTouchEnd = () => {
    if (axis.current === "h") {
      setAnimating(true);
      if (!item.checked && dx >= SWIPE_TRIGGER) onBuy(item);
      setDx(0);
    }
    axis.current = null;
  };

  const reveal = Math.min(1, dx / SWIPE_TRIGGER);
  return (
    <div style={{ position: "relative", marginBottom: 8, borderRadius: 12, overflow: "hidden" }}>
      {/* Fond vert révélé pendant le swipe */}
      <div style={{ position: "absolute", inset: 0, background: "var(--green)", display: "flex", alignItems: "center", paddingLeft: 18, opacity: dx > 0 ? 1 : 0, transition: dx > 0 ? "none" : "opacity 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", transform: `scale(${0.7 + reveal * 0.3})`, opacity: reveal }}>
          <Icon name="check" size={18} color="#fff" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>J'achète</span>
        </div>
      </div>
      {/* Avant-plan : la ligne elle-même */}
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{
          position: "relative", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
          opacity: item.checked ? 0.55 : (striking ? 0 : 1),
          transform: `translateX(${dx}px) translateY(${striking ? 14 : 0}px)`,
          transition: (dx === 0 || animating)
            ? "transform 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease"
            : "none",
        }}>
        <button onClick={() => onBuy(item)}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: struck ? "var(--green)" : "transparent", border: `2px solid ${struck ? "var(--green)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s, border-color 0.2s" }}>
            {struck && <Icon name="check" size={11} color="#fff" />}
          </div>
          <IngImage src={imageSrc} alt={item.name} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: struck ? "var(--text3)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.2s" }}>{item.name}</span>
              <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", height: 1.5, background: "var(--text3)", width: struck ? "100%" : "0%", transition: "width 0.25s ease" }} />
            </div>
            {(item.amount || item.unit) && <div style={{ fontSize: 12, color: "var(--text2)" }}>{item.amount} {item.unit}</div>}
          </div>
        </button>
        <button onClick={() => onEdit(item)} title="Modifier"
          style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}>
          <Icon name="edit" size={13} />
        </button>
        <button onClick={() => onDelete(item)} title="Supprimer"
          style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: "rgba(224,82,82,0.10)", border: "1px solid rgba(224,82,82,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red)" }}>
          <Icon name="trash" size={13} color="var(--red)" />
        </button>
      </div>
    </div>
  );
}
