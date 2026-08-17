import { useState, useEffect } from "react";
import { Icon } from "./Icon.jsx";

// ─── IMAGE (with fallback) ────────────────────────────────────────────────────
// `fallback` (facultatif) : rendu de repli (ex. `RecipePlaceholder`). Quand il est
// fourni, il reste AFFICHÉ tant que l'image n'a pas fini de charger : plus de carré
// blanc sur les cards de recette pendant le chargement, l'image apparaît en fondu
// une fois prête (et le repli persiste si elle échoue). Sans `fallback`, on garde le
// comportement historique (l'`<img>` reçoit tel quel le `style` : objectFit, padding,
// rayon…), pour ne pas perturber ustensiles / ingrédients / images d'étape.
export const Img = ({ src, alt, style, fallback }) => {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setErr(false); setLoaded(false); }, [src]);

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
      <img src={src} alt={alt || ""} onLoad={() => setLoaded(true)} onError={() => setErr(true)}
        referrerPolicy="no-referrer" loading="lazy" decoding="async"
        style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", opacity: loaded ? 1 : 0, transition: "opacity 0.25s ease" }} />
    </div>
  );
};

// ─── INGREDIENT IMAGE (round, slightly larger, transparent-friendly) ──────────
// Used everywhere an ingredient image appears, for a consistent circular look.
// `cover` fills the whole circle (real photos, e.g. base recipes) instead of the
// default contain-on-white used for transparent ingredient PNGs.
export const IngImage = ({ src, alt, size = 48, cover = false }) => {
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
