import { Icon } from "../Icon.jsx";
import { IngImage } from "../Img.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";
import { fmtQtyUnit } from "../../lib/format.js";

/**
 * Feuille de sélection des ingrédients à ajouter aux courses. Les ingrédients en stock
 * sont décochés par défaut (choix fait par le parent via `selectedIngs`). Purement
 * présentationnel : l'état de sélection et l'ajout effectif restent orchestrés au-dessus.
 */
export function ShoppingSelectSheet({ flatIngs, selectedIngs, setSelectedIngs, isInStock, isLowStock, getIngImage, mult, onClose, onConfirm }) {
  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "85dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.12)" }}>
          <Icon name="shopping" size={21} color="var(--accent)" />
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Ajouter aux courses</h3>
          <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "2px 0 0" }}>Les ingrédients <span style={{ fontWeight: 600, color: "var(--stock)" }}>en stock</span> sont décochés par défaut.</p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{selectedIngs.length} / {flatIngs.length} sélectionné{selectedIngs.length > 1 ? "s" : ""}</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setSelectedIngs(flatIngs.map(fi => fi._fid))} style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999, cursor: "pointer", background: "rgba(var(--accent-rgb),0.10)", border: "1px solid rgba(var(--accent-rgb),0.28)", color: "var(--accent)" }}>Tout cocher</button>
          <button onClick={() => setSelectedIngs([])} style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999, cursor: "pointer", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text3)" }}>Tout décocher</button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", WebkitOverflowScrolling: "touch", flex: 1, minHeight: 0, marginBottom: 16 }}>
        {flatIngs.map(ing => {
          const selected = selectedIngs.includes(ing._fid);
          const inStock = isInStock(ing);
          const low = isLowStock(ing);
          return (
            <button key={ing._fid} onClick={() => setSelectedIngs(prev => selected ? prev.filter(x => x !== ing._fid) : [...prev, ing._fid])}
              className="pressable"
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", borderRadius: 14, flexShrink: 0,
                background: selected ? "rgba(var(--accent-rgb),0.10)" : "var(--surface2)",
                border: `1.5px solid ${selected ? "rgba(var(--accent-rgb),0.4)" : "var(--border)"}`,
                textAlign: "left", transition: "background 0.15s, border-color 0.15s"
              }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                background: selected ? "var(--accent)" : "transparent",
                border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s, border-color 0.15s"
              }}>
                {selected && <Icon name="check" size={12} color="#fff" />}
              </div>
              <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{ing.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>{fmtQtyUnit(ing.amount * mult, ing.unit)}</span>
                  {inStock && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      marginLeft: "auto", flexShrink: 0,
                      fontSize: 10, fontWeight: 600,
                      color: low ? "var(--accent)" : "var(--stock)",
                    }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: "50%",
                        background: low ? "var(--accent)" : "var(--stock)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon name={low ? "warning" : "box"} size={low ? 10 : 10} color="#fff" />
                      </span>
                      {low ? "bientôt vide" : "en stock"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button className="btn btn-primary" style={{ width: "100%", borderRadius: 13, padding: "13px 0", flexShrink: 0 }}
        disabled={selectedIngs.length === 0}
        onClick={() => onConfirm(flatIngs.filter(fi => selectedIngs.includes(fi._fid)))}>
        <Icon name="shopping" size={15} /> Ajouter {selectedIngs.length > 0 ? `${selectedIngs.length} article${selectedIngs.length > 1 ? "s" : ""}` : ""}
      </button>
    </SwipeableSheet>
  );
}
