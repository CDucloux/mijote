import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { AutoResizeTextarea } from "./AutoResizeTextarea.jsx";
import { addVersion, restoreVersion, deleteVersion, nextVersionLabel } from "../lib/history.js";

const fmtDate = iso => {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
};

// Couleur de la note /10 : rouge → orange → vert.
const ratingColor = r => r >= 8 ? "var(--green)" : r >= 5 ? "var(--accent)" : "var(--red)";

// Sélecteur de note /10 : 10 pastilles cliquables, re-clic sur la valeur = effacer.
function RatingPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
        const active = value != null && n <= value;
        return (
          <button key={n} type="button"
            onClick={() => onChange(value === n ? null : n)}
            style={{
              width: 30, height: 30, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: active ? ratingColor(value) : "var(--surface2)",
              color: active ? "#fff" : "var(--text3)",
              border: `1px solid ${active ? ratingColor(value) : "var(--border)"}`,
              transition: "background 0.12s, color 0.12s, border-color 0.12s",
            }}>{n}</button>
        );
      })}
    </div>
  );
}

// Journal d'itérations d'une recette : versions figées (snapshot + dégustation),
// avec restauration (rollback) et suppression. onUpdateRecipe persiste la recette.
export function RecipeJournal({ recipe, onUpdateRecipe }) {
  const history = [...(recipe.history || [])].reverse(); // plus récent en premier
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [rating, setRating] = useState(null);
  const [notes, setNotes] = useState("");
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openForm = () => {
    setLabel(nextVersionLabel(recipe.history));
    setRating(null);
    setNotes("");
    setShowForm(true);
  };

  const saveVersion = () => {
    onUpdateRecipe(addVersion(recipe, { label, rating, notes }));
    setShowForm(false);
  };

  const doRestore = () => {
    onUpdateRecipe(restoreVersion(recipe, restoreTarget.id));
    setRestoreTarget(null);
  };

  const doDelete = () => {
    onUpdateRecipe(deleteVersion(recipe, deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div>
      <button className="btn btn-primary" style={{ width: "100%", borderRadius: 14, padding: "12px 18px", fontSize: 14, fontWeight: 600, gap: 9, marginBottom: history.length ? 18 : 0 }} onClick={openForm}>
        <Icon name="sparkle" size={16} /> Figer une version
      </button>

      {history.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.6, marginTop: 16 }}>
          Aucune itération enregistrée. À chaque fois que tu retravailles cette recette, fige une version : ce que tu as changé, le résultat à la dégustation et une note. Tu pourras comparer et revenir en arrière.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {history.map(entry => (
            <div key={entry.id} style={{ background: "var(--surface)", borderRadius: 14, padding: 14, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: entry.notes ? 8 : 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{entry.label}</span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>{fmtDate(entry.createdAt)}</span>
                {entry.rating != null && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: ratingColor(entry.rating), borderRadius: 8, padding: "2px 8px" }}>{entry.rating}/10</span>
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  <button onClick={() => setRestoreTarget(entry)} title="Restaurer cette version" style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Icon name="back" size={14} color="var(--text2)" />
                  </button>
                  <button onClick={() => setDeleteTarget(entry)} title="Supprimer" style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Icon name="trash" size={13} color="var(--red)" />
                  </button>
                </div>
              </div>
              {entry.notes && <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{entry.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Feuille de création de version */}
      {showForm && (
        <SwipeableSheet onClose={() => setShowForm(false)} style={{ maxHeight: "88dvh" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Figer une version</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>L'état actuel de la recette (ingrédients, étapes, temps) est enregistré tel quel.</p>

          <div className="field-label">Nom de la version</div>
          <input className="field-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="v2" style={{ marginBottom: 14 }} />

          <div className="field-label">Note du résultat (optionnel)</div>
          <div style={{ marginBottom: 16 }}><RatingPicker value={rating} onChange={setRating} /></div>

          <div className="field-label">Notes de dégustation</div>
          <AutoResizeTextarea className="field-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ex : -10 g de sucre, +zeste de citron vert, cuit 4 min de moins → meilleur" style={{ marginBottom: 18 }} />

          <button className="btn btn-primary" style={{ width: "100%" }} onClick={saveVersion}>
            <Icon name="check" size={15} /> Enregistrer la version
          </button>
        </SwipeableSheet>
      )}

      {/* Confirmation de restauration */}
      {restoreTarget && (
        <SwipeableSheet onClose={() => setRestoreTarget(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Restaurer « {restoreTarget.label} » ?</h3>
          <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, marginBottom: 18 }}>
            Les ingrédients, étapes et temps de la recette seront remplacés par ceux de cette version. L'état actuel sera automatiquement sauvegardé en nouvelle version pour ne rien perdre.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border)" }} onClick={() => setRestoreTarget(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={doRestore}>Restaurer</button>
          </div>
        </SwipeableSheet>
      )}

      {/* Confirmation de suppression */}
      {deleteTarget && (
        <SwipeableSheet onClose={() => setDeleteTarget(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Supprimer « {deleteTarget.label} » ?</h3>
          <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, marginBottom: 18 }}>Cette entrée du journal sera définitivement supprimée. La recette actuelle n'est pas affectée.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border)" }} onClick={() => setDeleteTarget(null)}>Annuler</button>
            <button className="btn" style={{ flex: 1, background: "var(--red)", color: "#fff" }} onClick={doDelete}>Supprimer</button>
          </div>
        </SwipeableSheet>
      )}
    </div>
  );
}
