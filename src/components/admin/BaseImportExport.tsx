import { useRef, useState } from "react";
import { Icon } from "../ui/Icon.jsx";

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

interface BaseImportExportProps {
  count: number;
  noun: string;
  exportTitle?: string;
  importTitle?: string;
  onExportYaml: () => void;
  onExportMarkdown: () => void;
  onImportYaml: (text: string) => void;
}

const CARD = { background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" };

// Bloc réutilisable Export/Import YAML+Markdown d'une base master (ingrédients,
// ustensiles, techniques) : rendu et espacement IDENTIQUES quelle que soit la
// section. Autonome (gap interne) → plus de cartes « collées » selon le parent.
export function BaseImportExport({ count, noun, exportTitle = "Exporter la base", importTitle = "Importer dans la base", onExportYaml, onExportMarkdown, onImportYaml }: BaseImportExportProps) {
  return (
    <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
      <div style={CARD}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{exportTitle}</h3>
            <p style={{ fontSize: 12, color: "var(--text2)" }}>{count} {noun}{count > 1 ? "s" : ""} · <strong>YAML</strong> (réimportable, pour <code style={{ fontSize: 11 }}>data/</code>) ou Markdown (lecture)</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="btn btn-primary btn-pill btn-sm" onClick={onExportYaml} style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="download" size={14} /> YAML</button>
            <button className="btn btn-ghost btn-pill btn-sm" onClick={onExportMarkdown} style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="download" size={14} /> Markdown</button>
          </div>
        </div>
      </div>
      <div style={CARD}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{importTitle}</h3>
        <YamlImport warn onText={onImportYaml} />
      </div>
    </div>
  );
}
