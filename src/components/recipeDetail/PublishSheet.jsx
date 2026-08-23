import { Icon } from "../Icon.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";

/**
 * Feuille de confirmation de publication d'une recette vers la communauté Cardamome.
 * Rappelle le droit d'auteur si la recette a une source externe et liste les
 * préparations de base publiées avec elle. La publication réelle passe par `onPublish`.
 */
export function PublishSheet({ recipe, componentDeps, onClose, onPublish }) {
  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (<>
        {/* En-tête : puce accent + titre display + contexte communauté. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
            <Icon name="globe" size={21} color="var(--accent)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Publier cette recette ?</h3>
            <p style={{ fontSize: 12.5, color: "var(--text3)", margin: 0 }}>Communauté Cardamome</p>
          </div>
        </div>
        <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: recipe.source ? 16 : 12, lineHeight: 1.5 }}>
          Elle rejoindra la communauté Cardamome : chacun pourra la découvrir et l'ajouter à ses recettes. Vous en restez l'auteur·e et pouvez la retirer à tout moment.
        </p>
        {recipe.source && (
          <div style={{ borderRadius: 16, background: "rgba(224,146,10,0.08)", border: "1px solid rgba(224,146,10,0.22)", padding: 16, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: "rgba(224,146,10,0.16)", display: "grid", placeItems: "center" }}>
                <Icon name="shield" size={16} color="#e8920a" />
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 650, color: "var(--text)" }}>Attention au droit d'auteur</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5 }}>
              Cette recette provient d'une source externe. Ne republiez que ce dont vous avez le droit : reformulez les étapes avec vos propres mots et n'utilisez pas de textes ou de photos protégés dont vous n'êtes pas l'auteur·e.
            </div>
          </div>
        )}
        {componentDeps.length > 0 && (
          <div style={{ borderRadius: 14, background: "rgba(var(--accent-rgb),0.07)", border: "1px solid rgba(var(--accent-rgb),0.22)", padding: "13px 14px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: "rgba(var(--accent-rgb),0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="import" size={14} color="var(--accent)" />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                Publiée{componentDeps.length > 1 ? "s" : ""} avec {componentDeps.length > 1 ? "ses" : "sa"} préparation{componentDeps.length > 1 ? "s" : ""} de base
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {componentDeps.map(c => (
                <span key={c.id} style={{ fontSize: 12, fontWeight: 500, color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 9px" }}>{c.name}</span>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 9, lineHeight: 1.45 }}>
              Incluses pour que le clone reste complet. Déjà publiques ? Elles seront simplement mises à jour.
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: componentDeps.length > 0 ? 0 : 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}><Icon name="back" size={15} /> Annuler</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => close(() => { onClose(); onPublish?.(recipe); })}>Publier</button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
