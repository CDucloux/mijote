import type { CSSProperties } from "react";
import { Img, IngImage } from "../ui/Img.jsx";
import { fmtQtyUnit } from "../../lib/format.js";

// Pastilles (chips ingrédient / ustensile), extraites des styles inline répétés
// (fiche recette, mode cuisine). Les styles sont définis UNE fois ici (références
// stables, un poil de perf en prime).

const chip: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)", border: "1px solid var(--border)" };
const qtyStyle: CSSProperties = { color: "var(--text3)", fontWeight: 400, marginLeft: 2 };
const utImgStyle: CSSProperties = { width: "100%", height: "100%", objectFit: "contain", padding: "8%", boxSizing: "border-box" };

interface IngredientPillProps {
  image?: string;
  name?: string;
  amount?: number | string | null;
  unit?: string | null;
  /** `true` : photo pleine (préparation de base) plutôt que PNG détouré. */
  cover?: boolean;
  size?: number;
}

// Pastille ingrédient : image ronde + nom (+ quantité formatée si fournie).
export function IngredientPill({ image, name, amount, unit, cover = false, size = 22 }: IngredientPillProps) {
  const hasQty = amount !== undefined && amount !== null && amount !== "";
  return (
    <span style={chip}>
      <IngImage src={image} alt={name} size={size} cover={cover} />
      {name}
      {hasQty && <span style={qtyStyle}>{fmtQtyUnit(amount, unit)}</span>}
    </span>
  );
}

interface UtImageProps {
  src?: string;
  alt?: string;
  size?: number;
  radius?: number | string;
  border?: boolean;
}

// Image d'ustensile : détourée (contain) sur pastille blanche. Réutilisée partout
// où un ustensile s'affiche (pastilles d'étapes, listes).
export function UtImage({ src, alt, size = 22, radius = "50%", border = false }: UtImageProps) {
  return (
    <span style={{ width: size, height: size, borderRadius: radius, overflow: "hidden", background: "#fff", flexShrink: 0, display: "inline-flex", border: border ? "1px solid rgba(0,0,0,0.08)" : undefined, boxSizing: "border-box" }}>
      <Img src={src} alt={alt} style={utImgStyle} />
    </span>
  );
}

interface UtensilPillProps {
  image?: string;
  name?: string;
  detail?: string;
  size?: number;
}

// Pastille ustensile : image détourée sur cercle blanc + nom (+ résumé des réglages
// d'appareil si fourni, ex : « 180 °C · Chaleur tournante »).
export function UtensilPill({ image, name, detail, size = 22 }: UtensilPillProps) {
  return (
    <span style={chip}>
      <UtImage src={image} alt={name} size={size} />
      {name}
      {detail && <span style={qtyStyle}>{detail}</span>}
    </span>
  );
}
