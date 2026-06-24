import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { AutoResizeTextarea } from "./AutoResizeTextarea.jsx";
import { addVersion, restoreVersion, deleteVersion, nextVersionLabel } from "../lib/history.js";

const fmtDate = iso => {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
};

const fmtTime = min => {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

const ratingColor = r => r >= 8 ? "var(--green)" : r >= 5 ? "var(--accent)" : "var(--red)";

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

// Prévisualisation en lecture seule du snapshot d'une version.
function SnapshotPreview({ entry, onRestore, onClose }) {
  const s = entry.snapshot || {};
  const [confirmRestore, setConfirmRestore] = useState(false);

  if (confirmRestore) return (
    <SwipeableSheet onClose={() => setConfirmRestore(false)}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Restaurer « {entry.label} » ?</h3>
      <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, marginBottom: 18 }}>
        Les ingrédients, étapes et temps de la recette seront remplacés par ceux de cette version. L'état actuel sera automatiquement sauvegardé en nouvelle version pour ne rien perdre.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border)" }} onClick={() => setConfirmRestore(false)}>Annuler</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onRestore}>Restaurer</button>
      </div>
    </SwipeableSheet>
  );

  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "90dvh" }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.01em" }}>{entry.label}</div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            {fmtDate(entry.createdAt)}
            {entry.rating != null && <span style={{ marginLeft: 8, fontWeight: 700, color: ratingColor(entry.rating) }}>{entry.rating}/10</span>}
          </div>
        </div>
        <button className="btn btn-primary" style={{ gap: 7, fontSize: 13 }} onClick={() => setConfirmRestore(true)}>
          <Icon name="back" size={14} /> Restaurer
        </button>
      </div>

      {entry.notes && (
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55, marginBottom: 16, padding: "10px 14px", background: "var(--surface2)", borderRadius: 10, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {entry.notes}
        </p>
      )}

      <div style={{ overflowY: "auto", maxHeight: "60vh", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Temps */}
        {(s.prepTime != null || s.cookTime != null) && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Temps</div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Préparation</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtTime(s.prepTime)}</div>
              </div>
              <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Cuisson</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtTime(s.cookTime)}</div>
              </div>
              {s.servings && (
                <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>Portions</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{s.servings}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ingrédients */}
        {s.ingredients?.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Ingrédients</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {s.ingredients.map((ing, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--surface2)", borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{ing.name}</span>
                  {(ing.amount || ing.unit) && (
                    <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>{ing.amount}{ing.unit}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Étapes */}
        {s.steps?.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Étapes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.steps.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                  <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55, margin: 0 }}>{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SwipeableSheet>
  );
}

export function RecipeJournal({ recipe, onUpdateRecipe }) {
  const history = [...(recipe.history || [])].reverse();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [rating, setRating] = useState(null);
  const [notes, setNotes] = useState("");
  const [previewEntry, setPreviewEntry] = useState(null);
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
    onUpdateRecipe(restoreVersion(recipe, previewEntry.id));
    setPreviewEntry(null);
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
            <div key={entry.id} style={{ background: "var(--surface)", borderRadius: 14, padding: 14, border: "1px solid var(--border)", cursor: "pointer" }}
              onClick={() => setPreviewEntry(entry)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{entry.label}</span>
                <span style={{ fontSize: 12, color: "var(--text3)" }}>{fmtDate(entry.createdAt)}</span>
                {entry.rating != null && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: ratingColor(entry.rating), borderRadius: 8, padding: "2px 8px" }}>{entry.rating}/10</span>
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setPreviewEntry(entry)} title="Visualiser cette version"
                    style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Icon name="forward" size={14} color="var(--text2)" />
                  </button>
                  <button onClick={() => setDeleteTarget(entry)} title="Supprimer"
                    style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Icon name="trash" size={13} color="var(--red)" />
                  </button>
                </div>
              </div>
              {entry.notes && <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55, margin: "8px 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{entry.notes}</p>}
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

      {/* Prévisualisation du snapshot */}
      {previewEntry && (
        <SnapshotPreview entry={previewEntry} onRestore={doRestore} onClose={() => setPreviewEntry(null)} />
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
