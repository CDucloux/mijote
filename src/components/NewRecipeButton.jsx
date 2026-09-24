import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { PlusBadge } from "./PlusBadge.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── BOUTON « NOUVELLE » (choix : import intelligent lien/photo/texte/pdf, ou
// saisie manuelle) ───────────────────────────────────────────────────────────────
// Le sélecteur est visible par tous. L'import intelligent est une fonctionnalité
// Cardamome+ : en plan gratuit ses options portent un badge indicatif mais
// ouvrent quand même leur page dédiée (/recipes/import-from-url | -picture |
// -text | -pdf). Le mur d'offre n'apparaît qu'au moment d'essayer l'import (cf.
// ImportPage) : on laisse d'abord découvrir l'écran, on ne bloque pas l'entrée.

// Petit robot « import intelligent » : glyphe au trait, teintable. Utilisé une seule
// fois, en tête du groupe d'imports (plutôt que répété sur chaque ligne, ce qui
// alourdissait la feuille et lui donnait un air « chargé »).
function RobotGlyph({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="11" y="1.6" width="2" height="3.6" rx="1" fill={color} />
      <circle cx="12" cy="2" r="1.8" fill={color} />
      <rect x="4" y="6.5" width="16" height="12" rx="4.5" stroke={color} strokeWidth="1.8" />
      <circle cx="9.2" cy="12.4" r="1.6" fill={color} />
      <circle cx="14.8" cy="12.4" r="1.6" fill={color} />
      <path d="M9.5 15.8h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Ligne-option du sélecteur (empilées verticalement). `iconAccent` teinte l'icône
// en accent (imports intelligents), sinon en neutre (saisie manuelle).
function Choice({ icon, title, subtitle, onClick, iconAccent }) {
  return (
    <button onClick={onClick} className="pressable nr-choice" style={{
      display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", cursor: "pointer",
      padding: 14, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}>
      <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--surface2)" }}>
        <Icon name={icon} size={22} color={iconAccent ? "var(--accent)" : "var(--text2)"} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.2, letterSpacing: "-0.01em" }}>{title}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", lineHeight: 1.45, marginTop: 3 }}>{subtitle}</span>
      </span>
      <span className="nr-chev" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--surface2)", color: "var(--text3)" }}>
        <Icon name="forward" size={15} color="currentColor" />
      </span>
    </button>
  );
}

/**
 * Feuille de choix « Nouvelle recette » (import intelligent lien/photo/texte/pdf,
 * ou saisie manuelle). Autonome et réutilisable : ouverte par le bouton d'en-tête
 * comme par l'état vide de l'accueil, pour exposer l'import intelligent dès le
 * premier geste (le mur d'offre ne tombe qu'à la tentative d'import).
 *
 * @param onClose - Ferme la feuille.
 * @param onManual - Bascule vers la saisie manuelle.
 */
export function NewRecipeSheet({ onClose, onManual }) {
  const { isPlus } = useAppShell();
  const navigate = useNavigate();

  const goManual = () => { onClose(); onManual(); };
  // Import intelligent : on ouvre TOUJOURS la page dédiée, y compris en plan
  // gratuit. Le blocage (mur d'offre) se joue au moment d'essayer l'import, pas à
  // l'entrée : l'utilisateur découvre d'abord l'écran.
  const goImport = (path) => { onClose(); navigate(path); };
  const plusBadge = !isPlus ? <PlusBadge /> : undefined;

  return (
    // Les choix naviguent IMMÉDIATEMENT (pas de `close(cb)` qui attendrait la
    // sortie de la feuille) : la page cible glisse par-dessus, ce qui supprime
    // le petit temps mort ressenti avant. La feuille se démonte avec la vue.
    <SwipeableSheet onClose={onClose}>
      {/* En-tête : pastille d'icône + titre + sous-titre (cohérent avec les
          autres feuilles retravaillées). */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <span style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
          <Icon name="book" size={20} color="var(--accent)" />
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Nouvelle recette</h3>
          <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "2px 0 0" }}>Comment veux-tu la créer ?</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Groupe « import intelligent » : un seul eyebrow (robot + libellé + un unique
            badge Cardamome+) coiffe les 4 options, au lieu de répéter badge et robot
            sur chaque ligne. Les lignes redeviennent neutres : plus de fond teinté
            ni de halo vert (un glow accent est un tell d'IA banni). */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 2px 2px" }}>
          <RobotGlyph size={16} color="var(--accent)" />
          <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text3)" }}>Import intelligent</span>
          {plusBadge}
        </div>
        <Choice icon="link" iconAccent title="Importer depuis un lien" subtitle="Colle une URL : l'import intelligent extrait et met en forme la recette." onClick={() => goImport("/recipes/import-from-url")} />
        <Choice icon="photo" iconAccent title="Importer une photo" subtitle="Photographie une recette de livre, jusqu'à 2 pages." onClick={() => goImport("/recipes/import-from-picture")} />
        <Choice icon="paste" iconAccent title="Coller un texte" subtitle="Un mail, une note, un message : colle le texte, il est mis en forme." onClick={() => goImport("/recipes/import-from-text")} />
        <Choice icon="pdf" iconAccent title="Importer un PDF" subtitle="Une fiche ou un livre en PDF : le texte est lu et mis en forme." onClick={() => goImport("/recipes/import-from-pdf")} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 4px" }}>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500 }}>ou</span>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
        <Choice icon="edit" title="Écrire la recette" subtitle="Saisis les ingrédients et les étapes toi-même." onClick={goManual} />
      </div>
    </SwipeableSheet>
  );
}

export function NewRecipeButton({ onManual }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary btn-pill" onClick={() => setOpen(true)}>
        <Icon name="plus" size={17} /> Nouvelle
      </button>
      {open && <NewRecipeSheet onClose={() => setOpen(false)} onManual={onManual} />}
    </>
  );
}
