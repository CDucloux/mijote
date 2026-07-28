import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { Icon } from "./Icon.jsx";

// ─── FEUILLE DE CONFIRMATION (danger) ─────────────────────────────────────────
// Cercle rouge + icône, titre centré, message (children), Annuler / action. Gère
// un état `busy` (boutons désactivés, libellé de progression, fermeture bloquée).
// Extrait des confirmations de suppression dupliquées (Profil, Recettes…).
export function ConfirmSheet({ title, children, icon = "trash", confirmLabel = "Supprimer", busyLabel = "Suppression…", busy = false, onCancel, onConfirm }) {
  return (
    <SwipeableSheet onClose={busy ? () => {} : onCancel}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(224,82,82,0.12)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
        <Icon name={icon} size={24} color="var(--red)" />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>{title}</h3>
      <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.55, textAlign: "center" }}>{children}</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={onCancel}>Annuler</button>
        <button className="btn btn-danger" style={{ flex: 1 }} disabled={busy} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</button>
      </div>
    </SwipeableSheet>
  );
}
