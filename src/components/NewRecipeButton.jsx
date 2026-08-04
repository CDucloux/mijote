import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── BOUTON « NOUVELLE » (choix : import IA par lien/photo — admin — ou saisie) ─
// Le sélecteur est visible par tous ; les imports IA (réservés aux admins) mènent
// à leurs pages dédiées (/recipes/import-from-url, /recipes/import-from-picture).

// Pastille « IA » : pastille orange, anneau blanc fin (net dans les deux
// thèmes) et un petit robot blanc (yeux évidés couleur pastille), centré.
function AiBadge() {
  return (
    <span title="Extraction par IA" style={{ position: "absolute", top: -6, right: -6, display: "grid", placeItems: "center", width: 21, height: 21, borderRadius: "50%", background: "var(--accent)", border: "1.5px solid rgba(255,255,255,0.92)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
        {/* antenne */}
        <rect x="11" y="2" width="2" height="3.4" rx="1" fill="#fff" />
        <circle cx="12" cy="2.4" r="2" fill="#fff" />
        {/* tête */}
        <rect x="4" y="7" width="16" height="12" rx="4" fill="#fff" />
        {/* yeux + bouche évidés */}
        <circle cx="9" cy="12.6" r="1.9" fill="var(--accent)" />
        <circle cx="15" cy="12.6" r="1.9" fill="var(--accent)" />
        <rect x="9" y="16" width="6" height="1.6" rx="0.8" fill="var(--accent)" />
      </svg>
    </span>
  );
}

// Ligne-option du sélecteur (empilées verticalement). `accent` = import IA.
// `disabled` grise l'option et affiche `note` (raison), sans être cliquable.
function Choice({ icon, title, subtitle, onClick, accent, ai, disabled, note }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} className={disabled ? "" : "pressable"} style={{
      display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
      padding: "14px 15px", borderRadius: 16,
      background: accent && !disabled ? "linear-gradient(100deg, rgba(232,112,58,0.13), var(--surface2) 75%)" : "var(--surface2)",
      border: `1px solid ${accent && !disabled ? "rgba(232,112,58,0.38)" : "var(--border)"}`,
    }}>
      <span style={{ position: "relative", flexShrink: 0 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", background: accent ? "rgba(232,112,58,0.2)" : "var(--surface3)" }}>
          <Icon name={icon} size={21} color={accent ? "var(--accent)" : "var(--text2)"} />
        </span>
        {ai && <AiBadge />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>{title}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", lineHeight: 1.4, marginTop: 3 }}>{subtitle}</span>
        {note && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "var(--accent)", marginTop: 6 }}><Icon name="info" size={12} color="var(--accent)" /> {note}</span>}
      </span>
      <Icon name="forward" size={16} color="var(--text3)" />
    </button>
  );
}

export function NewRecipeButton({ onManual }) {
  const { isAdmin } = useAppShell();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const goImport = (path) => { setOpen(false); navigate(path); };
  const goManual = () => { setOpen(false); onManual(); };
  const aiNote = !isAdmin ? "Import par IA en accès limité pour le moment" : undefined;

  return (
    <>
      <button className="btn btn-primary btn-pill" onClick={() => setOpen(true)}>
        <Icon name="plus" size={17} /> Nouvelle
      </button>

      {open && (
        // Les choix naviguent IMMÉDIATEMENT (pas de `close(cb)` qui attendrait la
        // sortie de la feuille) : la page cible glisse par-dessus, ce qui supprime
        // le petit temps mort ressenti avant. La feuille se démonte avec la vue.
        <SwipeableSheet onClose={() => setOpen(false)}>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 4px" }}>Nouvelle recette</h3>
          <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "0 0 18px" }}>Comment veux-tu la créer ?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Choice icon="link" accent ai disabled={!isAdmin} note={aiNote} title="Importer depuis un lien" subtitle="Colle une URL : l'IA extrait et met en forme la recette." onClick={() => goImport("/recipes/import-from-url")} />
            <Choice icon="photo" accent ai disabled={!isAdmin} note={aiNote} title="Importer une photo" subtitle="Photographie une recette de livre, jusqu'à 2 pages." onClick={() => goImport("/recipes/import-from-picture")} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500 }}>ou</span>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <Choice icon="edit" title="Écrire la recette" subtitle="Saisis les ingrédients et les étapes toi-même." onClick={goManual} />
          </div>
        </SwipeableSheet>
      )}
    </>
  );
}
