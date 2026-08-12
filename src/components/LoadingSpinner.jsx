// Spinner de chargement centré, réutilisé pour l'état d'hydratation des vues
// dépendantes des données partagées (planning, courses, stock). Anneau accent
// tournant via la keyframe `spin` (global.css), respecte prefers-reduced-motion
// (l'anneau reste visible, simplement figé, si l'utilisateur réduit les animations).
export function LoadingSpinner({ size = 30, minHeight = "50vh" }) {
  return (
    <div style={{ flex: 1, minHeight, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <span
        aria-label="Chargement"
        role="status"
        style={{
          width: size, height: size, borderRadius: "50%",
          border: "3px solid var(--border)", borderTopColor: "var(--accent)",
          display: "inline-block", animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}
