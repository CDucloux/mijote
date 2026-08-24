import { Icon } from "../Icon.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";

/**
 * Confirmation avant de valider l'achat : les articles cochés quittent la liste
 * et, parmi eux, les `stockCount` produits de placard rejoignent le stock (les
 * produits frais sont exclus). `onConfirm` porte le déversement et les toasts.
 */
export function ConfirmClearSheet({ stockCount, onClose, onConfirm }) {
  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (<>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(var(--ok-rgb),0.14)", border: "1px solid rgba(var(--ok-rgb),0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="shopping" size={20} color="var(--ok)" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>Valider l'achat ?</h3>
        </div>
        <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.55 }}>
          Les articles achetés vont être retirés de la liste.
          {stockCount > 0
            ? <> Parmi eux, <strong>{stockCount}</strong> produit{stockCount > 1 ? "s" : ""} de placard rejoindront ton stock (les produits frais sont exclus).</>
            : <> Aucun produit de placard à ajouter au stock (uniquement des produits frais).</>}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}><Icon name="back" size={15} /> Annuler</button>
          <button className="btn btn-primary" style={{ flex: 1, background: "var(--ok)", borderColor: "var(--ok)" }} onClick={() => close(onConfirm)}>
            <Icon name="check" size={15} color="#fff" /> Valider
          </button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
