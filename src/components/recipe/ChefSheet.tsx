import { useState } from "react";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { StickySheetHeader } from "../ui/StickySheetHeader.jsx";
import { SearchField } from "../ui/SearchField.jsx";
import { Icon } from "../ui/Icon.jsx";
import { CHEFS } from "../../constants/chefs.js";
import { findChef, type Chef } from "@/lib/recipes/chefs.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";

// ─── FEUILLE CHEF ─────────────────────────────────────────────────────────────
// Choix du chef dans la liste fermée (data/chefs.yaml). Un chef hors liste déjà
// posé sur la recette (import, ancienne saisie) reste affiché en tête, sélectionné,
// pour qu'ouvrir la feuille ne l'efface jamais en douce.

interface ChefSheetProps {
  /** Valeur courante de `recipe.chef`. */
  value?: string;
  onChange: (chef: string) => void;
  onClose: () => void;
}

interface ChefRowProps {
  chef: Chef;
  active: boolean;
  onPick: () => void;
}

function ChefRow({ chef, active, onPick }: ChefRowProps) {
  return (
    <button type="button" className="menu-row ripple" onClick={onPick} aria-pressed={active} style={{ padding: "11px 8px" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", color: active ? "var(--accent)" : "var(--text)" }}>{chef.name}</span>
        {chef.note && <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text3)", marginTop: 1 }}>{chef.note}</span>}
      </span>
      {active && <Icon name="check" size={18} color="var(--accent)" />}
    </button>
  );
}

/** Feuille de sélection du chef d'une recette. Un choix referme la feuille. */
export function ChefSheet({ value = "", onChange, onClose }: ChefSheetProps) {
  const [query, setQuery] = useState("");
  const current = value.trim();
  const listed = findChef(CHEFS, current);
  const offList: Chef | null = current && !listed ? { name: current, note: "Hors liste" } : null;
  const q = normalizeStr(query);
  const shown = (offList ? [offList, ...CHEFS] : CHEFS)
    .filter(chef => !q || normalizeStr(`${chef.name} ${chef.note ?? ""}`).includes(q));

  return (
    <SwipeableSheet onClose={onClose} hideHandle style={{ paddingTop: 0 }}>
      {(close) => (
      <>
      <StickySheetHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
            <Icon name="chef" size={22} color="var(--accent)" />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, color: "var(--text)", lineHeight: 1.15 }}>Chef</div>
            <div style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500, marginTop: 2 }}>À qui doit-on cette recette ?</div>
          </div>
          {current && (
            <button type="button" className="btn btn-ghost btn-pill btn-sm" onClick={() => { onChange(""); close(); }}>Retirer</button>
          )}
        </div>
        <SearchField value={query} onChange={setQuery} placeholder="Rechercher un chef" style={{ marginTop: 14 }} />
      </StickySheetHeader>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8, paddingBottom: 8 }}>
        {shown.map(chef => (
          <ChefRow key={chef.name} chef={chef} active={chef === offList || chef === listed}
            onPick={() => { onChange(chef.name); close(); }} />
        ))}
        {!shown.length && (
          <p style={{ padding: "18px 8px", fontSize: 14, color: "var(--text3)" }}>Aucun chef ne correspond à « {query.trim()} ».</p>
        )}
      </div>
      </>
      )}
    </SwipeableSheet>
  );
}
