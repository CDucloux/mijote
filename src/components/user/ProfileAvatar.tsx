// Avatar de l'utilisateur cerclé : anneau accent → or pour un abonné Cardamome+,
// anneau neutre sinon. Un liseré couleur du fond (`gapColor`) détache la photo de
// l'anneau. Partagé par l'en-tête, la feuille compte et la page profil.

interface ProfileAvatarProps {
  photoURL?: string | null;
  /** Nom affiché, pour l'initiale quand il n'y a pas de photo. */
  name?: string | null;
  /** Diamètre total, anneau compris (px). */
  size: number;
  isPlus: boolean;
  /** Épaisseur de l'anneau et du liseré (px). */
  ring?: number;
  /** Couleur du liseré : celle de la surface sur laquelle l'avatar est posé. */
  gapColor?: string;
}

export function ProfileAvatar({ photoURL, name, size, isPlus, ring = 2, gapColor = "var(--bg)" }: ProfileAvatarProps) {
  const inner = size - ring * 2;
  const face = { width: inner, height: inner, borderRadius: "50%", display: "block", boxSizing: "border-box", border: `${ring}px solid ${gapColor}` } as const;
  return (
    <span style={{ display: "block", flexShrink: 0, borderRadius: "50%", padding: ring, background: isPlus ? "linear-gradient(135deg, var(--accent), #f0c060)" : "var(--border)" }}>
      {photoURL
        ? <img src={photoURL} alt="" referrerPolicy="no-referrer" style={{ ...face, objectFit: "cover" }} />
        : <span style={{ ...face, display: "grid", placeItems: "center", background: "var(--accent)", color: "#fff", fontSize: Math.round(inner * 0.42), fontWeight: 600 }}>{(name || "?")[0].toUpperCase()}</span>}
    </span>
  );
}
