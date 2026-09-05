import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { describeActivity, actorLabel, relativeTime } from "@/lib/notifications/activity.js";

// Nombre d'évènements montrés d'emblée ; le reste se déplie à la demande. Garde la
// section courte au repos sans masquer l'historique déjà chargé.
const COLLAPSED = 5;

// Une ligne d'activité : pastille (icône teintée) + phrase + méta (auteur · quand).
// Navigable (route non nulle) → bouton pressable qui renvoie vers l'onglet concerné,
// avec un chevron d'affordance ; sinon (suppression) un simple <div> statique.
function ActivityRow({ event, currentEmail, animationDelay, onNavigate }) {
  const { icon, color, title, route } = describeActivity(event);
  const who = actorLabel(event, currentEmail);
  const when = relativeTime(event.ts);
  const inner = (
    <>
      <span style={{
        width: 34, height: 34, borderRadius: 11, flexShrink: 0, marginTop: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--surface2)", border: "1px solid var(--border)",
      }}>
        <Icon name={icon} size={17} color={color} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>
          <span style={{ fontWeight: 600, color: who === "Toi" ? "var(--accent)" : "var(--text2)" }}>{who}</span>
          {" · "}{when}
        </span>
      </span>
      {route && <Icon name="forward" size={15} color="var(--text3)" />}
    </>
  );
  const base = { display: "flex", alignItems: "center", gap: 12, padding: "11px 2px", width: "100%" };
  if (!route) {
    return <div className="slide-up" style={{ ...base, animationDelay }}>{inner}</div>;
  }
  return (
    <button
      type="button" className="slide-up pressable" onClick={() => onNavigate(route)}
      style={{ ...base, animationDelay, background: "none", border: "none", textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}
    >
      {inner}
    </button>
  );
}

/**
 * Section « Notifications » du tableau de bord : journal des dernières modifications
 * du foyer (ajout/édition/suppression de recettes, courses, planning...), attribuées
 * à leur auteur. Masquée quand il n'y a encore aucune activité. Un tick périodique
 * rafraîchit les horodatages relatifs sans re-souscrire.
 */
export function NotificationsSection({ activities = [] }) {
  const { user } = useAppShell();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [, setTick] = useState(0);

  // Rafraîchit « il y a N min » chaque minute tant que la section est montée.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const shown = useMemo(() => (expanded ? activities : activities.slice(0, COLLAPSED)), [expanded, activities]);
  if (activities.length === 0) return null;
  const currentEmail = user?.email || "";
  const rest = activities.length - COLLAPSED;

  return (
    <section style={{ marginTop: 26 }}>
      <h2 className="slide-up" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
        <Icon name="bell" size={17} color="var(--accent)" weight="fill" />
        Notifications
      </h2>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
        padding: "4px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      }}>
        {shown.map((event, i) => (
          <div key={event.id} style={i > 0 ? { borderTop: "1px solid var(--border)" } : undefined}>
            <ActivityRow event={event} currentEmail={currentEmail} animationDelay={`${Math.min(i, 6) * 0.04}s`} onNavigate={navigate} />
          </div>
        ))}
      </div>
      {rest > 0 && (
        <button onClick={() => setExpanded(v => !v)} className="pressable"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, padding: "6px 4px",
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--ff-body)", fontSize: 12.5, fontWeight: 600, color: "var(--accent)" }}>
          {expanded ? "Réduire" : `Voir ${rest} de plus`}
          <Icon name={expanded ? "chevronUp" : "chevronDown"} size={14} color="var(--accent)" />
        </button>
      )}
    </section>
  );
}
