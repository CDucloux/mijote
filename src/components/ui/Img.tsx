import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon.jsx";
import { useImageState } from "../../hooks/useImageState.js";

interface ImgProps {
  src?: string;
  alt?: string;
  style?: CSSProperties;
  /** Rendu de repli (ex. `RecipePlaceholder`) affiché tant que l'image charge. */
  fallback?: ReactNode;
}

// Image avec repli. `fallback` (facultatif) reste affiché tant que l'image n'a pas
// fini de charger (fondu à l'arrivée, persistance si échec). Sans `fallback`, on
// garde le comportement historique (l'<img> reçoit tel quel le `style`).
export const Img = ({ src, alt, style, fallback }: ImgProps) => {
  const { loaded, err, imgRef, onLoad, onError } = useImageState(src);

  const placeholder = fallback ?? (
    <div style={{ background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", ...style }}>
      <Icon name="photo" size={20} />
    </div>
  );
  if (!src || err) return placeholder;

  if (!fallback) {
    return <img src={src} alt={alt || ""} onError={onError} referrerPolicy="no-referrer" loading="lazy" decoding="async" style={{ objectFit: "cover", ...style }} />;
  }
  return (
    <div style={{ position: "relative", overflow: "hidden", ...style }}>
      {!loaded && <div style={{ position: "absolute", inset: 0 }}>{placeholder}</div>}
      <img ref={imgRef} src={src} alt={alt || ""} onLoad={onLoad} onError={onError}
        referrerPolicy="no-referrer" loading="lazy" decoding="async"
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", opacity: loaded ? 1 : 0, transition: "opacity 0.25s ease" }} />
    </div>
  );
};

interface IngImageProps {
  src?: string;
  alt?: string;
  size?: number;
  /** Remplit tout le cercle (vraies photos, ex. bases) au lieu du contain sur blanc. */
  cover?: boolean;
}

// Image d'ingrédient (ronde, un peu plus grande, adaptée au transparent), pour un
// rendu circulaire cohérent partout. `cover` remplit le cercle (vraies photos).
// Pendant le chargement, un petit anneau tourne ; l'image arrive ensuite en simple
// fondu d'opacité, sans échelle (le zoom la faisait « gigoter » à l'arrivée). Servie depuis le cache,
// elle est montrée d'emblée, sans anneau ni animation.
export const IngImage = ({ src, alt, size = 48, cover = false }: IngImageProps) => {
  const { loaded, err, imgRef, onLoad, onError } = useImageState(src);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#fff", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative",
    }}>
      {src && !err && !loaded && (
        <span className="ing-img-spinner" role="status" aria-label="Chargement"
          style={{ width: Math.max(12, Math.round(size * 0.36)), height: Math.max(12, Math.round(size * 0.36)) }} />
      )}
      {src && !err
        ? <img ref={imgRef} src={src} alt={alt || ""} onLoad={onLoad} onError={onError} referrerPolicy="no-referrer"
          loading="lazy" decoding="async" className="ing-img-reveal" data-loaded={loaded ? "1" : undefined}
          // Taille entière en px (≈ 82 %), avec une marge paire de chaque côté : centrée,
          // l'image tombe pile sur un pixel. À 34,44 px ou décalée d'un demi-pixel, elle
          // était re-rastérisée différemment à chaque appui et semblait « gigoter ».
          style={cover
            ? { width: "100%", height: "100%", objectFit: "cover" }
            : { width: size - 2 * Math.round(size * 0.09), height: size - 2 * Math.round(size * 0.09), objectFit: "contain", display: "block" }} />
        : <Icon name="photo" size={Math.round(size * 0.42)} color="#b3afaa" />}
    </div>
  );
};
