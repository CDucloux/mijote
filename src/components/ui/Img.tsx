import { useState, useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon.jsx";
import { imgAlreadyLoaded } from "../../lib/ui/imageLoad.js";

// État de chargement d'une image, rattaché à SA source : `loaded`/`err` valent pour
// la `src` qui les a produits, un changement de source les invalide de lui-même.
// Pas d'effet de remise à zéro au montage : il s'exécutait APRÈS la détection du
// cache (useLayoutEffect) et rebasculait en « chargement » une image déjà affichée,
// dont l'évènement `load` ne revient jamais (spinner infini après un réordonnancement).
function useImageState(src: string | undefined) {
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>();
  const [errSrc, setErrSrc] = useState<string | undefined>();
  const imgRef = useRef<HTMLImageElement>(null);
  // Image servie depuis le cache : son évènement `load` a pu partir avant que le
  // handler onLoad ne soit attaché. On la révèle dès le montage si elle est déjà
  // complète (avant peinture, sans clignotement).
  useLayoutEffect(() => {
    if (imgAlreadyLoaded(imgRef.current)) setLoadedSrc(src);
  }, [src]);
  return {
    loaded: !!src && loadedSrc === src,
    err: !!src && errSrc === src,
    imgRef,
    onLoad: () => setLoadedSrc(src),
    onError: () => setErrSrc(src),
  };
}

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
          style={cover
            ? { width: "100%", height: "100%", objectFit: "cover" }
            : { width: "82%", height: "82%", objectFit: "contain" }} />
        : <Icon name="photo" size={Math.round(size * 0.42)} color="#b3afaa" />}
    </div>
  );
};
