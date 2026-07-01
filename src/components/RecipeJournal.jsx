import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { AutoResizeTextarea } from "./AutoResizeTextarea.jsx";
import { addVersion, deleteVersion, nextVersionLabel, snapshotOf, diffSnapshots } from "../lib/history.js";
import { useAppShell } from "../context/AppShellContext.jsx";

const fmtDate = iso => {
  try {
    return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

function MiniAvatar({ user, size = 28 }) {
  if (!user) return null;
  return user.photoURL
    ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, border: "1.5px solid var(--border)" }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{(user.displayName || "?")[0].toUpperCase()}</div>;
}

const VersionBadge = ({ label }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800, color: "var(--bg)", background: "var(--text)", borderRadius: 8, padding: "3px 9px 3px 6px", flexShrink: 0 }}>
    <Icon name="history" size={11} color="var(--bg)" />
    {label}
  </span>
);

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

// Couleurs des trois états de diff.
const DIFF = {
  added: { bg: "rgba(76,175,125,0.12)", border: "var(--green)", text: "var(--green)", sign: "+" },
  removed: { bg: "rgba(224,82,82,0.1)", border: "var(--red)", text: "var(--red)", sign: "−" },
  changed: { bg: "rgba(240,153,42,0.12)", border: "var(--orange)", text: "var(--orange)", sign: "~" },
};

const DiffRow = ({ sign, text, bg, border, children }) => (
  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 12px", background: bg, borderLeft: `3px solid ${border}`, borderRadius: "0 8px 8px 0" }}>
    <span style={{ fontSize: 13, fontWeight: 800, color: text, flexShrink: 0, width: 12, fontFamily: "monospace", lineHeight: 1.45 }}>{sign}</span>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

const DiffSection = ({ title, children }) => (
  <div>
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{title}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
  </div>
);

// Vue « git diff » entre un snapshot de base et le snapshot affiché.
function DiffView({ diff, baseLabel }) {
  if (!diff.hasChanges) {
    return <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.6, padding: "24px 0", textAlign: "center" }}>Aucune différence avec <strong style={{ color: "var(--text2)" }}>{baseLabel}</strong>.</p>;
  }
  return (
    <div style={{ overflowY: "auto", maxHeight: "62vh", display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 12, color: "var(--text3)", margin: 0 }}>Différences par rapport à <strong style={{ color: "var(--text2)" }}>{baseLabel}</strong></p>

      {diff.scalars.length > 0 && (
        <DiffSection title="Temps & portions">
          {diff.scalars.map((s, i) => {
            const c = DIFF.changed;
            return (
              <DiffRow key={i} sign={c.sign} text={c.text} bg={c.bg} border={c.border}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.label} : </span>
                <span style={{ fontSize: 13, color: "var(--text3)", textDecoration: "line-through" }}>{s.from}</span>
                <span style={{ fontSize: 13, color: "var(--text3)" }}> → </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{s.to}</span>
              </DiffRow>
            );
          })}
        </DiffSection>
      )}

      {diff.ingredients.some(i => i.type !== "same") && (
        <DiffSection title="Ingrédients">
          {diff.ingredients.filter(i => i.type !== "same").map((ing, i) => {
            const c = DIFF[ing.type];
            return (
              <DiffRow key={i} sign={c.sign} text={c.text} bg={c.bg} border={c.border}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{ing.name}</span>
                {ing.type === "changed" ? (
                  <span> <span style={{ fontSize: 12, color: "var(--text3)", textDecoration: "line-through" }}>{ing.from || "–"}</span>
                  <span style={{ fontSize: 12, color: "var(--text3)" }}> → </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{ing.to || "–"}</span></span>
                ) : ing.qty ? <span style={{ fontSize: 12, color: "var(--text3)", marginLeft: 6 }}>{ing.qty}</span> : null}
              </DiffRow>
            );
          })}
        </DiffSection>
      )}

      {diff.utensils.some(u => u.type !== "same") && (
        <DiffSection title="Ustensiles">
          {diff.utensils.filter(u => u.type !== "same").map((ut, i) => {
            const c = DIFF[ut.type];
            return (
              <DiffRow key={i} sign={c.sign} text={c.text} bg={c.bg} border={c.border}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{ut.name}</span>
              </DiffRow>
            );
          })}
        </DiffSection>
      )}

      {diff.steps.some(s => s.type !== "same") && (
        <DiffSection title="Étapes">
          {diff.steps.filter(s => s.type !== "same").map((step, i) => {
            const c = DIFF[step.type];
            return (
              <DiffRow key={i} sign={c.sign} text={c.text} bg={c.bg} border={c.border}>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.text }}>Étape {step.index + 1}</span>
                {step.type === "changed" ? (
                  <div style={{ marginTop: 4 }}>
                    <p style={{ fontSize: 12.5, color: "var(--text3)", margin: 0, textDecoration: "line-through", lineHeight: 1.5 }}>{step.from}</p>
                    <p style={{ fontSize: 12.5, color: "var(--text)", margin: "3px 0 0", lineHeight: 1.5 }}>{step.to}</p>
                  </div>
                ) : (
                  <p style={{ fontSize: 12.5, color: "var(--text2)", margin: "3px 0 0", lineHeight: 1.5 }}>{step.description}</p>
                )}
              </DiffRow>
            );
          })}
        </DiffSection>
      )}
    </div>
  );
}

// Comparaison d'une version : diff « git » par rapport à une base au choix.
function VersionDiff({ entry, recipe, onClose }) {
  const { user } = useAppShell();
  const s = entry.snapshot || {};

  // Bases comparables : versions chronologiques (sauf celle affichée) + recette actuelle.
  const chronological = recipe.history || [];
  const myIdx = chronological.findIndex(h => h.id === entry.id);
  const prev = myIdx > 0 ? chronological[myIdx - 1] : null;
  const baseOptions = [
    { id: "__current__", label: "Recette actuelle", snapshot: snapshotOf(recipe) },
    ...chronological.filter(h => h.id !== entry.id).map(h => ({ id: h.id, label: h.label, snapshot: h.snapshot })),
  ];
  const [baseId, setBaseId] = useState(prev ? prev.id : "__current__");
  const baseOpt = baseOptions.find(o => o.id === baseId) || baseOptions[0];
  const diff = diffSnapshots(baseOpt.snapshot, s);

  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "90dvh" }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <VersionBadge label={entry.label} />
        <span style={{ fontSize: 12, color: "var(--text3)" }}>{fmtDate(entry.createdAt)}</span>
        {entry.rating != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: ratingColor(entry.rating), borderRadius: 8, padding: "2px 8px" }}>{entry.rating}/10</span>
        )}
      </div>

      {entry.notes && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
          <MiniAvatar user={user} size={30} />
          <div style={{ flex: 1, minWidth: 0, background: "var(--surface2)", borderLeft: "3px solid var(--accent)", borderRadius: "0 10px 10px 0", padding: "10px 14px" }}>
            <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, margin: 0, fontStyle: "italic", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              <span style={{ fontSize: 20, color: "var(--accent)", lineHeight: 0, verticalAlign: "-0.25em", marginRight: 5, fontStyle: "normal" }}>«</span>
              {entry.notes}
              <span style={{ fontSize: 20, color: "var(--accent)", lineHeight: 0, verticalAlign: "-0.25em", marginLeft: 5, fontStyle: "normal" }}>»</span>
            </p>
          </div>
        </div>
      )}

      {/* Sélecteur de base */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text2)", flexShrink: 0 }}>Comparer à</span>
        <select value={baseId} onChange={e => setBaseId(e.target.value)} className="field-input"
          style={{ flex: 1, marginBottom: 0, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>
          {baseOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>

      <DiffView diff={diff} baseLabel={baseOpt.label} />
    </SwipeableSheet>
  );
}

export function RecipeJournal({ recipe, onUpdateRecipe }) {
  const history = [...(recipe.history || [])].reverse();
  const [showForm, setShowForm] = useState(false);
  const [formLabel, setFormLabel] = useState("");
  const [rating, setRating] = useState(null);
  const [notes, setNotes] = useState("");
  const [diffEntry, setDiffEntry] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { user } = useAppShell();

  const openForm = () => {
    setFormLabel(nextVersionLabel(recipe.history));
    setRating(null);
    setNotes("");
    setShowForm(true);
  };

  const saveVersion = () => {
    onUpdateRecipe(addVersion(recipe, { label: formLabel, rating, notes }));
    setShowForm(false);
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
          Aucune itération enregistrée. À chaque fois que tu retravailles cette recette, fige une version : ce que tu as changé, le résultat à la dégustation et une note. Tu pourras comparer les versions entre elles pour voir précisément ce qui a évolué.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {history.map((entry, idx) => {
            const isLast = idx === history.length - 1;
            return (
              <div key={entry.id} style={{ display: "flex", gap: 0 }}>
                {/* Timeline */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0, paddingTop: 2 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--bg)", flexShrink: 0, zIndex: 1 }} />
                  {!isLast && <div style={{ flex: 1, width: 2, background: "var(--border)", marginTop: 2 }} />}
                </div>
                {/* Card */}
                <div style={{ flex: 1, minWidth: 0, marginBottom: isLast ? 0 : 14 }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 5, marginTop: 0, lineHeight: 1 }}>{fmtDate(entry.createdAt)}</div>
                  <div style={{ background: "var(--surface)", borderRadius: 14, padding: 14, border: "1px solid var(--border)", cursor: "pointer" }}
                    onClick={() => setDiffEntry(entry)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <VersionBadge label={entry.label} />
                      {entry.rating != null && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: ratingColor(entry.rating), borderRadius: 8, padding: "2px 8px" }}>{entry.rating}/10</span>
                      )}
                      {entry.notes && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 2 }}>
                          <MiniAvatar user={user} size={20} />
                          <span style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>{entry.notes}</span>
                        </div>
                      )}
                      <div style={{ marginLeft: "auto", display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setDiffEntry(entry)} title="Comparer cette version"
                          style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <Icon name="forward" size={13} color="var(--text2)" />
                        </button>
                        <button onClick={() => setDeleteTarget(entry)} title="Supprimer"
                          style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <Icon name="trash" size={12} color="var(--red)" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Feuille de création de version */}
      {showForm && (
        <SwipeableSheet onClose={() => setShowForm(false)} style={{ maxHeight: "88dvh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>Figer une version</h3>
            <VersionBadge label={formLabel} />
          </div>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>L'état actuel de la recette (ingrédients, ustensiles, étapes, temps) est enregistré tel quel.</p>

          <div className="field-label">Note du résultat (optionnel)</div>
          <div style={{ marginBottom: 16 }}><RatingPicker value={rating} onChange={setRating} /></div>

          <div className="field-label">Notes de dégustation</div>
          <AutoResizeTextarea className="field-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="ex : -10 g de sucre, +zeste de citron vert, cuit 4 min de moins → meilleur" style={{ marginBottom: 18 }} />

          <button className="btn btn-primary" style={{ width: "100%" }} onClick={saveVersion}>
            <Icon name="check" size={15} /> Enregistrer la version
          </button>
        </SwipeableSheet>
      )}

      {/* Comparaison (diff) */}
      {diffEntry && (
        <VersionDiff entry={diffEntry} recipe={recipe} onClose={() => setDiffEntry(null)} />
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
