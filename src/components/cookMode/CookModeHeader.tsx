import { Icon } from "../ui/Icon.jsx";
import { BaseIcon } from "../ui/BaseIcon.jsx";
import { fmtElapsed } from "@/lib/format.js";
import { companionText, type CookParticipant } from "@/lib/cookSession/together.js";
import { ParticipantAvatar } from "./ParticipantAvatar.jsx";

/** Autre membre du foyer en cuisine : où il en est dans le pas à pas. */
export interface CookCompanion {
  participant: CookParticipant;
  /** Progression de sa page (0-100), comme la barre de l'utilisateur. */
  progress: number;
  /** Libellé de sa page (« Étape 4 »). */
  label: string;
}

interface CookModeHeaderProps {
  recipeName: string | undefined;
  /** Pas à pas d'une préparation de base, ouvert depuis la recette principale. */
  isNested: boolean;
  /** Libellé de la page courante (« Mise en place », « Étape 2 / 5 »…). */
  pageLabel: string;
  /** Secondes écoulées depuis le lancement (chrono masqué en imbriqué). */
  elapsed: number;
  progress: number;
  /** Cuisiner à deux : l'autre membre, posé sur la barre de progression. */
  companions?: CookCompanion[];
  /** Cuisiner à deux, hors ligne : l'autre membre ne voit plus notre position. */
  offline?: boolean;
  onClose: () => void;
  /** Mode mains libres : bouton micro (sans support, il explique au clic). */
  voice?: { supported: boolean; active: boolean; heard: string | null; toggle: () => void };
}

/** En-tête du pas à pas : fermeture, titre, page courante, chrono global et progression. */
export function CookModeHeader({ recipeName, isNested, pageLabel, elapsed, progress, companions = [], offline = false, onClose, voice }: CookModeHeaderProps) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(16px + max(env(safe-area-inset-top) - 8px, 0px)) 20px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <button className="cook-close-btn" onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={isNested ? "back" : "close"} size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isNested && <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><BaseIcon size={14} /></span>}
            {recipeName}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {voice?.heard ? <span style={{ color: "var(--accent)" }}>« {voice.heard} »</span> : pageLabel}
            {offline
              ? <span style={{ color: "var(--text2)" }}> · Hors ligne : ton binôme ne te voit plus</span>
              : companions.map(c => <span key={c.participant.uid} style={{ color: "var(--text2)" }}> · {companionText(c.participant, c.label)}</span>)}
          </div>
        </div>
        {voice && (
          <button className={`cook-voice-btn${voice.active ? " on" : ""}`} onClick={voice.toggle} aria-pressed={voice.active}
            title={voice.active ? "Couper le mode mains libres" : "Mains libres : « suivant », « répète », « minuteur »"}
            aria-label={voice.active ? "Couper le mode mains libres" : "Activer le mode mains libres"}>
            <Icon name="mic" size={18} weight={voice.active ? "fill" : "regular"} />
          </button>
        )}
        {/* Chrono global : temps écoulé depuis le lancement de la recette. */}
        {!isNested && (
          <div title="Temps écoulé depuis le lancement" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "6px 11px", borderRadius: 999, background: "var(--surface2)", fontVariantNumeric: "tabular-nums" }}>
            <Icon name="clock" size={14} color="var(--accent)" />
            <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em", color: "var(--text)" }}>{fmtElapsed(elapsed)}</span>
          </div>
        )}
      </div>

      <div style={{ position: "relative", height: 3, background: "var(--surface2)", flexShrink: 0, zIndex: 1 }}>
        <div style={{ height: "100%", background: "var(--accent)", width: `${progress}%`, transition: "width 0.4s ease" }} />
        {/* L'autre membre glisse sur la barre au fil de ses étapes. */}
        {companions.map(c => (
          <span key={c.participant.uid} style={{ position: "absolute", top: "50%", left: `${c.progress}%`, transform: "translate(-100%, -50%)", transition: "left 0.5s cubic-bezier(0.34, 1.3, 0.5, 1)", display: "inline-flex" }}>
            <ParticipantAvatar participant={c.participant} size={18} />
          </span>
        ))}
      </div>
    </>
  );
}
