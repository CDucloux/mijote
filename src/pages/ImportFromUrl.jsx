import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ErrorModal } from "../components/ErrorModal.jsx";
import { LoadingOverlay, InlineError, HintCard, ImportHeader, QuotaMeter } from "../components/ImportUI.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useAiUsage } from "../hooks/useAiUsage.js";

// ─── IMPORT IA DEPUIS UN LIEN (route /recipes/import-from-url) ────────────────
// L'IA lit la page et met la recette en forme ; le brouillon s'ouvre ensuite dans
// l'éditeur (jamais d'enregistrement direct). Réservé aux admins (crédit IA).

const URL_RE = /^https?:\/\/.+/i;

export function ImportFromUrl() {
  const { importFromUrl, notify, isPlus, isAdmin, user } = useAppShell();
  const { unlimited, remaining } = useAiUsage(user?.uid, isAdmin);
  const rem = remaining("url");
  const navigate = useNavigate();
  const location = useLocation();
  const [url, setUrl] = useState("");
  const [clip, setClip] = useState("");        // URL détectée dans le presse-papiers
  const [error, setError] = useState("");        // hint de saisie (inline)
  const [importError, setImportError] = useState(null); // échec → popup
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Accès direct à la route par un non-admin : on renvoie à la bibliothèque.
  useEffect(() => { if (!isPlus) navigate("/recipes", { replace: true }); }, [isPlus, navigate]);

  // Focus DIFFÉRÉ (et non `autoFocus`) : la page entre en glissant depuis la droite.
  // Sur mobile, un focus immédiat ouvre le clavier + scroll-into-view PENDANT la
  // transformation → « wobble ». On attend la fin de l'animation d'entrée.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 380);
    return () => clearTimeout(t);
  }, []);

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
    if (!navigator.onLine) { setError("Pas de connexion internet. L'import IA a besoin d'être en ligne pour lire la page."); return; }
    if (!unlimited && rem?.blocked) { setError(rem.dayLeft === 0 ? "Limite du jour atteinte pour les imports depuis un lien. Réessaie demain." : "Limite du mois atteinte pour les imports depuis un lien."); return; }
    const u = url.trim();
    if (!URL_RE.test(u)) { setError("Colle une URL complète (https://…)."); return; }
    setError(""); setLoading(true);
    try {
      const { method } = await importFromUrl(u);
      // Le brouillon est ouvert dans l'éditeur (route /recipes/new, posée par le
      // shell) : il survit désormais à un rafraîchissement / retour accidentel.
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
      <ImportHeader title="Importer depuis un lien" onBack={() => navigate(-1)} />

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560, margin: "0 auto" }}>
          {/* Intro */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(var(--accent-rgb),0.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
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
              padding: "13px 14px", borderRadius: 14, background: "rgba(var(--accent-rgb),0.08)", border: "1.5px dashed rgba(var(--accent-rgb),0.5)",
            }}>
              <Icon name="copy" size={18} color="var(--accent)" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--accent)" }}>Coller le lien copié</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{clipPreview}</span>
              </span>
              <Icon name="forward" size={16} color="var(--accent)" />
            </button>
          )}

          {/* Quota (abonné) ou illimité (admin) */}
          <QuotaMeter label="depuis un lien" rem={rem} unlimited={unlimited} />

          {/* Saisie */}
          <input ref={inputRef} className="field-input" type="url" inputMode="url" placeholder="https://exemple.com/recette…"
            value={url}
            onChange={e => { setUrl(e.target.value); if (error) setError(""); }}
            onKeyDown={e => e.key === "Enter" && go()}
            style={{ background: "var(--surface)", padding: "13px 16px", borderRadius: 14 }} />
          {error && <InlineError>{error}</InlineError>}

          {/* Aides */}
          <HintCard icon="share" iconColor="var(--blue)" tint="rgba(91,156,246,0.14)">
            Tu peux aussi <strong style={{ color: "var(--text)" }}>partager une page vers Cardamome</strong> depuis ton navigateur : la recette arrive directement ici.
          </HintCard>
        </div>
      </div>

      {/* Actions */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "12px 20px calc(12px + env(safe-area-inset-bottom))", display: "flex", justifyContent: "center", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <button className="btn btn-primary btn-pill" style={{ width: "100%", maxWidth: 340 }} disabled={!url.trim() || (!unlimited && rem?.blocked)} onClick={go}>
          <Icon name="sparkle" size={15} /> Importer
        </button>
      </div>

      {/* Estimation : l'extraction d'une page tourne autour de ~14 s. */}
      {loading && <LoadingOverlay estimateMs={14000} />}
      {importError && (
        <ErrorModal title="Import impossible" message={importError.message} code={importError.code}
          onClose={() => setImportError(null)}
          onRetry={() => { setImportError(null); go(); }} />
      )}
    </div>
  );
}
