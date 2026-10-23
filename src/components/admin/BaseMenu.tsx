import { useRef, useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { HeroMenu } from "../recipeDetail/HeroMenu.jsx";
import type { BaseTransfer } from "../../hooks/useMasterImports.js";

interface YamlImportProps {
  onText: (text: string, fileName: string) => void;
  warn?: boolean;
}

// Zone d'import YAML réutilisable (ingrédients / ustensiles / techniques).
// Gère son propre input fichier et son état de survol ; délègue la lecture à
// `onText(contenu, nomFichier)`. L'export reste en Markdown (boutons dédiés).
function YamlImport({ onText, warn }: YamlImportProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const read = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { onText(String(reader.result), file.name); } catch { onText("", file.name); } };
    reader.readAsText(file);
  };
  return (
    <>
      {warn && (
        <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12, lineHeight: 1.45 }}>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>Fusion dans la base</span> : chaque entrée est mise à jour (par id, sinon par nom) ou ajoutée – <span style={{ fontWeight: 600 }}>aucune entrée existante n'est supprimée</span>. À la moindre erreur, l'import est annulé en entier.
        </p>
      )}
      <input ref={ref} type="file" accept=".yaml,.yml,.txt" style={{ display: "none" }}
        onChange={e => { read(e.target.files?.[0]); e.target.value = ""; }} />
      {/* Styles dans `.yaml-drop` (global.css) : survol desktop et glisser-déposer
          (`data-over`) y partagent la même teinte, impossible en style inline. */}
      <div className="yaml-drop ripple ripple-accent" data-over={over || undefined} role="button" tabIndex={0}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); read(Array.from(e.dataTransfer.files).find(f => /\.(ya?ml|txt)$/i.test(f.name))); }}
        onClick={() => ref.current?.click()}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ref.current?.click(); } }}>
        <span className="yaml-drop-icon"><Icon name="import" size={28} color="currentColor" /></span>
        <div style={{ textAlign: "center" }}>
          <div className="yaml-drop-title" style={{ fontSize: 13, fontWeight: 500 }}>Dépose un fichier YAML ici</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>ou clique pour sélectionner</div>
        </div>
      </div>
    </>
  );
}

interface BaseMenuProps extends BaseTransfer {
  count: number;
  noun: string;
  /** Titre de la feuille d'import (« Importer dans la base » par défaut). */
  importTitle?: string;
}

/**
 * Menu « Base » d'une base master (ingrédients, ustensiles, techniques) : export
 * YAML (réimportable, pour `data/`) ou Markdown (lecture), et import YAML dans une
 * feuille dédiée. Maintenance ponctuelle : un menu plutôt qu'un bloc permanent.
 */
export function BaseMenu({ count, noun, importTitle = "Importer dans la base", onExportYaml, onExportMarkdown, onImportYaml }: BaseMenuProps) {
  const [importing, setImporting] = useState(false);
  return (
    <>
      <HeroMenu icon="database" label="Base" iconSize={15} iconColor="currentColor" title="Exporter ou importer la base"
        className="float-pill ripple" btnStyle={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 15px 8px 13px", borderRadius: 999, border: "none", fontSize: 13, fontWeight: 600, color: "var(--text2)", cursor: "pointer", flexShrink: 0 }}
        items={[
          { label: "Exporter en YAML", icon: "download", onClick: onExportYaml },
          { label: "Exporter en Markdown", icon: "fileText", onClick: onExportMarkdown },
          { label: "Importer un fichier YAML…", icon: "import", onClick: () => setImporting(true) },
        ]} />
      {importing && (
        <SwipeableSheet onClose={() => setImporting(false)}>
          {(close) => (<>
            <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 650, letterSpacing: "-0.01em", margin: "4px 0 2px" }}>{importTitle}</h2>
            <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16, fontVariantNumeric: "tabular-nums" }}>{count} {noun}{count > 1 ? "s" : ""} aujourd'hui</p>
            <YamlImport warn onText={(text) => close(() => { setImporting(false); onImportYaml(text); })} />
          </>)}
        </SwipeableSheet>
      )}
    </>
  );
}
