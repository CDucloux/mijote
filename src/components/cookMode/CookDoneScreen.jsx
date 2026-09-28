import { Icon } from "../Icon.jsx";
import { EmptyArt } from "../EmptyArt.jsx";

/**
 * Écran de félicitations affiché à la fin d'une recette (ou d'une base imbriquée).
 * Propose de noter une itération (recette principale non imbriquée uniquement) puis
 * de revenir. Le retour est DIRECT (`onClose` sans fondu de sortie : le fondu depuis
 * cet écran paraissait étrange).
 */
export function CookDoneScreen({ isNested, closing, recipeName, canIterate, onIterate, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: isNested ? 601 : 501, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "cookModeIn 0.4s ease", opacity: closing ? 0 : 1, transition: "opacity 0.28s ease", padding: "calc(32px + max(env(safe-area-inset-top) - 8px, 0px)) 32px calc(32px + max(env(safe-area-inset-bottom) - 8px, 0px))", textAlign: "center" }}>
      <div style={{ animation: "popIn 0.6s cubic-bezier(0.34,1.56,0.64,1)", marginBottom: 20 }}>
        <EmptyArt name="service" size={188} style={{ color: "var(--text)" }} />
      </div>
      <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 12, animation: "popIn 0.6s 0.2s both cubic-bezier(0.34,1.56,0.64,1)" }}>
        {isNested ? "Base terminée !" : "Félicitations !"}
      </h1>
      <p style={{ fontSize: 16, color: "var(--text2)", lineHeight: 1.6, marginBottom: 32, maxWidth: 300, animation: "popIn 0.5s 0.35s both ease" }}>
        {isNested
          ? <><strong style={{ color: "var(--text)" }}>{recipeName}</strong> est prêt·e. Reviens à la recette principale.</>
          : <><strong style={{ color: "var(--text)" }}>{recipeName}</strong> est prêt·e !</>}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320, animation: "popIn 0.5s 0.5s both ease" }}>
        {canIterate && (
          <button className="btn btn-ghost" style={{ padding: "13px 24px", fontSize: 15, borderRadius: 999 }} onClick={onIterate}>
            <Icon name="star" size={17} /> Noter une itération
          </button>
        )}
        <button className="btn btn-primary" style={{ padding: "14px 32px", fontSize: 16, borderRadius: 999 }} onClick={onClose}>
          <Icon name="check" size={18} /> {isNested ? "Retour" : "Retour à la recette"}
        </button>
      </div>
    </div>
  );
}
