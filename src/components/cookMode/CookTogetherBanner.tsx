import { useState } from "react";
import { useAppShell } from "../../context/AppShellContext.jsx";
import { useJoinableCookSessions } from "../../hooks/useJoinableCookSessions.js";
import { firstNameOf } from "@/lib/cookSession/together.js";
import { Icon } from "../ui/Icon.jsx";
import { ParticipantAvatar } from "./ParticipantAvatar.jsx";

interface CookTogetherBannerProps {
  isDesktop: boolean;
  /** Ouvre le pas à pas de la recette (rejoint la session). */
  onJoin: (recipeId: string) => void;
}

/**
 * Bandeau flottant « Léa cuisine X · Rejoindre » : apparaît sur tous les écrans dès
 * qu'un autre membre du foyer lance un pas à pas, pour cuisiner à deux. Masquable
 * pour la session en cours (il ne revient pas tant que la même session dure).
 */
export function CookTogetherBanner({ isDesktop, onJoin }: CookTogetherBannerProps) {
  const { user, householdId } = useAppShell();
  const joinable = useJoinableCookSessions(householdId, user?.uid);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const keyOf = (s: { recipeId: string; startedAt: number }) => `${s.recipeId}@${s.startedAt}`;
  const shown = joinable.find(j => !dismissed.has(keyOf(j.session)));
  if (!shown) return null;
  const { session, cook } = shown;
  const key = keyOf(session);

  return (
    <div role="status" className="slide-up" style={{
      position: "fixed", zIndex: 400, display: "flex", alignItems: "center", gap: 12, padding: "10px 10px 10px 12px", borderRadius: 999,
      background: "var(--float-surface)", boxShadow: "0 10px 30px -12px rgba(0, 0, 0, 0.35), var(--float-shadow)",
      ...(isDesktop
        ? { right: 28, bottom: 28, maxWidth: 420 }
        : { left: 16, right: 16, bottom: "calc(var(--tab-h) + var(--tab-pad-b) + 12px)" }),
    }}>
      <ParticipantAvatar participant={cook} size={34} />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {firstNameOf(cook)} cuisine {session.recipeName || "une recette"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>Lance-toi à ses côtés, chacun son étape</div>
      </div>
      <button className="btn btn-primary btn-pill btn-flat" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => onJoin(session.recipeId)}>
        Rejoindre
      </button>
      <button className="hover-neutral" aria-label="Masquer" title="Masquer" onClick={() => setDismissed(prev => new Set([...prev, key]))}
        style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", color: "var(--text3)", flexShrink: 0 }}>
        <Icon name="close" size={14} color="currentColor" />
      </button>
    </div>
  );
}
