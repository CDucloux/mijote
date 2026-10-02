import React from "react";
import type { ReactNode, CSSProperties } from "react";
import { Icon } from "../ui/Icon.jsx";
import type { IconName } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { Row, Col } from "../ui/primitives.jsx";
import type { DayIntake } from "@/lib/planning/dayIntake.js";

// Apport en sel du jour : pastille discrète qui situe la journée face au repère
// (6 g/j, proxy du sodium). Trois états MAPPÉS à un niveau réel : neutre tant qu'on
// reste sous 75 %, ambre en approche, rouge au dépassement (le seul qui « crie »).
// Muette si la couverture des fiches est trop faible : mieux vaut rien qu'une
// alerte trompeuse.
const MP_SALT_AMBER = "#c98a12"; // caution (assez sombre pour rester lisible clair/sombre)
const mpFmtG = (grams: number) => `${(grams >= 10 ? Math.round(grams) : Math.round(grams * 10) / 10).toLocaleString("fr-FR")} g`;

// Pastille cliquable « Apports » de la journée : point d'entrée vers le détail
// (énergie, protéines, sel). Sa couleur reste pilotée par le sel (le repère
// anti-surplus) : neutre sous 75 %, ambre en approche, rouge au dépassement.
// Muette si la couverture des fiches est trop faible (alerte trompeuse évitée).
export const DayIntakePill = React.memo(function DayIntakePill({ intake, onClick }: { intake: DayIntake; onClick: () => void }) {
  if (!intake.reliable) return null;
  const { level } = intake;
  const tone = level === "over"
    ? { fg: "var(--red)", bg: "rgba(var(--red-rgb),0.13)" }
    : level === "warn"
      ? { fg: MP_SALT_AMBER, bg: "rgba(201,138,18,0.14)" }
      : { fg: "var(--text3)", bg: "var(--surface2)" };
  const title = level === "over"
    ? `Journée salée (au-delà du repère de sel) · voir le détail des apports`
    : level === "warn"
      ? `Journée un peu salée (proche du repère de sel) · voir le détail des apports`
      : `Voir le détail des apports du jour`;
  return (
    <button type="button" onClick={onClick} title={title} className="pressable day-intake-pill"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 10px 2px 7px", borderRadius: 999, fontSize: 10.5, fontWeight: 600, background: tone.bg, color: tone.fg, "--pill-fg": tone.fg, whiteSpace: "nowrap", border: "none", cursor: "pointer" } as CSSProperties}>
      <Icon name="bolt" size={12} color={tone.fg} />
      Apports
    </button>
  );
});

// Feuille « Apports du jour » : détail sel (plafond) + protéines (plancher) +
// énergie. Reste sobre : une ligne par nutriment, valeur du jour, barre vers le
// repère. Le sel colore l'alerte au dépassement, les protéines signalent seulement
// une journée un peu juste (jamais « en rouge », ce n'est pas un danger).
interface DayIntakeRowProps {
  icon: IconName;
  label: string;
  value: ReactNode;
  sub: ReactNode;
  pct?: number | null;
  color: string;
}

function DayIntakeRow({ icon, label, value, sub, pct, color }: DayIntakeRowProps) {
  return (
    <div>
      <Row justify="space-between" align="baseline" style={{ marginBottom: 5 }}>
        <Row gap={8} as="span">
          <Icon name={icon} size={19} color={color} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{label}</span>
        </Row>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {value} <span style={{ color: "var(--text3)", fontWeight: 500 }}>{sub}</span>
        </span>
      </Row>
      {pct != null && (
        <div style={{ height: 6, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", borderRadius: 999, background: color, transition: "width 0.4s ease" }} />
        </div>
      )}
    </div>
  );
}

export function DayIntakeSheet({ intake, dateLabel, onClose }: { intake: DayIntake; dateLabel: string; onClose: () => void }) {
  const saltColor = intake.level === "over" ? "var(--red)" : intake.level === "warn" ? MP_SALT_AMBER : "var(--text3)";
  const protColor = intake.proteinLevel === "low" ? MP_SALT_AMBER : "var(--ok)";
  const fiberColor = intake.fiberLevel === "low" ? MP_SALT_AMBER : "var(--ok)";
  const saltNote = intake.level === "over" ? "au-delà du repère" : intake.level === "warn" ? "proche du repère" : "sous le repère";
  const protNote = intake.proteinLevel === "low" ? "un peu juste" : "suffisant";
  const fiberNote = intake.fiberLevel === "low" ? "un peu juste" : "suffisant";
  return (
    <SwipeableSheet onClose={onClose} style={{ maxWidth: 420 }}>
      <Row gap={12} style={{ marginBottom: 4 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: "var(--surface2)", display: "grid", placeItems: "center" }}>
          <Icon name="bolt" size={20} color="var(--text2)" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 700 }}>Apports du jour</div>
          <div style={{ fontSize: 12, color: "var(--text3)", textTransform: "capitalize" }}>{dateLabel}</div>
        </div>
      </Row>
      {/* Énergie : chiffre brut (pas de repère) → présenté à part, en tuile. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--surface2)", borderRadius: 14, margin: "18px 0 6px" }}>
        <Row gap={9} as="span">
          <Icon name="bolt" size={19} color="var(--text2)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Énergie</span>
        </Row>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {Math.round(intake.calories).toLocaleString("fr-FR")} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text3)" }}>kcal</span>
        </span>
      </div>
      {/* Face aux repères journaliers : protéines (plancher) puis sel (plafond). */}
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 2px 12px" }}>Face aux repères</div>
      <Col gap={16} style={{ margin: "0 2px 6px" }}>
        <DayIntakeRow icon="drumstick" label="Protéines" value={mpFmtG(intake.protein)} sub={`/ ${intake.proteinTarget} g · ${protNote}`} pct={intake.proteinRatio * 100} color={protColor} />
        <DayIntakeRow icon="leaf" label="Fibres" value={mpFmtG(intake.fiber)} sub={`/ ${intake.fiberTarget} g · ${fiberNote}`} pct={intake.fiberRatio * 100} color={fiberColor} />
        <DayIntakeRow icon="saltShaker" label="Sel" value={mpFmtG(intake.salt)} sub={`/ ${intake.saltTarget} g · ${saltNote}`} pct={intake.saltRatio * 100} color={saltColor} />
      </Col>
      <div style={{ fontSize: 10.5, color: "var(--text3)", lineHeight: 1.5, marginTop: 14, padding: "10px 12px", background: "var(--surface2)", borderRadius: 10 }}>
        Estimation par personne, une portion de chaque plat, sur {Math.round(intake.coverage * 100)}% de la masse renseignée. Le sel est un plafond à ne pas dépasser (repère {intake.saltTarget} g/jour), les protéines et les fibres des planchers à atteindre.
      </div>
    </SwipeableSheet>
  );
}
