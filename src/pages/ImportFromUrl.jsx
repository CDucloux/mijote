import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ErrorModal } from "../components/ErrorModal.jsx";
import { LoadingOverlay, InlineError, HintCard, ImportHeader } from "../components/ImportUI.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── IMPORT IA DEPUIS UN LIEN (route /recipes/import-from-url) ────────────────
// L'IA lit la page et met la recette en forme ; le brouillon s'ouvre ensuite dans
// l'éditeur (jamais d'enregistrement direct). Réservé aux admins (crédit IA).

const URL_RE = /^https?:\/\/.+/i;

export function ImportFromUrl() {
  const { importFromUrl, notify, isAdmin } = useAppShell();
  const navigate = useNavigate();
  const location = useLocation();
  const [url, setUrl] = useState("");
  const [clip, setClip] = useState("");        // URL détectée dans le presse-papiers
  const [error, setError] = useState("");        // hint de saisie (inline)
  const [importError, setImportError] = useState(null); // échec → popup
  const [loading, setLoading] = useState(false);

  // Accès direct à la route par un non-admin : on renvoie à la bibliothèque.
  useEffect(() => { if (!isAdmin) navigate("/recipes", { replace: true }); }, [isAdmin, navigate]);

  // Partage natif vers l'appli (share_target du manifest) : la page/le lien
  // partagé arrive en query (`url`, ou dans `text`/`title` selon la source). On
  // en extrait la 1ʳᵉ URL, on pré-remplit le champ, puis on nettoie la query
  // (évite de re-déclencher au retour arrière ou au rechargement).
  useEffect(() => {
    if (!location.search) return;
    const p = new URLSearchParams(location.search);
    const shared = `${p.get("url") || ""} ${p.get("text") || ""} ${p.get("title") || ""}`;
    const m = shared.match(/https?:\/\/[^\s]+/i);
    if (m) setUrl(m[0]);
    navigate("/recipes/import-from-url", { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lecture best-effort du presse-papiers : si un lien y est copié, on propose de
  // le coller en un tap. Peut échouer (permission, navigateur) → simplement ignoré.
  useEffect(() => {
    let alive = true;
    navigator.clipboard?.readText?.()
      .then(t => { const v = (t || "").trim(); if (alive && URL_RE.test(v)) setClip(v); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const go = async () => {
    const u = url.trim();
    if (!URL_RE.test(u)) { setError("Colle une URL complète (https://…)."); return; }
    setError(""); setLoading(true);
    try {
      const { method } = await importFromUrl(u);
      // Le brouillon est ouvert dans l'éditeur (state applicatif) ; on quitte la
      // route d'import vers la bibliothèque, sur laquelle l'éditeur se superpose.
      navigate("/recipes", { replace: true });
      notify?.(method === "jsonld" ? "Recette importée, à relire" : "Recette extraite, à relire");
    } catch (e) {
      setLoading(false);
      setImportError({ message: e?.message || "Import impossible.", code: e?.code });
    }
  };

  // Aperçu tronqué du lien copié (protocole retiré pour la lisibilité).
  const clipPreview = clip.replace(/^https?:\/\//i, "");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <ImportHeader icon="link" title="Importer depuis un lien" onBack={() => navigate(-1)} />

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560, margin: "0 auto" }}>
          {/* Intro */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(232,112,58,0.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="link" size={19} color="var(--accent)" />
            </span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: "2px 0 4px", color: "var(--text)" }}>Colle le lien</h2>
              <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: 0 }}>
                L'IA lit la page et met la recette en forme. Tu pourras <strong style={{ color: "var(--text2)" }}>tout relire et corriger</strong> avant d'enregistrer.
              </p>
            </div>
          </div>

          {/* Coller le lien copié (si présent dans le presse-papiers) */}
          {clip && clip !== url && (
            <button onClick={() => { setUrl(clip); setError(""); }} className="pressable" style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer",
              padding: "13px 14px", borderRadius: 14, background: "rgba(232,112,58,0.08)", border: "1.5px dashed rgba(232,112,58,0.5)",
            }}>
              <Icon name="copy" size={18} color="var(--accent)" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--accent)" }}>Coller le lien copié</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{clipPreview}</span>
              </span>
              <Icon name="forward" size={16} color="var(--accent)" />
            </button>
          )}

          {/* Saisie */}
          <input className="field-input" type="url" inputMode="url" placeholder="https://exemple.com/recette…"
            value={url} autoFocus
            onChange={e => { setUrl(e.target.value); if (error) setError(""); }}
            onKeyDown={e => e.key === "Enter" && go()} />
          {error && <InlineError>{error}</InlineError>}

          {/* Aides */}
          <HintCard icon="share">
            Tu peux aussi <strong style={{ color: "var(--text)" }}>partager une page vers Mijoté</strong> depuis ton navigateur : la recette arrive directement ici.
          </HintCard>
          <HintCard icon="lock" iconColor="#e8920a">
            Le lien est envoyé à notre prestataire d'IA pour l'extraction. <strong style={{ color: "var(--text)" }}>Aucune donnée de ton compte</strong> n'est transmise.
          </HintCard>
        </div>
      </div>

      {/* Actions */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "12px 20px calc(12px + env(safe-area-inset-bottom))", display: "flex", gap: 10, maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate(-1)}>Retour</button>
        <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!url.trim()} onClick={go}>
          <Icon name="sparkle" size={15} /> Importer
        </button>
      </div>

      {loading && <LoadingOverlay />}
      {importError && (
        <ErrorModal title="Import impossible" message={importError.message} code={importError.code}
          onClose={() => setImportError(null)}
          onRetry={() => { setImportError(null); go(); }} />
      )}
    </div>
  );
}
