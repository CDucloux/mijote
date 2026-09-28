import { Icon } from "../Icon.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";
import { MEAL_SLOTS } from "../../constants/mealSlots.js";
import { DAYS_SHORT_FR, MONTHS_FR, mondayFirstIndex } from "../../constants/calendar.js";

// En-tête de la fiche : puce d'icône + titre + sous-titre (nom de recette).
function SheetHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
      <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={21} color="var(--accent)" />
      </div>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>{title}</h3>
        <div style={{ fontSize: 12.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>
      </div>
    </div>
  );
}

// Navigation de semaine (flèches + plage de dates courante).
function WeekNav({ days, onShift }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <button onClick={() => onShift(-1)} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="back" size={15} /></button>
      <span style={{ flex: 1, textAlign: "center", fontSize: 13.5, fontWeight: 600 }}>
        {`${new Date(days[0] + "T12:00").getDate()} – ${new Date(days[6] + "T12:00").getDate()} ${MONTHS_FR[new Date(days[6] + "T12:00").getMonth()]}`}
      </span>
      <button onClick={() => onShift(1)} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="forward" size={15} /></button>
    </div>
  );
}

// Rangée de sélection du créneau (matin / midi / soir).
function SlotPickerRow({ value, onPick }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
      {MEAL_SLOTS.map(s => {
        const active = value === s.id;
        return (
          <button key={s.id} onClick={() => onPick(s.id)} className="pressable"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 4px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: active ? "rgba(var(--accent-rgb),0.12)" : "var(--surface2)", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, color: active ? "var(--accent)" : "var(--text3)" }}>
            <Icon name={s.icon} size={16} color="currentColor" />{s.label}
          </button>
        );
      })}
    </div>
  );
}

// Une pastille jour de la grille hebdomadaire.
function DayCell({ dstr, active, disabled, onClick }) {
  const d = new Date(dstr + "T12:00");
  return (
    <button disabled={disabled} onClick={onClick} className="pressable"
      style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 0", borderRadius: 12, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1,
        background: active ? "var(--accent)" : "var(--surface2)", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, color: active ? "#fff" : "var(--text2)" }}>
      <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.9 }}>{DAYS_SHORT_FR[mondayFirstIndex(d.getDay())]}</span>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{d.getDate()}</span>
    </button>
  );
}

/**
 * Replanifier un repas : choisir un autre jour (navigable de semaine en semaine)
 * et un créneau, puis confirmer le déplacement.
 */
export function RescheduleSheet({ recipe, days, target, onShift, onPickDay, onPickSlot, onConfirm, onClose }) {
  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "82dvh" }}>
      <SheetHeader icon="calendar" title="Replanifier" subtitle={`« ${recipe?.name || "cette recette"} »`} />
      <WeekNav days={days} onShift={onShift} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 16 }}>
        {days.map(dstr => (
          <DayCell key={dstr} dstr={dstr} active={target.date === dstr} onClick={() => onPickDay(dstr)} />
        ))}
      </div>
      <SlotPickerRow value={target.slot} onPick={onPickSlot} />
      <button className="btn btn-primary" style={{ width: "100%", borderRadius: 13, padding: "12px 0" }} disabled={!target.date || !target.slot} onClick={onConfirm}>
        <Icon name="check" size={16} /> Déplacer ici
      </button>
    </SwipeableSheet>
  );
}

/**
 * Dupliquer un repas : multi-sélection de jours cibles (le jour d'origine est
 * verrouillé) + un créneau commun, puis confirmer la duplication.
 */
export function DuplicateSheet({ recipe, days, sourceDate, selected, slot, onShift, onToggleDay, onPickSlot, onConfirm, onClose }) {
  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "82dvh" }}>
      <SheetHeader icon="copy" title="Dupliquer" subtitle={`« ${recipe?.name || "cette recette"} » sur d'autres jours`} />
      <WeekNav days={days} onShift={onShift} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 16 }}>
        {days.map(dstr => (
          <DayCell key={dstr} dstr={dstr} active={selected.has(dstr)} disabled={dstr === sourceDate} onClick={() => onToggleDay(dstr)} />
        ))}
      </div>
      <SlotPickerRow value={slot} onPick={onPickSlot} />
      <button className="btn btn-primary" style={{ width: "100%", borderRadius: 13, padding: "12px 0" }} disabled={!selected.size || !slot} onClick={onConfirm}>
        <Icon name="copy" size={16} /> {selected.size > 1 ? `Dupliquer sur ${selected.size} jours` : "Dupliquer ici"}
      </button>
    </SwipeableSheet>
  );
}
