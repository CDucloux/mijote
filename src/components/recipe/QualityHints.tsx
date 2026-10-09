import { useMemo } from "react";
import type { CSSProperties } from "react";
import { precautionVisual } from "@/lib/utensils/usagePrecaution.js";
import { parsePrecautionDescription, type TableBlock } from "@/lib/utensils/precautionLayout.js";
import { heatRows } from "@/lib/utensils/heatDial.js";
import type { PrecautionTone, UsagePrecaution } from "@/lib/types";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { Icon, type IconName } from "../ui/Icon.jsx";
import { HeatKnob } from "./HeatKnob.jsx";

// ─── INDICES QUALITÉ (recommandation d'ingrédient / précaution d'ustensile) ───
// Présentationnels et discrets : la logique (résolution, libellé, tonalité) vit
// dans src/lib. On ne rend jamais rien quand il n'y a pas d'info (l'appelant passe
// une valeur nulle → composant renvoie null).

/**
 * Recommandation de forme d'un ingrédient, en ligne discrète (« 💡 Frais ou surgelé
 * recommandé »). Pensée pour se glisser sous une ligne d'ingrédient (recette, courses).
 */
interface IngredientRecoHintProps {
  label?: string | null;
  style?: CSSProperties;
}

export function IngredientRecoHint({ label, style }: IngredientRecoHintProps) {
  if (!label) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text3)", ...style }}>
      <span style={{ fontSize: 11, flexShrink: 0 }} aria-hidden="true">💡</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

/**
 * Pastille (i) posée en coin d'une card d'ustensile pour signaler qu'une précaution
 * est disponible. Purement visuelle (le clic est géré par la card parente) : pointer
 * events désactivés pour ne pas voler le tap.
 */
interface PrecautionInfoBadgeProps {
  tone?: PrecautionTone;
  style?: CSSProperties;
}

export function PrecautionInfoBadge({ tone, style }: PrecautionInfoBadgeProps) {
  const { accent } = precautionVisual(tone);
  return (
    <span aria-hidden="true" style={{
      position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%",
      background: accent + "1f", color: accent, display: "grid", placeItems: "center", pointerEvents: "none", ...style,
    }}>
      <Icon name="info" size={13} color={accent} />
    </span>
  );
}

/**
 * Feuille de détail d'une précaution d'ustensile, ouverte au clic sur la card (fiche
 * recette) ou sur l'ustensile d'une étape (mode pas à pas). En-tête au ton de la
 * précaution, puis titre, description et « bon réflexe ».
 */
interface UtensilPrecautionSheetProps {
  utensilName?: string;
  precaution?: UsagePrecaution | null;
  onClose: () => void;
  zIndex?: number;
}

/**
 * Rend une description de précaution : un tableau éditorial (lignes « label : valeur »
 * ou Markdown à pipes) devient une vraie grille alignée ; le reste reste du texte.
 * Sans tableau, le rendu est identique à un simple paragraphe (`pre-line`).
 */
function PrecautionDescription({ description, accent }: { description: string; accent: string }) {
  const blocks = useMemo(() => parsePrecautionDescription(description), [description]);
  return (
    <>
      {blocks.map((block, i) => block.kind === "paragraph" ? (
        <p key={i} style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, margin: i ? "12px 0 0" : 0, whiteSpace: "pre-line" }}>{block.text}</p>
      ) : (
        <PrecautionTable key={i} block={block} accent={accent} first={i === 0} />
      ))}
    </>
  );
}

/** Grille alignée d'une précaution : en-tête optionnel, libellés à gauche, valeurs à droite (chiffres tabulaires pour aligner les fractions). */
function PrecautionTable({ block, accent, first }: { block: TableBlock; accent: string; first: boolean }) {
  const heat = useMemo(() => heatRows(block), [block]);
  const cols = block.header?.length || Math.max(2, ...block.rows.map(r => r.length));
  const twoCol = cols === 2;
  const template = twoCol ? "1fr auto" : `repeat(${cols}, 1fr)`;
  return (
    <div style={{ marginTop: first ? 0 : 12, borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", background: "var(--surface)" }}>
      {block.header && (
        <div style={{ display: "grid", gridTemplateColumns: template, gap: 12, padding: "9px 14px", background: accent + "14" }}>
          {block.header.map((cell, k) => (
            <span key={k} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: accent, textAlign: twoCol && k === 1 ? "right" : "left" }}>{cell}</span>
          ))}
        </div>
      )}
      {heat ? heat.map((row, r) => (
        <div key={r} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px 8px 14px", borderTop: r > 0 || block.header ? "1px solid var(--border)" : "none" }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.45, color: "var(--text2)" }}>{row.label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{row.value}</span>
          <HeatKnob notches={row.notches} accent={accent} />
        </div>
      )) : block.rows.map((row, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: template, gap: 12, padding: "10px 14px", alignItems: "baseline", borderTop: r > 0 || block.header ? "1px solid var(--border)" : "none" }}>
          {row.map((cell, k) => (
            <span key={k} style={{
              fontSize: 13.5, lineHeight: 1.45,
              color: k === 0 ? "var(--text2)" : "var(--text)",
              fontWeight: k === 0 ? 400 : 600,
              textAlign: twoCol && k === 1 ? "right" : "left",
              fontVariantNumeric: "tabular-nums",
            }}>{cell}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function UtensilPrecautionSheet({ utensilName, precaution, onClose, zIndex }: UtensilPrecautionSheetProps) {
  if (!precaution) return null;
  const { icon, label, accent } = precautionVisual(precaution.tone);
  return (
    <SwipeableSheet onClose={onClose} zIndex={zIndex}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {/* `icon` provient de precautionVisual : toujours un nom d'icône du set maison. */}
        <span style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 14, background: accent + "1f", display: "grid", placeItems: "center" }} aria-hidden="true"><Icon name={icon as IconName} size={22} color={accent} /></span>
        <div style={{ minWidth: 0 }}>
          {utensilName && <div style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 1 }}>{utensilName}</div>}
          <div style={{ fontSize: 11, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        </div>
      </div>
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 10px", color: "var(--text)" }}>{precaution.title}</h3>
      <PrecautionDescription description={precaution.description} accent={accent} />

      {precaution.tip && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, padding: "12px 14px", borderRadius: 14, background: accent + "14", border: `1px solid ${accent}33` }}>
          <Icon name="bulb" size={16} color={accent} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Bon réflexe</div>
            <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55, margin: 0 }}>{precaution.tip}</p>
          </div>
        </div>
      )}
    </SwipeableSheet>
  );
}
