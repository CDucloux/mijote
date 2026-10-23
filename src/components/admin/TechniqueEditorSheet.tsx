import { useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { SheetIdentityHeader } from "../ui/SheetIdentityHeader.jsx";
import { SheetDeleteButton } from "./AdminPrimitives.jsx";
import { TagInput } from "../ui/TagInput.jsx";
import { difficultyColor, DIFFICULTY_LABEL } from "./techniqueDifficulty.js";
import { TECHNIQUE_CATEGORIES } from "@/lib/household/dataYaml.js";
import type { TechniqueDraft } from "@/lib/household/dataYaml.js";
import { techniqueVisual } from "@/lib/recipes/techniqueDisplay.js";
import type { TechniqueConfusion, TechniqueEntry } from "@/lib/recipes/techniques.js";

// Intitulé de section dans l'éditeur de geste : capitales espacées. Coloré par
// catégorie (résultat attendu) ou en rouge (erreurs) pour épouser la fiche
// détaillée affichée en recette, repli neutre sinon.
const EDIT_LABEL_RED = "var(--red, #d1544f)";
const sectionLabel = (color?: string) => ({ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: color || "var(--text3)", margin: "18px 0 8px" });
const editLabel = sectionLabel();

function RemoveButton({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} title="Retirer" className="ripple" style={{ color: "var(--text3)", padding: 8, flexShrink: 0, borderRadius: 10 }}><Icon name="trash" size={14} /></button>;
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button className="btn btn-ghost btn-sm" onClick={onClick} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6 }}><Icon name="plus" size={13} /> {label}</button>;
}

// Éditeur d'une liste de phrases (indicateurs observables, erreurs fréquentes) :
// une ligne par entrée, ajout/retrait, sans champ vide imposé.
function PhraseListEditor({ items, onChange, placeholder, addLabel }: { items: string[]; onChange: (items: string[]) => void; placeholder: string; addLabel: string }) {
  const setAt = (i: number, v: string) => onChange(items.map((it, k) => (k === i ? v : it)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input className="field-input field-bare" value={it} placeholder={placeholder} onChange={e => setAt(i, e.target.value)} style={{ flex: 1, marginBottom: 0 }} />
          <RemoveButton onClick={() => onChange(items.filter((_, k) => k !== i))} />
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, ""])} label={addLabel} />
    </div>
  );
}

// Éditeur des confusions (« ne pas confondre avec ») : une technique cible + la
// distinction qui les sépare, par carte.
function ConfusionListEditor({ items, onChange, options }: { items: TechniqueConfusion[]; onChange: (items: TechniqueConfusion[]) => void; options: TechniqueEntry[] }) {
  const setAt = (i: number, patch: Partial<TechniqueConfusion>) => onChange(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, background: "var(--surface2)", borderRadius: 14 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select className="field-input field-bare" value={it.technique_id || ""} onChange={e => setAt(i, { technique_id: e.target.value })} style={{ flex: 1, marginBottom: 0, backgroundColor: "var(--surface)" }}>
              <option value="">Choisir un geste…</option>
              {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <RemoveButton onClick={() => onChange(items.filter((_, k) => k !== i))} />
          </div>
          <input className="field-input field-bare" value={it.distinction || ""} placeholder="En quoi ce geste s'en distingue…" onChange={e => setAt(i, { distinction: e.target.value })} style={{ marginBottom: 0, backgroundColor: "var(--surface)" }} />
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, { technique_id: "", distinction: "" }])} label="Ajouter une confusion" />
    </div>
  );
}

function DifficultyPicker({ value, onChange }: { value?: number; onChange: (level: number | undefined) => void }) {
  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        {[1, 2, 3, 4, 5].map(n => {
          const on = value === n;
          return (
            <button key={n} className="ripple" onClick={() => onChange(on ? undefined : n)}
              style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: on ? difficultyColor(n) : "var(--surface2)", color: on ? "#fff" : "var(--text2)", border: "none" }}>{n}</button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>{value ? DIFFICULTY_LABEL[value] : "Non définie (clique un chiffre ; re-clique pour effacer)."}</div>
    </>
  );
}

interface TechniqueEditorSheetProps {
  initial: TechniqueDraft;
  techniques: TechniqueEntry[];
  onClose: () => void;
  onSave: (draft: TechniqueDraft) => void;
  /** Geste existant : suppression (la feuille se ferme avant la confirmation). */
  onDelete?: () => void;
}

/**
 * Éditeur d'un geste technique (admin). L'en-tête est calqué sur la fiche
 * détaillée (TechniqueDetailSheet) pour que la saisie reflète l'affichage en recette.
 */
export function TechniqueEditorSheet({ initial, techniques, onClose, onSave, onDelete }: TechniqueEditorSheetProps) {
  const [draft, setDraft] = useState<TechniqueDraft>(initial);
  const patch = (p: Partial<TechniqueDraft>) => setDraft(d => ({ ...d, ...p }));
  const options = techniques.filter(t => t.id !== draft.id).sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const vis = techniqueVisual(draft.category);
  const diff = Number(draft.difficulty) || 0;
  const expected = draft.expected_result || {};
  return (
    <SwipeableSheet onClose={onClose} hideHandle style={{ paddingTop: 0 }}>
      {(close) => (<>
        <SheetIdentityHeader
          media={<Icon name={vis.icon} size={27} color={vis.color} />}
          mediaBackground={`color-mix(in srgb, ${vis.color} 16%, transparent)`}
          title={draft.name?.trim() || (draft.id ? "Modifier le geste" : "Nouveau geste")}
          chip={TECHNIQUE_CATEGORIES[draft.category || ""] || "Préparation"} chipColor={vis.color}
          extra={diff > 0 && (
            <span title={`Difficulté ${diff}/5`} style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
              {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= diff ? vis.color : "var(--surface3)" }} />)}
            </span>
          )} />
        <div className="field-label">Nom</div>
        <input className="field-input field-bare" placeholder="ex: Émulsionner" value={draft.name || ""} onChange={e => patch({ name: e.target.value })} style={{ marginBottom: 12 }} />
        <div className="field-label">Catégorie</div>
        <select className="field-input field-bare" value={draft.category || "preparation"} onChange={e => patch({ category: e.target.value })} style={{ marginBottom: 12 }}>
          {Object.entries(TECHNIQUE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="field-label">Difficulté</div>
        <DifficultyPicker value={draft.difficulty} onChange={difficulty => patch({ difficulty })} />
        <div className="field-label">Définition</div>
        <textarea className="field-input field-bare" rows={3} placeholder="Que veut dire ce geste ?" value={draft.definition || ""} onChange={e => patch({ definition: e.target.value })} style={{ marginBottom: 12, resize: "vertical", minHeight: 64 }} />

        <div style={editLabel}>Fait partie de</div>
        <select className="field-input field-bare" value={draft.hierarchy?.parent || ""}
          onChange={e => patch({ hierarchy: e.target.value ? { ...(draft.hierarchy || {}), parent: e.target.value } : undefined })}
          style={{ marginBottom: 4 }}>
          <option value="">Aucun (geste racine)</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>Le geste générique dont celui-ci est une variante (ex : « Ciseler » fait partie de « Hachage »).</div>

        <div style={sectionLabel(vis.color)}>Résultat attendu</div>
        <textarea className="field-input field-bare" rows={2} placeholder="L'état observable après une bonne exécution."
          value={expected.summary || ""}
          onChange={e => patch({ expected_result: { ...expected, summary: e.target.value } })}
          style={{ marginBottom: 8, resize: "vertical", minHeight: 48 }} />
        <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Indicateurs observables</div>
        <PhraseListEditor items={expected.observable_indicators || []}
          onChange={v => patch({ expected_result: { ...expected, observable_indicators: v } })}
          placeholder="ex: Des dés homogènes" addLabel="Ajouter un indicateur" />

        <div style={sectionLabel(EDIT_LABEL_RED)}>Erreurs fréquentes</div>
        <PhraseListEditor items={draft.common_errors || []}
          onChange={v => patch({ common_errors: v })}
          placeholder="ex: Écraser l'aliment" addLabel="Ajouter une erreur" />

        <div style={editLabel}>Ne pas confondre avec</div>
        <ConfusionListEditor items={draft.not_to_be_confused_with || []}
          onChange={v => patch({ not_to_be_confused_with: v })}
          options={options} />

        <div className="field-label" style={{ marginTop: 18 }}>Alias / synonymes</div>
        <div style={{ marginBottom: 12 }}>
          <TagInput tags={draft.aliases || []} onChange={v => patch({ aliases: v })} allTags={[]} label="" placeholder="fouetter, battre…" inputId="tech-alias-input" bare commitOnBlur dedupeInsensitive />
        </div>
        <div className="field-label">Source (optionnel)</div>
        <input className="field-input field-bare" placeholder="ex: Escoffier, Le Guide Culinaire" value={draft.source || ""} onChange={e => patch({ source: e.target.value })} style={{ marginBottom: 16 }} />
        <div style={{ display: "flex", gap: 10 }}>
          {onDelete && <SheetDeleteButton onClick={() => close(onDelete)} />}
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}><Icon name="undo" size={15} /> Annuler</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onSave(draft)}><Icon name="save" size={15} /> Sauvegarder</button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
