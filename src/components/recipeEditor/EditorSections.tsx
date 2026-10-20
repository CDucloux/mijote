import { useState, useRef, useEffect, type ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon.jsx";
import { IngImage } from "../ui/Img.jsx";
import { BaseIcon } from "../ui/BaseIcon.jsx";
import type { RecipeYield } from "@/lib/types.js";

// Section encore vide (« Pour la pâte »…) : même en-tête en ligne qu'une section
// remplie, suivi de ses boutons d'ajout. Pas de carte : une section vide ne doit
// pas se distinguer visuellement d'une section qui a déjà ses éléments.
interface SectionProps {
  name: string;
  onRename: (name: string) => void;
  onDelete: () => void;
}

export function SectionCard({ name, onRename, onDelete, children }: SectionProps & { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <EditorSectionHeader name={name} onRename={onRename} onDelete={onDelete} />
      {children}
    </div>
  );
}

// En-tête de section EN LIGNE (liste à plat) : nom renommable (clic) + dissolution.
// Les items suivent directement dessous dans le flux (pas de carte englobante).
export function EditorSectionHeader({ name, onRename, onDelete }: SectionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(name); }, [name]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);
  const commit = () => { setEditing(false); onRename(draft); };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
      <Icon name="layers" size={15} color="var(--accent)" />
      {editing ? (
        <input ref={inputRef} className="field-input" value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { setDraft(name); setEditing(false); } }}
          style={{ marginBottom: 0, flex: 1, minWidth: 0, height: 32, fontSize: 14, fontWeight: 600 }} />
      ) : (
        <button type="button" onClick={() => setEditing(true)} style={{ minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "text", padding: 0, fontFamily: "var(--ff-display)", fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</button>
      )}
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <button type="button" onClick={onDelete} title="Dissoudre la section" className="hover-neutral"
        style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", background: "transparent", border: "none", display: "grid", placeItems: "center", cursor: "pointer" }}>
        <Icon name="eraser" size={13} color="var(--text3)" />
      </button>
    </div>
  );
}

// Bouton « Nouvelle section » : filet de coupe titré, distinct des boutons d'ajout
// d'ingrédient / d'étape. Au clic, il laisse place à la saisie du nom.
export function NewSectionButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  const close = () => { setDraft(""); setOpen(false); };
  const submit = () => { const t = draft.trim(); if (t) { onAdd(t); close(); } };
  // Repos : un filet de coupe titré, pas une carte. Une section découpe la liste,
  // l'affordance le dit littéralement (« couper ici ») sans rien teinter.
  if (!open) return (
    <button type="button" className="section-cut" onClick={() => setOpen(true)}>
      <span className="section-cut-label"><Icon name="plus" size={13} color="currentColor" /> Nouvelle section</span>
    </button>
  );
  // Saisie : le nom s'écrit à la place du libellé, au gabarit d'un en-tête de section.
  return (
    <div className="section-cut-form">
      <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") close(); }}
        onBlur={() => { if (!draft.trim()) close(); }}
        placeholder="Nom de la section, ex. La pâte" aria-label="Nom de la nouvelle section"
        className="field-input field-soft" style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 12, background: "var(--surface)" }} />
      <button type="button" className="btn btn-primary btn-pill btn-sm" onMouseDown={e => e.preventDefault()} onClick={submit} disabled={!draft.trim()}>Créer</button>
      <button type="button" className="section-cut-cancel" onMouseDown={e => e.preventDefault()} onClick={close} aria-label="Annuler"><Icon name="close" size={14} color="currentColor" /></button>
    </div>
  );
}

// Barre d'ajout d'une zone d'ingrédients (principale ou section) : le choix est
// toujours présenté, ajouter un ingrédient brut OU assigner une préparation de base.
// `canBase` = false uniquement quand on édite soi-même un composant (mono-niveau v1).
/** Préparation de base proposée à l'ajout, avec l'action qui l'insère. */
export interface ComponentChoice {
  id: string | undefined;
  name: string | undefined;
  image: string | undefined;
  yield: RecipeYield | undefined;
  onPick: () => void;
}

interface SectionAddBarProps {
  onAddIngredient: () => void;
  components: ComponentChoice[];
  canBase?: boolean;
}

export function SectionAddBar({ onAddIngredient, components, canBase = true }: SectionAddBarProps) {
  const [picking, setPicking] = useState(false);
  if (picking) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px 2px" }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text3)" }}>Assigner une préparation de base</span>
          <button type="button" onClick={() => setPicking(false)} style={{ fontSize: 11.5, color: "var(--text3)", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="close" size={11} color="var(--text3)" /> Annuler</button>
        </div>
        {components.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", padding: "10px 0", lineHeight: 1.5 }}>Aucune base disponible.<br />Crée d'abord une recette en « préparation de base ».</p>
        ) : components.map(comp => (
          <button key={comp.id} onClick={() => { comp.onPick(); setPicking(false); }} className="complete-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", textAlign: "left", cursor: "pointer" }}>
            {comp.image
              ? <IngImage src={comp.image} alt="" size={36} cover />
              : <span style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "var(--surface2)" }}><BaseIcon size={17} color="var(--text3)" /></span>}
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{comp.name}</span>
            {comp.yield?.amount ? <span style={{ fontSize: 11.5, color: "var(--text3)", flexShrink: 0 }}>{comp.yield.amount} {comp.yield.unit}</span> : null}
            <span className="complete-add" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.12)", color: "var(--accent)" }}><Icon name="plus" size={15} color="currentColor" /></span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button className="editor-add" onClick={onAddIngredient} style={{ flex: 1 }}><Icon name="plus" size={16} /> Ingrédient</button>
      {canBase && <button className="editor-add" onClick={() => setPicking(true)} style={{ flex: 1 }}><BaseIcon size={14} /> Base</button>}
    </div>
  );
}

// Pill de classement (type de recette / style de cuisine). Fond, liseré et survol
// desktop vivent dans `.classement-pill` (cf. global.css) ; l'état retenu est porté
// par `data-active`.
export function ClassementPill({ active, emoji, label, onClick }: { active: boolean; emoji: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="classement-pill pressable" data-active={active ? "1" : undefined}>
      <span style={{ fontSize: 14, lineHeight: 1 }}>{emoji}</span>{label}
    </button>
  );
}

/** Petit en-tête de sous-section : pastille d'icône, libellé, complément à droite. */
export function EditorHead({ icon, label, extra }: { icon: IconName; label: string; extra?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 2 }}>
      <span style={{ width: 24, height: 24, borderRadius: 7, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name={icon} size={13} color="var(--accent)" /></span>
      <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text2)" }}>{label}</span>
      {extra}
    </div>
  );
}
