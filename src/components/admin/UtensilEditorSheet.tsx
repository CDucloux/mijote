import { useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { Img } from "../ui/Img.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { SheetIdentityHeader } from "../ui/SheetIdentityHeader.jsx";
import { SheetDeleteButton } from "./AdminPrimitives.jsx";
import { ImageUpload } from "../ui/ImageUpload.jsx";
import { UTENSIL_CATEGORIES } from "@/lib/household/dataYaml.js";
import { APPLIANCE_LABELS, isApplianceKey } from "@/lib/utensils/appliances.js";
import { PRECAUTION_TONES, PRECAUTION_LIMITS, isPrecautionTone } from "@/lib/utensils/usagePrecaution.js";
import type { UsagePrecaution, UtensilDbItem } from "@/lib/types.js";

// Précaution d'utilisation (facultative) : conseil éditorial affiché sur la fiche
// et en recette. Vide → non enregistrée (cf. normalizeUtensilDraft).
function PrecautionFields({ value, onChange }: { value: Partial<UsagePrecaution>; onChange: (patch: Partial<UsagePrecaution>) => void }) {
  return (
    <>
      <div className="field-label">Précaution d'utilisation <span style={{ color: "var(--text3)", fontWeight: 400 }}>(facultatif)</span></div>
      <select className="field-input" value={value.tone || "heat"} onChange={e => { if (isPrecautionTone(e.target.value)) onChange({ tone: e.target.value }); }} style={{ marginBottom: 10 }}>
        {Object.entries(PRECAUTION_TONES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      <input className="field-input" placeholder="Titre (ex: Évitez le feu maximum)" maxLength={PRECAUTION_LIMITS.title} value={value.title || ""} onChange={e => onChange({ title: e.target.value })} style={{ marginBottom: 10 }} />
      <textarea className="field-input" placeholder="Description courte (1 à 3 phrases)" rows={3} maxLength={PRECAUTION_LIMITS.description} value={value.description || ""} onChange={e => onChange({ description: e.target.value })} style={{ marginBottom: 10, resize: "vertical" }} />
      <input className="field-input" placeholder="Bon réflexe (facultatif)" maxLength={PRECAUTION_LIMITS.tip} value={value.tip || ""} onChange={e => onChange({ tip: e.target.value })} style={{ marginBottom: 14 }} />
    </>
  );
}

interface UtensilEditorSheetProps {
  initial: UtensilDbItem;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (draft: UtensilDbItem) => void;
  /** Ustensile existant : suppression (la feuille se ferme avant la confirmation). */
  onDelete?: () => void;
}

/**
 * Éditeur d'un ustensile : même en-tête que la feuille de geste ; la photo, posée
 * sur blanc comme dans la grille, tient lieu d'icône une fois choisie.
 */
export function UtensilEditorSheet({ initial, isAdmin, onClose, onSave, onDelete }: UtensilEditorSheetProps) {
  const [draft, setDraft] = useState<UtensilDbItem>(initial);
  const patch = (p: Partial<UtensilDbItem>) => setDraft(d => ({ ...d, ...p }));
  // Brouillon : titre et description peuvent rester vides le temps de la saisie.
  const [precaution, setPrecaution] = useState<Partial<UsagePrecaution>>(initial.usagePrecaution || {});
  const category = draft.category || "divers";
  const applianceLabel = draft.category === "appareils" && isApplianceKey(draft.appliance) ? APPLIANCE_LABELS[draft.appliance] : null;
  const save = () => onSave({ ...draft, usagePrecaution: { title: "", description: "", ...precaution } });
  return (
    <SwipeableSheet onClose={onClose} hideHandle style={{ paddingTop: 0 }}>
      {(close) => (<>
        <SheetIdentityHeader
          media={draft.image
            ? <Img src={draft.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6, boxSizing: "border-box" }} />
            : <Icon name="utensils" size={25} color="var(--accent)" />}
          mediaBackground={draft.image ? "#fff" : "rgba(var(--accent-rgb),0.14)"}
          title={draft.name?.trim() || (draft.id ? "Modifier l'ustensile" : "Nouvel ustensile")}
          chip={UTENSIL_CATEGORIES[category] || UTENSIL_CATEGORIES.divers} chipColor="var(--accent)"
          extra={applianceLabel && <span style={{ fontSize: 12, color: "var(--text3)" }}>{applianceLabel}</span>} />
        <div className="field-label">Nom</div>
        <input className="field-input" placeholder="ex: Casserole" value={draft.name || ""} onChange={e => patch({ name: e.target.value })} style={{ marginBottom: 12 }} />
        <div className="field-label">Catégorie</div>
        {/* Quitter la famille « appareils » retire le type d'appareil : les réglages
            d'étape n'ont de sens que pour un appareil (pas de schéma orphelin). */}
        <select className="field-input" value={category} onChange={e => { const next = e.target.value; patch(next === "appareils" ? { category: next } : { category: next, appliance: "" }); }} style={{ marginBottom: 12 }}>
          {Object.entries(UTENSIL_CATEGORIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        {/* Type d'appareil : contextuel à la famille « appareils ». Il précise QUEL
            schéma de réglages (four ≠ blender ≠ cuiseur) exposer au niveau étape. */}
        {draft.category === "appareils" && (<>
          <div className="field-label">Type d'appareil (réglages par étape)</div>
          <select className="field-input" value={draft.appliance || ""} onChange={e => patch({ appliance: e.target.value })} style={{ marginBottom: 12 }}>
            <option value="">Aucun réglage</option>
            {Object.entries(APPLIANCE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </>)}
        <div className="field-label">Photo</div>
        <ImageUpload value={draft.image} onChange={v => patch({ image: v })} style={{ marginBottom: 14, height: 100 }} pathPrefix={isAdmin ? "master/utensils" : "utensils"} />
        <PrecautionFields value={precaution} onChange={p => setPrecaution(cur => ({ ...cur, ...p }))} />
        <div style={{ display: "flex", gap: 10 }}>
          {onDelete && <SheetDeleteButton onClick={() => close(onDelete)} />}
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}><Icon name="undo" size={15} /> Annuler</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save}><Icon name="save" size={15} /> Sauvegarder</button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
