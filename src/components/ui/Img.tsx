import { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon.jsx";
import { imgAlreadyLoaded } from "../../lib/ui/imageLoad.js";

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
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => { setErr(false); setLoaded(false); }, [src]);
  // Image servie depuis le cache : son évènement `load` a pu partir avant que le
  // handler onLoad ne soit attaché. On révèle donc l'image dès le montage si elle
  // est déjà complète (avant peinture, sans clignotement du placeholder).
  useLayoutEffect(() => {
    if (imgAlreadyLoaded(imgRef.current)) setLoaded(true);
  }, [src]);

  const placeholder = fallback ?? (
    <div style={{ background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", ...style }}>
      <Icon name="photo" size={20} />
    </div>
  );
  if (!src || err) return placeholder;

  if (!fallback) {
    return <img src={src} alt={alt || ""} onError={() => setErr(true)} referrerPolicy="no-referrer" loading="lazy" decoding="async" style={{ objectFit: "cover", ...style }} />;
  }
  return (
    <div style={{ position: "relative", overflow: "hidden", ...style }}>
      {!loaded && <div style={{ position: "absolute", inset: 0 }}>{placeholder}</div>}
      <img ref={imgRef} src={src} alt={alt || ""} onLoad={() => setLoaded(true)} onError={() => setErr(true)}
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
export const IngImage = ({ src, alt, size = 48, cover = false }: IngImageProps) => {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#fff", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
    }}>
      {src && !err
        ? <img src={src} alt={alt || ""} onError={() => setErr(true)} referrerPolicy="no-referrer"
          loading="lazy" decoding="async"
          style={cover
            ? { width: "100%", height: "100%", objectFit: "cover" }
            : { width: "82%", height: "82%", objectFit: "contain" }} />
        : <Icon name="photo" size={Math.round(size * 0.42)} color="#b3afaa" />}
    </div>
  );
};
