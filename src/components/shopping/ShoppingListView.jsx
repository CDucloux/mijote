import { Icon } from "../Icon.jsx";
import { EmptyArt } from "../EmptyArt.jsx";
import { ShoppingItemRow } from "../ShoppingItemRow.jsx";
import { findIngredientMatch } from "@/lib/food/nameMatcher.js";
import { buildShoppingSections } from "@/lib/food/shoppingList.js";
import { ShoppingSectionList, ShoppingClearButton } from "./ShoppingSectionList.jsx";

/**
 * Vue d'une liste de courses active : FAB d'ajout (listes libres), états vides
 * soignés (« Tout est acheté » / « Liste vide »), et articles regroupés par
 * catégorie avec l'animation d'achat. Achats et suppressions remontent au
 * parent (`useShopping`).
 */
export function ShoppingListView({
  activeList, categories, ingredientDB, catOf, pending, unchecking,
  onBuy, onDeleteItem, onClear, onDeleteList, onOpenAdd, scrollRef, contentRef,
}) {
  const renderItem = item => (
    <ShoppingItemRow key={item.id} item={item} striking={pending.has(item.id)} unstriking={unchecking.has(item.id)}
      imageSrc={item.image || findIngredientMatch(item.name, ingredientDB)?.image || ""}
      onBuy={onBuy} onDelete={it => onDeleteItem(activeList.id, it.id)} />
  );
  const { sections, done } = buildShoppingSections(activeList.items, categories, it => catOf(it.name));
  return (
    <div key={activeList.id} className="slide-up" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* FAB – absolute inside the list container */}
      {activeList.type === "free" && (
        <button onClick={onOpenAdd}
          style={{ position: "absolute", bottom: 16, right: 16, width: 52, height: 52, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(var(--accent-rgb),0.45)", zIndex: 50, border: "none", cursor: "pointer" }}>
          <Icon name="plus" size={22} color="#fff" />
        </button>
      )}

      {/* Liste – pleine largeur, défilante */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: `12px 20px ${activeList.type === "free" ? 76 : 20}px` }}>
        <div ref={contentRef} style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>

          {activeList.items.length === 0 && activeList.type !== "free" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, maxWidth: 380, margin: "0 auto" }}>
              <EmptyArt name="assiette" size={128} style={{ marginBottom: 8 }} />
              <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 7 }}>Tout est acheté&nbsp;!</h3>
              <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 22 }}>
                Tous les ingrédients de cette liste ont été cochés.
              </p>
              <button className="list-del-btn ripple" onClick={() => onDeleteList(activeList.id)}>
                <Icon name="trash" size={15} color="var(--red)" /> Supprimer la liste
              </button>
            </div>
          )}

          {activeList.items.length === 0 && activeList.type === "free" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, textAlign: "center" }}>
              <EmptyArt name="panier" size={104} />
              <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>Liste vide</h3>
              <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5, maxWidth: 240 }}>
                Appuie sur le bouton <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", verticalAlign: "middle" }}><Icon name="plus" size={11} color="#fff" /></span> en bas à droite pour ajouter des articles.
              </div>
            </div>
          )}

          {/* Tri par défaut : groupé par catégorie, alphabétique dans chaque groupe ; « Acheté » en bas */}
          <ShoppingSectionList sections={sections} done={done} renderRow={renderItem}
            clearButton={!activeList.hideClear
              ? <ShoppingClearButton onClick={onClear} title="Confirme l'achat – les produits de placard rejoignent ton stock" />
              : null} />
        </div>
      </div>
    </div>
  );
}
