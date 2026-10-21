import type { CookParticipant } from "@/lib/cookSession/together.js";

interface ParticipantAvatarProps {
  participant: Pick<CookParticipant, "name" | "photoURL"> & { away?: boolean };
  size?: number;
  /** Couleur de l'anneau : celle du fond sur lequel l'avatar est posé. */
  ring?: string;
}

/** Avatar rond d'un membre du foyer en cuisine (photo, sinon initiale sur accent), estompé en veille. */
export function ParticipantAvatar({ participant, size = 22, ring = "var(--surface)" }: ParticipantAvatarProps) {
  const initial = participant.name.trim()[0]?.toUpperCase() || "?";
  return (
    <span title={participant.name} style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      display: "inline-grid", placeItems: "center", background: "var(--accent)", color: "#fff",
      fontSize: Math.round(size * 0.45), fontWeight: 700, boxShadow: `0 0 0 2px ${ring}`,
      opacity: participant.away ? 0.45 : 1, filter: participant.away ? "grayscale(1)" : undefined, transition: "opacity 0.3s ease",
    }}>
      {participant.photoURL
        ? <img src={participant.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initial}
    </span>
  );
}
