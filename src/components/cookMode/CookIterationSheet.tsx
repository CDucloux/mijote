import { useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { AutoResizeTextarea } from "../ui/AutoResizeTextarea.jsx";
import { RatingPicker } from "../ui/RatingPicker.jsx";

interface CookIterationSheetProps {
  zIndex: number;
  onClose: () => void;
  onSave: (rating: number | null, notes: string) => void;
}

/**
 * Ajout d'une itération au carnet depuis l'écran de fin du pas à pas : note et
 * notes de dégustation. Monté à l'ouverture, il repart d'un formulaire vierge.
 */
export function CookIterationSheet({ zIndex, onClose, onSave }: CookIterationSheetProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  return (
    <SwipeableSheet onClose={onClose} zIndex={zIndex} style={{ maxHeight: "88dvh" }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Noter cette fois</h3>
      <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Fige l'état actuel de la recette dans le carnet d'itérations, avec ton ressenti.</p>
      <div className="field-label">Note du résultat (optionnel)</div>
      <div style={{ marginBottom: 16 }}><RatingPicker value={rating} onChange={setRating} /></div>
      <div className="field-label">Notes de dégustation</div>
      <AutoResizeTextarea className="field-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ex : -10 g de sucre, +zeste de citron vert, cuit 4 min de moins → meilleur" style={{ marginBottom: 18 }} />
      <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => onSave(rating, notes)}>
        <Icon name="save" size={15} /> Enregistrer l'itération
      </button>
    </SwipeableSheet>
  );
}
