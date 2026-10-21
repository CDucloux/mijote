import type { Step } from "@/lib/types.js";
import { Icon } from "../ui/Icon.jsx";
import { BaseIcon } from "../ui/BaseIcon.jsx";
import { cookPageLabel, pageKeyOf, type CookParticipant } from "@/lib/cookSession/together.js";
import { ParticipantAvatar } from "./ParticipantAvatar.jsx";

/** Une page du cook mode : mise en place, préparations de base, ou étape numérotée. */
export type CookPage =
  | { kind: "overview" }
  | { kind: "bases" }
  | { kind: "step"; step: Step; realIdx: number };

interface CookSidebarProps {
  pages: CookPage[];
  stepIdx: number;
  onGoTo: (idx: number) => void;
  /** Cuisiner à deux : autres membres par clé de page. */
  others?: ReadonlyMap<string, CookParticipant[]>;
  /** Cuisiner à deux : étapes (index réels) faites par l'un ou l'autre. */
  doneSteps?: ReadonlySet<number>;
}

/**
 * Sommaire latéral du cook mode (desktop uniquement, masqué en mobile via CSS) :
 * une entrée par page (mise en place, bases, étapes) avec pastille d'état
 * (à venir / active / franchie). Cliquer une entrée y navigue (`onGoTo`). À deux,
 * une étape faite par l'autre compte comme franchie, et son avatar marque sa page.
 */
export function CookSidebar({ pages, stepIdx, onGoTo, others, doneSteps }: CookSidebarProps) {
  return (
    <div className="cook-mode-sidebar" style={{ display: "none", width: 260, minWidth: 260, overflowY: "auto", borderRight: "1px solid var(--border)", padding: "12px 0" }}>
      {pages.map((pg, idx) => {
        const active = idx === stepIdx;
        const passed = !active && (idx < stepIdx || (pg.kind === "step" && !!doneSteps?.has(pg.realIdx)));
        const label = cookPageLabel(pg);
        const here = others?.get(pageKeyOf(pg)) ?? [];
        const dotBg = active ? "var(--accent)" : passed ? "var(--ok)" : "var(--surface2)";
        const dotFg = active || passed ? "#fff" : "var(--text3)";
        return (
          <button key={pg.kind === "step" ? pg.step.id : pg.kind} onClick={() => onGoTo(idx)}
            style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", background: active ? "rgba(var(--accent-rgb),0.1)" : "none", borderLeft: `3px solid ${active ? "var(--accent)" : "transparent"}`, textAlign: "left", transition: "all 0.15s" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, background: dotBg, color: dotFg }}>
              {passed ? <Icon name="check" size={11} color="#fff" />
                : pg.kind === "step" ? pg.realIdx + 1
                : pg.kind === "bases" ? <BaseIcon size={12} color={active ? "#fff" : "var(--text3)"} />
                : <Icon name="fileText" size={11} color={dotFg} />}
            </div>
            <span style={{ flex: 1, fontSize: 13, color: active ? "var(--accent)" : passed ? "var(--text3)" : "var(--text2)", fontWeight: active ? 600 : 400, lineHeight: 1.4 }}>{label}</span>
            {here.map(p => <ParticipantAvatar key={p.uid} participant={p} size={20} />)}
          </button>
        );
      })}
    </div>
  );
}
