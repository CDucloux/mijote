import { EmptyArt } from "../EmptyArt.jsx";
import { ShoppingItemRow } from "../ShoppingItemRow.jsx";
import { buildShoppingSections } from "@/lib/food/shoppingList.js";
import { ShoppingSectionList, ShoppingClearButton } from "./ShoppingSectionList.jsx";

/**
 * Vue agrégée « Toutes les courses » : les articles de toutes les listes,
 * dédupliqués et regroupés par catégorie, avec l'animation d'achat propagée à
 * chaque liste d'origine. Cocher/valider est piloté au-dessus par `useShopping`.
 */
export function ShoppingAggregateView({ aggregated, categories, pending, unchecking, onBuy, onClear, scrollRef, contentRef }) {
  const { sections, done } = buildShoppingSections(aggregated, categories, a => a.category);
  const renderAgg = agg => (
    <ShoppingItemRow key={agg.key} disableDelete striking={pending.has(agg.key)} unstriking={unchecking.has(agg.key)}
      item={{ id: agg.key, name: agg.name, amount: agg.qtyDisplay, unit: "", checked: agg.checked }}
      imageSrc={agg.image} onBuy={() => onBuy(agg)} onDelete={() => {}}
      subtitle={agg.sources.length ? `Pour ${agg.sources.join(" + ")}${agg.partial ? " · en partie acheté" : ""}` : (agg.partial ? "En partie acheté" : undefined)} />
  );
  return (
    <div key="__all__" className="slide-up" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 20px 32px" }}>
        <div ref={contentRef} style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
          {aggregated.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, textAlign: "center" }}>
              <EmptyArt name="panier" size={104} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text2)" }}>Rien à acheter</div>
              <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5, maxWidth: 260 }}>
                Tes listes sont vides. Ajoute des articles ou envoie une recette aux courses, et tout se regroupe ici.
              </div>
            </div>
          ) : (
            <ShoppingSectionList sections={sections} done={done} renderRow={renderAgg}
              clearButton={<ShoppingClearButton onClick={onClear} title="Confirme l'achat sur toutes les listes – les produits de placard rejoignent ton stock" />} />
          )}
        </div>
      </div>
    </div>
  );
}
