// ─── PLACEHOLDER DE RECETTE SANS PHOTO ───────────────────────────────────────
// Fond très sombre (quasi noir chaud) avec un halo terracotta ou vert en bas,
// et l'initiale en Fraunces (var(--ff-display)) façon titre de livre. La teinte
// du halo est dérivée du nom pour rester stable d'un rendu à l'autre.

const HALOS = [
  // terracotta
  "radial-gradient(115% 75% at 50% 118%, #b5512a 0%, #4a2f22 42%, #221a16 72%, #1a1411 100%)",
  // vert
  "radial-gradient(115% 75% at 50% 118%, #3f7d52 0%, #243a2a 42%, #18211a 72%, #131a15 100%)",
];

function haloFor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h + name.charCodeAt(i)) % 997;
  return HALOS[h % HALOS.length];
}

export function RecipePlaceholder({ name, style, fontSize = 54 }) {
  const initial = ((name || "").trim()[0] || "?").toUpperCase();
  return (
    <div style={{ background: haloFor(name), display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", ...style }}>
      <span style={{ fontFamily: "var(--ff-display)", fontSize, fontWeight: 500, lineHeight: 1, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", textShadow: "0 3px 16px rgba(0,0,0,0.45)" }}>{initial}</span>
    </div>
  );
}
