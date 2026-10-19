import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon, type IconName } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { PlusBadge } from "../badges/PlusBadge.jsx";
import { useAppShell } from "../../context/AppShellContext.jsx";
import "../../styles/new-recipe.css";

// ─── BOUTON « NOUVELLE » (choix : import intelligent lien/photo/texte/pdf, ou
// saisie manuelle) ───────────────────────────────────────────────────────────────
// Le sélecteur est visible par tous. L'import intelligent est une fonctionnalité
// Cardamome+ : en plan gratuit il porte une étiquette indicative mais ses entrées
// ouvrent quand même leur page dédiée (/recipes/import-from-url | -picture | -text
// | -pdf). Le mur d'offre n'apparaît qu'au moment d'essayer l'import (cf.
// ImportPage) : on laisse d'abord découvrir l'écran, on ne bloque pas l'entrée.
//
// Hiérarchie : le lien (cas le plus fréquent) est un champ prêt à coller, seul
// élément en accent ; photo / texte / PDF tiennent sur une bande ; l'écriture
// manuelle reste à un tap, en ligne discrète. Aucune carte empilée.

// Exemples qui défilent dans le champ lien : rappelle ce qu'on peut y coller.
const LINK_HINTS = ["Colle le lien d'une recette", "marmiton.org/recettes/…", "un blog, une vidéo de chef…"];

const SOURCES: { icon: IconName; label: string; hint: string; path: string }[] = [
  { icon: "camera", label: "Photo", hint: "1 ou 2 pages", path: "/recipes/import-from-picture" },
  { icon: "paste", label: "Texte", hint: "mail, note", path: "/recipes/import-from-text" },
  { icon: "pdf", label: "PDF", hint: "fiche, livre", path: "/recipes/import-from-pdf" },
];

/**
 * Feuille de choix « Nouvelle recette » (import intelligent lien/photo/texte/pdf,
 * ou saisie manuelle). Autonome et réutilisable : ouverte par le bouton d'en-tête
 * comme par l'état vide de l'accueil, pour exposer l'import intelligent dès le
 * premier geste (le mur d'offre ne tombe qu'à la tentative d'import).
 *
 * @param onClose - Ferme la feuille.
 * @param onManual - Bascule vers la saisie manuelle.
 */
interface NewRecipeSheetProps {
  onClose: () => void;
  onManual: () => void;
}

export function NewRecipeSheet({ onClose, onManual }: NewRecipeSheetProps) {
  const { isPlus } = useAppShell();
  const navigate = useNavigate();

  const goManual = () => { onClose(); onManual(); };
  // Les choix naviguent IMMÉDIATEMENT : la page cible glisse par-dessus, la
  // feuille se démonte avec la vue (pas de temps mort d'animation de sortie).
  const goImport = (path: string) => { onClose(); navigate(path); };
  // « Coller » : même intention que le widget d'import, l'écran lien colle tout
  // seul le lien du presse-papiers (état `launcher`, cf. ImportPage).
  const pasteLink = () => { onClose(); navigate("/recipes/import-from-url", { state: { launcher: true } }); };

  return (
    <SwipeableSheet onClose={onClose}>
      <div className="nr">
        <div className="nr-head">
          <h3>Nouvelle recette</h3>
          <button type="button" className="nr-x pressable" aria-label="Fermer" onClick={onClose}>
            <Icon name="close" size={15} color="currentColor" />
          </button>
        </div>

        <div className="nr-label">
          <span>Importer</span>
          {isPlus ? <small>1 crédit, 2 pour une photo</small> : <PlusBadge />}
        </div>
        <div className="nr-link">
          <button type="button" className="nr-link__field" onClick={() => goImport("/recipes/import-from-url")} aria-label="Importer depuis un lien">
            <Icon name="link" size={18} color="var(--text3)" />
            <span className="nr-link__hints" aria-hidden="true">
              {LINK_HINTS.map(h => <span key={h}>{h}</span>)}
            </span>
          </button>
          <button type="button" className="nr-link__paste pressable" onClick={pasteLink}>Coller</button>
        </div>
        <div className="nr-strip" role="group" aria-label="Autres sources">
          {SOURCES.map(s => (
            <button key={s.path} type="button" className="pressable" onClick={() => goImport(s.path)}>
              <Icon name={s.icon} size={21} color="var(--text2)" />
              <b>{s.label}</b>
              <small>{s.hint}</small>
            </button>
          ))}
        </div>

        <button type="button" className="nr-manual" onClick={goManual}>
          <span className="nr-manual__ic"><Icon name="edit" size={17} color="var(--text2)" /></span>
          <span className="nr-manual__txt"><b>Écrire la recette moi-même</b><small>Ingrédients et étapes, à la main</small></span>
          <span className="nr-manual__go"><Icon name="forward" size={15} color="currentColor" /></span>
        </button>
      </div>
    </SwipeableSheet>
  );
}

export function NewRecipeButton({ onManual }: { onManual: () => void }) {
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
