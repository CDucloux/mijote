import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { StickySheetHeader } from "../ui/StickySheetHeader.jsx";
import { LedgerRow, LedgerHeading } from "../ui/Ledger.jsx";
import { BASE_CATEGORIES } from "../../constants/recipeCategories.js";

// ─── EXPLICATION « PRÉPARATION DE BASE » ──────────────────────────────────────
// Même langage que la feuille Difficulté : titre dominant, puis lignes de ticket
// sans cartes. Les familles suivent BASE_CATEGORIES (data/recipe-categories.yaml) :
// une catégorie ajoutée côté données apparaît ici, même sans description dédiée.

const INTRO = "Une préparation de base s'élabore à l'avance, indépendamment d'un plat précis, et sert de brique à plusieurs recettes.";

// Exemples et usage par famille, indexés par id de catégorie de base.
const FAMILY_HINTS: Record<string, string> = {
  fond: "Fond brun, fond blanc, fumet de poisson, fond de volaille : la colonne vertébrale des sauces. Se prépare à l'avance et se congèle.",
  sauce: "Béchamel, velouté, espagnole, hollandaise, tomate : les sauces mères dont découle toute la sauce-cuisine classique.",
  appareil: "Mélanges prêts à l'emploi : appareil à crème brûlée, à quiche, à financier. Préparé la veille, il fait gagner du temps au service.",
  liaison: "Roux, beurre manié, liaison à la crème ou aux jaunes : des texturants qu'on intègre à d'autres préparations.",
  pate: "Brisée, sablée, feuilletée, à choux, à pizza : à abaisser, garnir ou façonner. Se garde au froid et se congèle bien.",
  sirop: "Sirop simple, sirop à puncher, caramel, coulis : pour imbiber un biscuit, napper un dessert ou sucrer une boisson.",
  marinade: "Acide, huile et aromates où viande, poisson ou légumes reposent pour s'attendrir et prendre du goût.",
};

interface BaseInfoModalProps {
  onClose: () => void;
}

export function BaseInfoModal({ onClose }: BaseInfoModalProps) {
  return (
    <SwipeableSheet onClose={onClose} hideHandle style={{ maxHeight: "90dvh", paddingTop: 0 }}>
      <StickySheetHeader>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, margin: "4px 2px 14px" }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500, marginBottom: 4 }}>Type de recette</div>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1 }}>Préparation de base</div>
          </div>
          <div style={{ fontFamily: "var(--ff-display)", fontWeight: 700, color: "var(--accent)", lineHeight: 0.9, fontVariantNumeric: "tabular-nums", textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: 46 }}>{BASE_CATEGORIES.length}</span>
            <span style={{ display: "block", fontFamily: "var(--ff-body)", fontSize: 12, fontWeight: 500, color: "var(--text3)", marginTop: 4 }}>familles</span>
          </div>
        </div>
      </StickySheetHeader>

      <p style={{ fontSize: 14.5, color: "var(--text2)", lineHeight: 1.6, margin: "20px 2px 26px", maxWidth: "60ch" }}>{INTRO}</p>

      <LedgerHeading>Les familles</LedgerHeading>
      {BASE_CATEGORIES.map(category => (
        <LedgerRow key={category.id} title={category.label} hint={FAMILY_HINTS[category.id]} />
      ))}

      <div style={{ marginTop: 30, paddingTop: 18, borderTop: "1.5px dashed var(--border)" }}>
        <LedgerHeading>Dans Cardamome</LedgerHeading>
        <p style={{ fontSize: 14.5, color: "var(--text2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: "60ch" }}>
          Une recette marquée « Base » peut servir d'ingrédient à une autre. Quand tu cuisines la recette parente, Cardamome te propose de réaliser d'abord ses bases avant de passer aux étapes principales.
        </p>
      </div>
    </SwipeableSheet>
  );
}
