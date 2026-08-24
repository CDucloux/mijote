import { Icon } from "../Icon.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";

/**
 * Feuille de confirmation d'ajout d'une recette publique à sa propre bibliothèque
 * (clone personnel). Signale, le cas échéant, les préparations de base ajoutées avec.
 * Le clone effectif passe par `onClone`.
 */
export function CloneConfirmSheet({ componentDeps, onClose, onClone }) {
  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (<>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Ajouter à mes recettes ?</h3>
        <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>
          Une <strong>copie personnelle</strong> est créée dans ta bibliothèque. C'est elle qui te permet de la planifier, de l'ajouter à tes courses, de la cuisiner en pas-à-pas et de l'<strong>adapter librement</strong> – même hors-ligne. L'auteur d'origine reste crédité.
        </p>
        {componentDeps.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 20 }}>
            <Icon name="info" size={16} color="var(--accent)" />
            <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.45 }}>
              Ses <strong>{componentDeps.length} préparation{componentDeps.length > 1 ? "s" : ""} de base</strong> ({componentDeps.map(c => c.name).join(", ")}) ser{componentDeps.length > 1 ? "ont" : "a"} ajoutée{componentDeps.length > 1 ? "s" : ""} avec, pour que la recette soit complète.
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: componentDeps.length > 0 ? 0 : 6 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}><Icon name="back" size={15} /> Annuler</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => close(() => { onClose(); onClone?.(); })}>Ajouter</button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
