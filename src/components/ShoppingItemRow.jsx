import React from "react";
import { Icon } from "./Icon.jsx";
import { IngImage } from "./Img.jsx";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { capitalize, pluralizeUnit } from "../lib/format.js";

const SWIPE_MAX = 130, SWIPE_TRIGGER = 64;

export function ShoppingItemRow({ item, striking, unstriking, onBuy, onDelete, imageSrc, subtitle, disableDelete = false }) {
  const isDesktop = useIsDesktop();
  const [dx, setDx] = React.useState(0);
  const [animating, setAnimating] = React.useState(false);
  const [exiting, setExiting] = React.useState(false);
  const [trashHover, setTrashHover] = React.useState(false);
  const startX = React.useRef(0), startY = React.useRef(0), axis = React.useRef(null);
  // `unstriking` : article coché qu'on décoche, on retrace le barré à l'envers
  // (et on rallume la ligne) AVANT que la donnée bascule et le remonte dans « À acheter ».
  const struck = (item.checked || striking) && !unstriking;

  const onTouchStart = e => { startX.current = e.touches[0].clientX; startY.current = e.touches[0].clientY; axis.current = null; setAnimating(false); };
  const onTouchMove = e => {
    const dX = e.touches[0].clientX - startX.current, dY = e.touches[0].clientY - startY.current;
    if (!axis.current) { if (Math.abs(dX) > 8 || Math.abs(dY) > 8) axis.current = Math.abs(dX) > Math.abs(dY) ? "h" : "v"; }
    if (axis.current === "h") {
      const lo = disableDelete ? 0 : -SWIPE_MAX;
      const hi = item.checked ? 0 : SWIPE_MAX;
      setDx(Math.max(lo, Math.min(hi, dX)));
    }
  };
  const onTouchEnd = () => {
    if (axis.current === "h") {
      setAnimating(true);
      if (!item.checked && dx >= SWIPE_TRIGGER) onBuy(item);
      else if (!disableDelete && dx <= -SWIPE_TRIGGER) {
        setExiting(true);
        setTimeout(() => onDelete(item), 290);
        return;
      }
      setDx(0);
    }
    axis.current = null;
  };

  const revealBuy = Math.min(1, Math.max(0, dx) / SWIPE_TRIGGER);
  const revealDel = Math.min(1, Math.max(0, -dx) / SWIPE_TRIGGER);

  return (
    <div style={{
      position: "relative", borderRadius: 12, overflow: "hidden",
      maxHeight: exiting ? 0 : 200,
      marginBottom: exiting ? 0 : 8,
      transition: exiting ? "max-height 0.26s 0.14s ease, margin-bottom 0.26s 0.14s ease" : undefined,
    }}>
      {/* Fond vert révélé en swipe droite (j'achète) */}
      <div style={{ position: "absolute", inset: 0, background: "var(--green)", display: "flex", alignItems: "center", paddingLeft: 18, opacity: dx > 0 ? 1 : 0, transition: dx > 0 ? "none" : "opacity 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", transform: `scale(${0.7 + revealBuy * 0.3})`, opacity: revealBuy }}>
          <Icon name="check" size={18} color="#fff" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>J'achète</span>
        </div>
      </div>
      {/* Fond rouge révélé en swipe gauche (supprimer) */}
      <div style={{ position: "absolute", inset: 0, background: "var(--red)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 18, opacity: dx < 0 ? 1 : 0, transition: dx < 0 ? "none" : "opacity 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", transform: `scale(${0.7 + revealDel * 0.3})`, opacity: revealDel }}>
          <Icon name="trash" size={17} color="#fff" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Supprimer</span>
        </div>
      </div>
      {/* Avant-plan : la ligne elle-même */}
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{
          position: "relative", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
          opacity: exiting ? 0 : (unstriking ? 1 : (item.checked ? 0.55 : (striking ? 0 : 1))),
          transform: exiting
            ? "translateX(-110%)"
            : `translateX(${dx}px) translateY(${striking ? 14 : 0}px)`,
          transition: exiting
            ? "transform 0.27s cubic-bezier(0.4,0,0.8,0), opacity 0.18s ease"
            // Achat : on attend que le barré ait fini de se tracer (0.42s) avant de
            // faire glisser la ligne vers le bas + l'estomper.
            : striking
              ? "transform 0.26s cubic-bezier(0.22,1,0.36,1) 0.28s, opacity 0.26s ease 0.28s"
              // Décochage : la ligne se rallume pendant que le barré se retrace.
              : unstriking
                ? "opacity 0.3s ease"
                : ((dx === 0 || animating)
                  ? "transform 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease"
                  : "none"),
        }}>
        <button onClick={() => onBuy(item)}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: struck ? "var(--green)" : "transparent", border: `2px solid ${struck ? "var(--green)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s, border-color 0.2s" }}>
            {struck && <Icon name="check" size={11} color="#fff" />}
          </div>
          <IngImage src={imageSrc} alt={item.name} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 500, color: struck ? "var(--text3)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.2s" }}>{capitalize(item.name)}</span>
              <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", height: 1.5, background: "var(--text3)", width: struck ? "100%" : "0%", transition: "width 0.28s ease" }} />
            </div>
            {(item.amount || item.unit) && <div style={{ fontSize: 12, color: "var(--text2)" }}>{item.amount} {pluralizeUnit(item.amount, item.unit)}</div>}
            {subtitle && <div style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{subtitle}</div>}
          </div>
        </button>
        {isDesktop && !disableDelete && (
          <button onClick={() => onDelete(item)} title="Supprimer" onMouseEnter={() => setTrashHover(true)} onMouseLeave={() => setTrashHover(false)}
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", background: trashHover ? "rgba(224,82,82,0.14)" : "transparent", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red)", cursor: "pointer", transition: "background 0.15s" }}>
            <Icon name="trash" size={14} color="var(--red)" />
          </button>
        )}
      </div>
    </div>
  );
}
