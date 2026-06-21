import { useState, useEffect } from "react";
import { Icon } from "./Icon.jsx";

// ─── IMAGE (with fallback) ────────────────────────────────────────────────────
export const Img = ({ src, alt, style }) => {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  if (!src || err) return (
    <div style={{ background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", ...style }}>
      <Icon name="photo" size={20} />
    </div>
  );
  return <img src={src} alt={alt || ""} onError={() => setErr(true)} referrerPolicy="no-referrer" style={{ objectFit: "cover", ...style }} />;
};

// ─── INGREDIENT IMAGE (round, slightly larger, transparent-friendly) ──────────
// Used everywhere an ingredient image appears, for a consistent circular look.
export const IngImage = ({ src, alt, size = 48 }) => {
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
          style={{ width: "82%", height: "82%", objectFit: "contain" }} />
        : <Icon name="photo" size={Math.round(size * 0.42)} color="#b3afaa" />}
    </div>
  );
};
