import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── IMPORT DEPUIS UNE URL (admin uniquement) ────────────────────────────────
// Bouton discret + feuille pour coller une URL. La Cloud Function tente d'abord
// les données structurées (JSON-LD) puis, à défaut, une extraction par IA.
// Réservé au créateur — la garde définitive est côté serveur ; ici on masque
// simplement l'entrée pour les autres.
export function UrlImportButton() {
  const { isAdmin, importFromUrl, notify } = useAppShell();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isAdmin) return null;

  const go = async () => {
    const u = url.trim();
    if (!/^https?:\/\/.+/i.test(u)) { setError("Colle une URL complète (https://…)."); return; }
    setBusy(true); setError("");
    try {
      const { method } = await importFromUrl(u);
      setOpen(false); setUrl("");
      notify?.(method === "jsonld" ? "Recette importée — à relire" : "Recette extraite par IA — à relire");
    } catch (e) {
      setError(e?.message || "Import impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => { setOpen(true); setError(""); }} title="Importer depuis une URL (créateur)" className="filter-btn"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", cursor: "pointer", flexShrink: 0 }}>
        <Icon name="link" size={17} color="var(--text2)" />
      </button>

      {open && (
        <SwipeableSheet onClose={() => !busy && setOpen(false)}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(232,112,58,0.15)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="link" size={16} color="var(--accent)" /></span>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Importer depuis une URL</h3>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 14px" }}>
            Colle le lien d'une recette. On récupère les données structurées de la page si elles existent, sinon on l'extrait avec l'IA. Tu pourras <strong style={{ color: "var(--text2)" }}>tout relire et corriger</strong> avant d'enregistrer.
          </p>
          <input className="field-input" type="url" inputMode="url" placeholder="https://exemple.com/recette…"
            value={url} autoFocus disabled={busy}
            onChange={e => { setUrl(e.target.value); if (error) setError(""); }}
            onKeyDown={e => e.key === "Enter" && !busy && go()} style={{ marginBottom: error ? 8 : 16 }} />
          {error && <div style={{ fontSize: 12.5, color: "var(--red)", margin: "0 0 14px", lineHeight: 1.4 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => setOpen(false)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !url.trim()} onClick={go}>
              {busy
                ? <><span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.5)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite", marginRight: 7, verticalAlign: "-2px" }} />Analyse…</>
                : <><Icon name="plus" size={15} /> Importer</>}
            </button>
          </div>
        </SwipeableSheet>
      )}
    </>
  );
}
