import { useCallback, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { NotebookCover } from "./NotebookCover.jsx";
import { activeFilterCount, summarizeFilters, DEFAULT_FILTERS } from "@/lib/recipes/recipeFilters.js";
import { NOTEBOOK_COLORS, NOTEBOOK_ICONS, type NotebookDraft } from "@/lib/recipes/notebooks.js";

interface NotebookEditorSheetProps {
  draft: NotebookDraft;
  setDraft: Dispatch<SetStateAction<NotebookDraft | null>>;
  /** Recettes que compterait la vue d'un nouveau carnet intelligent. */
  smartCount: number;
  /** Rouvre la feuille de filtres sur la vue du carnet intelligent modifié. */
  onEditFilters: () => void;
  onSave: () => void;
  onClose: () => void;
}

const statPill: CSSProperties = { display: "inline-flex", alignItems: "baseline", gap: 6, padding: "7px 14px", borderRadius: 999, background: "var(--surface2)", fontSize: 12.5, fontWeight: 600, color: "var(--text3)" };
const statValue: CSSProperties = { fontSize: 15, fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums" };

/** Création ou modification d'un carnet, avec aperçu en direct de sa couverture. */
export function NotebookEditorSheet({ draft, setDraft, smartCount, onEditFilters, onSave, onClose }: NotebookEditorSheetProps) {
  const patch = (p: Partial<NotebookDraft>) => setDraft(d => (d ? { ...d, ...p } : d));
  // Focus sans scroll (pointeur fin seulement) : la page ne « saute » pas à l'ouverture.
  const focusNoScroll = useCallback((el: HTMLInputElement | null) => {
    if (el && window.matchMedia?.("(pointer: fine)").matches) el.focus({ preventScroll: true });
  }, []);
  const isSmartEdit = !!draft.editing && draft.kind === "smart";
  const nCrit = activeFilterCount({ ...DEFAULT_FILTERS, ...draft.filters }) + (draft.search?.trim() ? 1 : 0);
  const chips = isSmartEdit ? summarizeFilters(draft.filters, draft.search) : [];
  const title = draft.editing ? "Modifier le carnet" : draft.smart ? "Enregistrer la vue" : "Nouveau carnet";

  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (<>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 16 }}>{title}</h3>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ width: 122, position: "relative", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 0 0 1px var(--border)", animation: "popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>
            <NotebookCover color={draft.color} icon={draft.icon} lineGap={23} spine={10} iconSize={40} />
            <div style={{ padding: "8px 10px 10px", background: "var(--surface)", borderTop: `1px solid ${draft.color}22` }}>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: draft.name.trim() ? "var(--text)" : "var(--text3)" }}>{draft.name.trim() || "Mon carnet"}</div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{(draft.smart || draft.kind === "smart") ? "Intelligent" : "Manuel"}</div>
            </div>
          </div>
        </div>

        {draft.smart && (
          <div style={{ marginTop: -6, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 12, fontSize: 12.5, color: "var(--text3)" }}>
              <Icon name="sparkle" size={14} color="var(--accent)" />
              <span>Se remplit tout seul selon tes filtres</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={statPill}><span style={statValue}>{nCrit}</span> critère{nCrit > 1 ? "s" : ""}</span>
              <span style={statPill}><span style={statValue}>{smartCount}</span> recette{smartCount > 1 ? "s" : ""}</span>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div className="field-label" style={{ marginBottom: 7 }}>Nom</div>
          <input className="field-input field-bare" placeholder={draft.smart ? "ex: Desserts rapides" : "ex: Recettes de Mamie"} value={draft.name} ref={focusNoScroll} onChange={e => patch({ name: e.target.value })} />
        </div>

        <div className="field-label" style={{ marginBottom: 9 }}>Couleur</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          {NOTEBOOK_COLORS.map(c => {
            const on = draft.color === c;
            return (
              <button key={c} onClick={() => patch({ color: c })} aria-label={`Couleur ${c}`} aria-pressed={on} className="pressable nb-swatch"
                style={{ "--swatch": c, width: 34, height: 34, borderRadius: "50%", background: c, border: "none", cursor: "pointer", display: "grid", placeItems: "center" } as CSSProperties}>
                {on && <Icon name="check" size={16} color="#fff" />}
              </button>
            );
          })}
        </div>

        <div className="field-label" style={{ marginBottom: 9 }}>Icône</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 8, marginBottom: 18 }}>
          {NOTEBOOK_ICONS.map(ico => {
            const on = draft.icon === ico;
            return (
              <button key={ico} onClick={() => patch({ icon: ico })} aria-pressed={on} className="pressable hover-neutral nb-ico"
                style={{ aspectRatio: "1/1", borderRadius: 12, fontSize: 21, display: "grid", placeItems: "center", cursor: "pointer",
                  background: on ? draft.color + "22" : "var(--surface2)",
                  border: `2px solid ${on ? draft.color : "transparent"}`,
                  transition: "background 0.15s ease, border-color 0.15s ease" }}><span>{ico}</span></button>
            );
          })}
        </div>

        {isSmartEdit && (
          <div style={{ marginBottom: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span className="field-label" style={{ margin: 0 }}>Filtres de la vue</span>
              <button onClick={onEditFilters} className="pressable" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <Icon name="edit" size={13} color="var(--accent)" /> Modifier
              </button>
            </div>
            {chips.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {chips.map((c, i) => <span key={i} style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 20, background: "rgba(var(--accent-rgb),0.12)", color: "var(--accent)" }}>{c}</span>)}
              </div>
            ) : (
              <button onClick={onEditFilters} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", borderRadius: 12, background: "var(--surface2)", border: "1px dashed var(--border)", color: "var(--text3)", fontSize: 12.5, cursor: "pointer", textAlign: "left" }}>
                <Icon name="plus" size={14} color="var(--accent)" /> Aucun filtre : ce carnet montre toutes les recettes. Ajoute des critères.
              </button>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}><Icon name="undo" size={15} /> Annuler</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { if (draft.name.trim()) onSave(); }}>
            <Icon name={draft.editing || draft.smart ? "save" : "plus"} size={15} /> {draft.editing || draft.smart ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
