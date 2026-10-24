import { clockLabel } from "@/lib/planning/serveSchedule.js";
import { dateAtClock } from "@/lib/planning/mealService.js";
import { weekdayName, type BatchSettings } from "@/lib/planning/batchPlan.js";
import { Icon } from "../ui/Icon.jsx";
import { PlusBadge } from "../badges/PlusBadge.jsx";
import { UserAvatar } from "../user/UserAvatar.jsx";
import { MONTHS_FR } from "../../constants/calendar.js";

interface MealPlanHeaderProps {
  /** Les 7 jours (`YYYY-MM-DD`) de la semaine affichée. */
  weekDays: string[];
  isPlus: boolean;
  /** La dernière génération porte sur cette semaine : « Annuler » remplace « Générer ». */
  canUndo: boolean;
  onUndo: () => void;
  /** Ouvre la génération (abonné) ou l'offre Cardamome+. */
  onGenerate: () => void;
  onShiftWeek: (dir: number) => void;
  onToday: () => void;
  onExport: () => void;
}

const dayOf = (iso: string) => new Date(iso + "T12:00");
const NAV_BTN = { width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } as const;

/** En-tête du planning : titre, génération/annulation et navigation de semaine. */
export function MealPlanHeader({ weekDays, isPlus, canUndo, onUndo, onGenerate, onShiftWeek, onToday, onExport }: MealPlanHeaderProps) {
  const first = dayOf(weekDays[0]), last = dayOf(weekDays[6]);
  return (
    <div style={{ padding: "20px 20px 16px", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>Planning</h1></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canUndo
            ? <button onClick={onUndo} className="btn btn-ghost btn-pill" style={{ padding: "8px 14px", fontSize: 13, background: "var(--surface)" }}><Icon name="undo" size={15} /> Annuler</button>
            : <button onClick={onGenerate} className="btn btn-primary btn-pill"><Icon name={isPlus ? "calendar" : "sparkle"} size={15} /> Générer</button>}
          <UserAvatar />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => onShiftWeek(-1)} className="pressable ripple float-pill" style={NAV_BTN}><Icon name="back" size={16} /></button>
        <span style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
          {`${first.getDate()} – ${last.getDate()} ${MONTHS_FR[last.getMonth()]} ${last.getFullYear()}`}
        </span>
        <button onClick={() => onShiftWeek(1)} className="pressable ripple float-pill" style={NAV_BTN}><Icon name="forward" size={16} /></button>
        <button onClick={onToday} className="pressable ripple float-pill" style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(var(--accent-rgb),0.15)", color: "var(--accent)", flexShrink: 0 }}>Auj.</button>
        <button onClick={onExport} className="pressable ripple float-pill" title="Ajoute le planning à ton agenda" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: "var(--text2)", flexShrink: 0 }}>
          <Icon name="calendar" size={13} color="var(--text2)" /> Agenda
        </button>
      </div>
    </div>
  );
}

/**
 * Accès à la session batch, affiché quand la semaine contient au moins un plat. Il
 * annonce la session elle-même : jour, heure de début et de fin, repas couverts.
 */
export function BatchSessionBanner({ isPlus, settings, end, meals, onOpen }: { isPlus: boolean; settings: Pick<BatchSettings, "day" | "clock" | "done">; end: number; meals: number; onOpen: () => void }) {
  const start = dateAtClock(settings.day, settings.clock);
  return (
    <button onClick={onOpen} className="pressable float-card"
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer",
        padding: "12px 14px", borderRadius: 16 }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.13)" }}>
        <Icon name={settings.done ? "check" : "layers"} size={19} color="var(--accent)" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Session batch · {weekdayName(settings.day)}</span>
          {!isPlus && <PlusBadge />}
        </span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>
          {settings.done ? `Terminée · ${meals} repas prêts` : `${start != null ? clockLabel(start) : settings.clock} → ${clockLabel(end)} · ${meals} repas de la semaine`}
        </span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", background: "rgba(var(--accent-rgb),0.12)", padding: "6px 11px", borderRadius: 999, flexShrink: 0 }}>{settings.done ? "Revoir" : "Préparer"}</span>
    </button>
  );
}
