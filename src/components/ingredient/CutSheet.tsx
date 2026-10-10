import { useState } from "react";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { StickySheetHeader } from "../ui/StickySheetHeader.jsx";
import { Icon } from "../ui/Icon.jsx";
import { capitalize } from "../../lib/format.js";
import { CUT_FAMILIES, CUT_GUIDE, cutShortlist, familyOf, hasSizes } from "@/lib/recipes/cutGuide.js";
import { CutFamilyGlyph } from "./CutFamilyGlyph.jsx";
import type { Cut, FormeDecoupe, Calibre } from "@/lib/types";

// ─── FEUILLE DE DÉCOUPE ───────────────────────────────────────────────────────
// Choix de la découpe de mise en place (forme + calibre). On guide plutôt qu'on
// énumère : les découpes usuelles de l'ingrédient d'abord, les autres rangées par
// forme du résultat derrière un dépli, et sous la sélection ce qu'on obtiendra
// réellement (description + taille). Édition en direct via `onChange`.

const CALIBRES: [Calibre, string][] = [["fin", "Fin"], ["moyen", "Moyen"], ["gros", "Gros"]];

const SECTION_LABEL = { fontSize: 12.5, color: "var(--text3)", fontWeight: 700, letterSpacing: 0.2, textTransform: "uppercase" } as const;

interface CutSheetProps {
  /** Nom de l'ingrédient (sous-titre, et base des suggestions). */
  name?: string;
  /** Catégorie de l'ingrédient en base (`vegetable`, `herbs`…), repli des suggestions. */
  category?: string;
  /** Découpe courante. */
  cut?: Cut | null;
  onChange: (cut: Cut | null) => void;
  onClose: () => void;
}

interface CutPillProps {
  forme: FormeDecoupe;
  active: boolean;
  withGlyph: boolean;
  onPick: (forme: FormeDecoupe) => void;
}

/** Pill d'une forme : nom du résultat + traduction en langage courant. */
function CutPill({ forme, active, withGlyph, onPick }: CutPillProps) {
  const { name, hint } = CUT_GUIDE[forme];
  return (
    <button type="button" className="tap ripple" onClick={() => onPick(forme)} aria-pressed={active}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: withGlyph ? "9px 15px 9px 11px" : "9px 15px", borderRadius: 999, fontSize: 13.5, cursor: "pointer",
        background: active ? "var(--accent)" : "var(--surface2)",
        color: active ? "#fff" : "var(--text)",
        border: active ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
      {withGlyph && <CutFamilyGlyph family={familyOf(forme)} size={17} color={active ? "#fff" : "var(--accent)"} />}
      <span style={{ fontWeight: 650 }}>{name}</span>
      <span style={{ fontWeight: 500, opacity: active ? 0.82 : 1, color: active ? "inherit" : "var(--text3)" }}>{hint}</span>
    </button>
  );
}

/**
 * Feuille de sélection de la découpe d'un ingrédient. Contrôlée : l'état vit chez le
 * parent (`cut`), chaque geste appelle `onChange` avec la nouvelle découpe ou `null`.
 */
export function CutSheet({ name, category, cut, onChange, onClose }: CutSheetProps) {
  const forme = cut?.forme || null;
  const calibre = cut?.calibre || null;
  const [showAll, setShowAll] = useState(false);
  const shortlist = cutShortlist(name, category, forme);

  // Une forme sans tailles (brunoise, julienne…) perd le calibre : il la contredirait.
  const pickForme = (f: FormeDecoupe) => onChange(calibre && hasSizes(f) ? { forme: f, calibre } : { forme: f });
  const pickCalibre = (c: Calibre) => forme && onChange(c === calibre ? { forme } : { forme, calibre: c });
  const guide = forme ? CUT_GUIDE[forme] : null;

  return (
    <SwipeableSheet onClose={onClose} hideHandle style={{ paddingTop: 0 }}>
      {(close) => (
      <>
      {/* En-tête collant : icône couteau + intitulé, nom de l'ingrédient en sous-titre,
          gardés en vue pendant qu'on parcourt les familles de découpes. */}
      <StickySheetHeader>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
          <Icon name="knife" size={22} color="var(--accent)" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, color: "var(--text)", lineHeight: 1.15 }}>Découpe</div>
          {name && <div style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{capitalize(name)}</div>}
        </div>
      </div>
      </StickySheetHeader>

      {/* Découpes usuelles de l'ingrédient (la découpe posée toujours incluse). */}
      <div style={{ ...SECTION_LABEL, margin: "16px 2px 10px" }}>Les plus courantes</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {shortlist.map(f => <CutPill key={f} forme={f} active={forme === f} withGlyph onPick={pickForme} />)}
      </div>

      {/* Toutes les formes, rangées par résultat, derrière un dépli. */}
      <button type="button" className="pressable" onClick={() => setShowAll(v => !v)} aria-expanded={showAll}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, padding: "6px 2px", background: "none", border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 650, color: "var(--accent)" }}>
        {showAll ? "Masquer les autres découpes" : "Toutes les découpes"}
        <Icon name={showAll ? "chevronUp" : "chevronDown"} size={14} color="var(--accent)" />
      </button>
      {showAll && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 10 }}>
          {CUT_FAMILIES.map(family => (
            <div key={family.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 2px 8px", color: "var(--text2)", fontSize: 13, fontWeight: 650 }}>
                <CutFamilyGlyph family={family.id} size={18} color="var(--text3)" /> {family.label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {family.formes.map(f => <CutPill key={f} forme={f} active={forme === f} withGlyph={false} onPick={pickForme} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Résultat attendu : ce qu'on obtient sur la planche, puis la taille. */}
      {forme && guide && (
        <div style={{ marginTop: 26, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
              <CutFamilyGlyph family={familyOf(forme)} size={30} color="var(--accent)" />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>{guide.name}</div>
              <div style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.45, marginTop: 3, maxWidth: "60ch" }}>{guide.result}</div>
            </div>
          </div>

          {/* Taille : seulement pour les formes qui se déclinent. Optionnelle (re-tap = retire). */}
          {guide.sizes && (
            <>
              <div style={{ ...SECTION_LABEL, margin: "20px 2px 10px" }}>Taille</div>
              <div style={{ display: "flex", gap: 8 }}>
                {CALIBRES.map(([v, l]) => {
                  const active = calibre === v;
                  return (
                    <button key={v} type="button" className="tap ripple" onClick={() => pickCalibre(v)} aria-pressed={active}
                      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "9px 0", borderRadius: 14, cursor: "pointer",
                        background: active ? "rgba(var(--accent-rgb),0.14)" : "var(--surface2)",
                        border: active ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
                      <span style={{ fontSize: 14, fontWeight: 650, color: active ? "var(--accent)" : "var(--text2)" }}>{l}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: active ? "var(--accent)" : "var(--text3)" }}>{guide.sizes?.[v]}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Retrait de la découpe : présent seulement s'il y a quelque chose à retirer. */}
          <button type="button" className="pressable" onClick={() => close(() => onChange(null))}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", marginTop: 22, padding: "12px 0", borderRadius: 14, fontSize: 13.5, fontWeight: 600, cursor: "pointer", color: "var(--red)", background: "rgba(var(--red-rgb),0.08)", border: "none" }}>
            <Icon name="trash" size={15} color="var(--red)" /> Retirer la découpe
          </button>
        </div>
      )}
      </>
      )}
    </SwipeableSheet>
  );
}
