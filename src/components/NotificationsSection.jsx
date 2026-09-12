import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { EmptyArt } from "./EmptyArt.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { describeActivity, actorLabel, relativeTime, dayBucketLabel } from "@/lib/notifications/activity.js";

// Nombre d'évènements montrés d'emblée ; le reste se déplie à la demande. Garde la
// section courte au repos sans masquer l'historique déjà chargé.
const COLLAPSED = 5;

// Une ligne de la timeline : pastille teintée (perce la spine) + phrase (2 lignes max)
// + ligne acteur si ce n'est pas « Toi » + heure dédiée. Navigable (route non nulle)
// → <button> pressable avec chevron d'affordance ; sinon (suppression) un <div> statique.
function ActivityRow({ event, currentEmail, onNavigate }) {
  const { icon, color, title, route } = describeActivity(event);
  const who = actorLabel(event, currentEmail);
  const when = relativeTime(event.ts);
  const inner = (
    <>
      <span className="notif-spine-wrap">
        <span className="notif-node" style={{ "--nc": color, background: `color-mix(in srgb, ${color} 13%, var(--surface))` }}>
          <Icon name={icon} size={16} color={color} />
        </span>
      </span>
      <span className="notif-body">
        <span className="notif-title">{title}</span>
        {who !== "Toi" && <span className="notif-who">{who}</span>}
      </span>
      <span className="notif-meta"><span className="notif-time">{when}</span></span>
      {route && (
        <span className="notif-chev"><Icon name="forward" size={15} color="var(--text3)" /></span>
      )}
    </>
  );
  if (!route) {
    return <div className="notif-row">{inner}</div>;
  }
  return (
    <button type="button" className="notif-row notif-row--nav pressable" onClick={() => onNavigate(route)}>
      {inner}
    </button>
  );
}

// Squelette de la timeline pendant l'hydratation Firestore : même ossature (libellé
// de jour + pastilles sur la spine + deux lignes de texte) que le vrai feed, pour
// éviter le saut de mise en page et NE PAS flasher l'état vide avant l'arrivée des
// données. Largeurs alternées pour un rythme naturel, non mécanique.
const SKELETON_ROWS = [82, 64, 74, 58];
function NotificationsSkeleton() {
  return (
    <div className="notif-feed notif-skel" aria-hidden="true">
      <span className="notif-skel-day skeleton" />
      <div className="notif-stack">
        {SKELETON_ROWS.map((w, i) => (
          <div className="notif-row" key={i}>
            <span className="notif-spine-wrap"><span className="notif-node skeleton" /></span>
            <span className="notif-body">
              <span className="notif-skel-line skeleton" style={{ width: `${w}%` }} />
              <span className="notif-skel-line notif-skel-line--sm skeleton" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Section « Notifications » du tableau de bord : journal des dernières modifications
 * du foyer (ajout/édition/suppression de recettes, courses, planning...), attribuées
 * à leur auteur, présenté en timeline « journal du foyer » regroupée par jour. Un tick
 * périodique rafraîchit les horodatages relatifs sans re-souscrire.
 *
 * @param loading - Données partagées encore en cours d'hydratation : on montre le
 *   squelette plutôt que l'état vide (qui flasherait avant l'arrivée du journal).
 */
export function NotificationsSection({ activities = [], loading = false, onNavigated }) {
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
  const currentEmail = user?.email || "";
  const rest = activities.length - COLLAPSED;
  // Renvoie vers l'onglet ciblé puis referme le panneau (accès via le bouton rond).
  const go = (route) => { onNavigated?.(); navigate(route); };

  // Regroupe par jour SANS re-trier : préserve l'ordre `ts desc` du flux.
  const groups = useMemo(() => {
    const out = [];
    for (const event of shown) {
      const label = dayBucketLabel(event.ts);
      const last = out[out.length - 1];
      if (last && last.label === label) last.events.push(event);
      else out.push({ label, events: [event] });
    }
    return out;
  }, [shown]);

  // Hydratation en cours et rien en cache : squelette (jamais l'état vide, qui
  // flasherait le temps que le journal arrive de Firestore).
  if (loading && activities.length === 0) return <NotificationsSkeleton />;

  if (activities.length === 0) {
    return (
      <div className="notif-empty">
        <EmptyArt name="cloche" size={128} style={{ marginBottom: 8 }} />
        <h3 className="notif-empty-t">Rien à signaler pour l'instant</h3>
        <p className="notif-empty-s">Les actions de ton foyer apparaîtront ici : recettes ajoutées, courses, stock, planning.</p>
      </div>
    );
  }

  return (
    <div className="notif-feed">
      {groups.map((group, gi) => (
        <section key={`${group.label}-${gi}`} className="notif-group">
          <div className="notif-daylabel"><span>{group.label}</span></div>
          <div className="notif-stack">
            {group.events.map(event => (
              <ActivityRow key={event.id} event={event} currentEmail={currentEmail} onNavigate={go} />
            ))}
          </div>
        </section>
      ))}
      {rest > 0 && (
        <button onClick={() => setExpanded(v => !v)} className="pressable notif-more">
          {expanded ? "Réduire" : `Voir ${rest} de plus`}
          <Icon name={expanded ? "chevronUp" : "chevronDown"} size={14} color="var(--accent)" />
        </button>
      )}
    </div>
  );
}
