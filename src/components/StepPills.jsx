import { Img, IngImage } from "./Img.jsx";
import { fmtQtyUnit } from "../lib/format.js";

// ─── PASTILLES (chips ingrédient / ustensile) ─────────────────────────────────
// Extraites des styles inline répétés (fiche recette, mode cuisine). Les styles
// sont définis UNE fois ici (références stables → un poil de perf en prime).

const chip = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)", border: "1px solid var(--border)" };
const qtyStyle = { color: "var(--text3)", fontWeight: 400, marginLeft: 2 };
const utImgStyle = { width: "100%", height: "100%", objectFit: "contain", padding: "8%", boxSizing: "border-box" };

// Pastille ingrédient : image ronde + nom (+ quantité formatée si fournie).
// `cover` = photo pleine (préparation de base) plutôt que PNG détouré.
export function IngredientPill({ image, name, amount, unit, cover = false, size = 22 }) {
  const hasQty = amount !== undefined && amount !== null && amount !== "";
  return (
    <span style={chip}>
      <IngImage src={image} alt={name} size={size} cover={cover} />
      {name}
      {hasQty && <span style={qtyStyle}>{fmtQtyUnit(amount, unit)}</span>}
    </span>
  );
}

// Image d'ustensile : détourée (contain) sur pastille blanche. Réutilisée partout
// où un ustensile s'affiche (pastilles d'étapes, listes) — remplace le motif
// `<div cercle blanc><Img contain/></div>` dupliqué.
export function UtImage({ src, alt, size = 22, radius = "50%" }) {
  return (
    <span style={{ width: size, height: size, borderRadius: radius, overflow: "hidden", background: "#fff", flexShrink: 0, display: "inline-flex" }}>
      <Img src={src} alt={alt} style={utImgStyle} />
    </span>
  );
}

// Pastille ustensile : image détourée sur cercle blanc + nom.
export function UtensilPill({ image, name, size = 22 }) {
  return (
    <span style={chip}>
      <UtImage src={image} alt={name} size={size} />
      {name}
    </span>
  );
}
