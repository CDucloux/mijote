import { Icon } from "./Icon.jsx";

export function RecipeNotFound({ onBack }) {
  return (
    <div className="editor-enter" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "40px 32px", textAlign: "center" }}>
      <div style={{ fontSize: 64, lineHeight: 1 }}>🍽️</div>
      <div>
        <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 8 }}>Recette introuvable</h2>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, maxWidth: 280 }}>
          Ce lien ne correspond à aucune recette de tes carnets. Elle a peut-être été supprimée.
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text3)" }}>404</span>
        <span style={{ width: 1, height: 14, background: "var(--border)" }} />
        <span style={{ fontSize: 11, color: "var(--text3)" }}>NOT_FOUND</span>
      </div>
      <button onClick={onBack} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <Icon name="back" size={15} color="#fff" /> Retour aux recettes
      </button>
    </div>
  );
}
