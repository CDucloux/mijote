import type { Recipe } from "@/lib/types.js";
import { publishBlockers } from "@/lib/household/publicRecipes.js";
import { sourceHost } from "@/lib/sources/outboundLink.js";
import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";

interface PublishSheetProps {
  recipe: Recipe;
  componentDeps: Recipe[];
  onClose: () => void;
  onPublish?: (recipe: Recipe) => void;
  /** Admin : peut publier une recette sourcée (accord de la créatrice). */
  isAdmin?: boolean;
}

/**
 * Feuille de confirmation de publication d'une recette vers la communauté Cardamome.
 * Une recette (ou une base) importée d'une source externe ne se publie pas : la
 * feuille l'explique et ne propose que de la garder privée (seul l'admin passe, pour
 * les partenariats avec accord). Sinon, liste les préparations de base publiées avec
 * elle. La publication réelle passe par `onPublish`.
 */
export function PublishSheet({ recipe, componentDeps, onClose, onPublish, isAdmin = false }: PublishSheetProps) {
  const blockers = publishBlockers(recipe, componentDeps);
  if (blockers.length && !isAdmin) return <BlockedPublishSheet recipe={recipe} blockers={blockers} onClose={onClose} />;
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
        <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: blockers.length ? 16 : 12, lineHeight: 1.5 }}>
          Elle rejoindra la communauté Cardamome : chacun pourra la découvrir et l'ajouter à ses recettes. Tu en restes l'auteur·e et peux la retirer à tout moment.
        </p>
        {blockers.length > 0 && (
          <div style={{ borderRadius: 16, background: "rgba(224,146,10,0.08)", border: "1px solid rgba(224,146,10,0.22)", padding: 16, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: "rgba(224,146,10,0.16)", display: "grid", placeItems: "center" }}>
                <Icon name="shield" size={16} color="#e8920a" />
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 650, color: "var(--text)" }}>Attention au droit d'auteur</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5 }}>
              Recette sourcée : à ne publier qu'avec l'accord écrit de sa créatrice.
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
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}><Icon name="undo" size={15} /> Annuler</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => close(() => { onClose(); onPublish?.(recipe); })}>Publier</button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}

/**
 * Variante bloquée : la recette vient d'une créatrice ou d'un livre. Explique
 * pourquoi elle reste privée (sans ton d'alerte : rien n'est perdu) et nomme la
 * base fautive quand ce n'est pas la recette elle-même.
 */
function BlockedPublishSheet({ recipe, blockers, onClose }: { recipe: Recipe; blockers: Recipe[]; onClose: () => void }) {
  const self = blockers.find(b => b.id === recipe.id);
  const origin = sourceHost((self ?? blockers[0]).source);
  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (<>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: "var(--surface2)", display: "grid", placeItems: "center" }}>
            <Icon name="lock" size={20} color="var(--text2)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Cette recette reste privée</h3>
            <p style={{ fontSize: 12.5, color: "var(--text3)", margin: 0 }}>D'après {origin}</p>
          </div>
        </div>
        <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.55, margin: "0 0 10px" }}>
          {self
            ? <>Son texte et ses photos appartiennent à {origin}. On ne la republie pas dans la communauté : c'est sa créatrice qui la fait vivre.</>
            : <>Elle utilise {blockers.length > 1 ? "des préparations de base importées" : <>la base « {blockers[0].name} », importée</>} depuis {origin}. Leur texte et leurs photos appartiennent à leur créatrice : on ne les republie pas.</>}
        </p>
        <p style={{ color: "var(--text3)", fontSize: 13, lineHeight: 1.5, margin: "0 0 20px" }}>
          Rien ne change pour toi : elle reste dans ta bibliothèque, à cuisiner et partager avec ton foyer autant que tu veux.
        </p>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => close()}>Compris</button>
      </>)}
    </SwipeableSheet>
  );
}
