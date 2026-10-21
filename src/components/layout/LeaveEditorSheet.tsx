import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";

interface LeaveEditorSheetProps {
  onStay: () => void;
  onLeave: () => void;
}

/** Confirmation avant de quitter l'éditeur de recette avec des modifications non sauvegardées. */
export function LeaveEditorSheet({ onStay, onLeave }: LeaveEditorSheetProps) {
  return (
    <SwipeableSheet onClose={onStay}>
      {(close) => (<>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Quitter le formulaire ?</h3>
        <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
          Les modifications non sauvegardées seront perdues. Tu peux sauvegarder d'abord en cliquant sur "Sauvegarder" en haut.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}>Rester</button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => close(onLeave)}>Quitter sans sauvegarder</button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
