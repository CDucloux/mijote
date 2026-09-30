import { Icon } from "../ui/Icon.jsx";
import { remainingSecs } from "@/lib/planning/cookTimers.js";
import { fmtCountdown } from "@/lib/planning/stepTimers.js";

/**
 * Pile de minuteurs actifs, ancrée en bas à droite au-dessus de la nav. Dépliée :
 * une carte complète par minuteur (compte à rebours, barre, pause/relance/stop).
 * Repliée : un aperçu compact par minuteur. Toutes les actions sont déléguées ;
 * `onGoToStep(stepIdx)` ramène à l'étape source (et déplie depuis l'aperçu).
 */
export function CookTimersStack({ timers, timersOpen, setTimersOpen, now, onGoToStep, onToggle, onRestart, onRemove }) {
  if (timers.length === 0) return null;
  return (
    <div className="cook-timers" style={{ bottom: "calc(80px + max(env(safe-area-inset-bottom) - 8px, 0px))" }}>
      <button type="button" className="cook-timers-toggle" onClick={() => setTimersOpen(o => !o)}
        title={timersOpen ? "Replier les minuteurs" : "Déplier les minuteurs"}>
        <Icon name="clock" size={15} color="var(--accent)" />
        <span>Minuteur{timers.length > 1 ? "s" : ""}</span>
        <span className={`cook-timers-count${timers.some(t => t.done) ? " is-done" : ""}`}>{timers.length}</span>
        <span className={`cook-timers-chevron${timersOpen ? " open" : ""}`}><Icon name="chevronDown" size={15} color="var(--text3)" /></span>
      </button>

      {timersOpen ? timers.map(t => {
        const rem = remainingSecs(t, now);
        const pct = t.totalSec ? Math.min(100, (1 - rem / t.totalSec) * 100) : 0;
        return (
          <div key={t.id} className="slide-up" style={{ alignSelf: "stretch", background: "var(--surface)", border: `1px solid ${t.done ? "var(--ok)" : "var(--border)"}`, borderRadius: 14, padding: "10px 12px", boxShadow: "0 8px 22px -10px rgba(0,0,0,0.4)", animation: t.done ? "timerPulse 1s ease-in-out infinite" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="clock" size={15} color={t.done ? "var(--ok)" : "var(--accent)"} />
              <span style={{ flex: 1, fontVariantNumeric: "tabular-nums", fontSize: 19, fontWeight: 600, letterSpacing: "0.02em", color: t.done ? "var(--ok)" : "var(--text)" }}>
                {t.done ? "Terminé !" : fmtCountdown(rem)}
              </span>
              <button type="button" className="cook-timer-step" onClick={() => onGoToStep(t.stepIdx)} title={`Aller à ${t.stepLabel}`}>
                <Icon name="layers" size={11} color="var(--accent)" /> {t.stepLabel}
              </button>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: "var(--surface2)", margin: "8px 0", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: t.done ? "var(--ok)" : "var(--accent)", transition: "width 0.9s linear" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {t.done
                ? <button className="timer-btn timer-btn-accent" onClick={() => onRestart(t.id)}>
                    <Icon name="history" size={14} color="var(--accent)" /> Relancer
                  </button>
                : <button className="timer-btn" onClick={() => onToggle(t.id)}>
                    <Icon name={t.running ? "pause" : "play"} size={14} color="var(--text)" /> {t.running ? "Pause" : "Reprendre"}
                  </button>}
              <button className="timer-btn timer-btn-stop" onClick={() => onRemove(t.id)}>
                <Icon name="stop" size={13} color="var(--red)" /> Stop
              </button>
            </div>
          </div>
        );
      }) : timers.map(t => {
        const rem = remainingSecs(t, now);
        return (
          <button type="button" key={t.id} className="cook-timer-chip" onClick={() => { onGoToStep(t.stepIdx); setTimersOpen(true); }}
            title={`${t.stepLabel}, ${t.done ? "terminé" : fmtCountdown(rem)}`}
            style={t.done ? { borderColor: "var(--ok)", animation: "timerPulse 1s ease-in-out infinite" } : undefined}>
            <Icon name="clock" size={14} color={t.done ? "var(--ok)" : "var(--accent)"} />
            <span className="t" style={{ color: t.done ? "var(--ok)" : "var(--text)" }}>{t.done ? "Terminé !" : fmtCountdown(rem)}</span>
            <span className="s">{t.stepLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
