import type { CSSProperties } from "react";
import { IngImage } from "../ui/Img.jsx";
import { Icon } from "../ui/Icon.jsx";
import { useImageState } from "../../hooks/useImageState.js";
import { fmtQtyUnit } from "../../lib/format.js";

// Pastilles (chips ingrédient / ustensile), extraites des styles inline répétés
// (fiche recette, mode cuisine). Les styles sont définis UNE fois ici (références
// stables, un poil de perf en prime).

const chip: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)" };
const qtyStyle: CSSProperties = { color: "var(--text3)", fontWeight: 400, marginLeft: 2 };
// Marge intérieure en px entiers (et non 8 %) : une image à taille fractionnaire est
// re-rastérisée à un sous-pixel différent à chaque appui, et semble « gigoter ».
const utImgStyle = (size: number): CSSProperties => ({ width: "100%", height: "100%", objectFit: "contain", padding: Math.max(1, Math.round(size * 0.08)), boxSizing: "border-box", display: "block" });

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
  /** Styles du conteneur (ex. opacité d'un ustensile déjà rassemblé). */
  style?: CSSProperties;
}

// Image d'ustensile : détourée (contain) sur pastille blanche. Réutilisée partout
// où un ustensile s'affiche (pastilles d'étapes, listes, sélecteur, admin). Même
// chargement que IngImage : anneau différé, puis fondu d'opacité à l'arrivée.
export function UtImage({ src, alt, size = 22, radius = "50%", border = false, style }: UtImageProps) {
  const { loaded, err, imgRef, onLoad, onError } = useImageState(src);
  return (
    <span style={{ position: "relative", width: size, height: size, borderRadius: radius, overflow: "hidden", background: "#fff", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: border ? "1px solid rgba(0,0,0,0.08)" : undefined, boxSizing: "border-box", ...style }}>
      {src && !err && !loaded && (
        <span className="ing-img-spinner" role="status" aria-label="Chargement"
          style={{ width: Math.max(10, Math.round(size * 0.4)), height: Math.max(10, Math.round(size * 0.4)) }} />
      )}
      {src && !err
        ? <img ref={imgRef} src={src} alt={alt || ""} onLoad={onLoad} onError={onError} referrerPolicy="no-referrer"
          loading="lazy" decoding="async" className="ing-img-reveal" data-loaded={loaded ? "1" : undefined} style={utImgStyle(size)} />
        : <Icon name="photo" size={Math.round(size * 0.42)} color="#b3afaa" />}
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
