import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ErrorModal } from "../components/ErrorModal.jsx";
import { LoadingOverlay, InlineError, HintCard, ImportHeader, QuotaMeter } from "../components/ImportUI.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useAiUsage } from "../hooks/useAiUsage.js";

// ─── IMPORT INTELLIGENT DEPUIS UN TEXTE COLLÉ (route /recipes/import-from-text) ─
// L'utilisateur colle un texte de recette (mail, note, message…) : le modèle
// l'extrait et le met en forme, puis le brouillon s'ouvre dans l'éditeur (jamais
// d'enregistrement direct). Réservé à Cardamome+ (crédit IA), garde côté serveur.

// En deçà, il n'y a rien d'exploitable à extraire (aligné sur MIN_TEXT_LEN serveur).
const MIN_LEN = 40;

export function ImportFromText() {
  const { importFromText, notify, isPlus, isAdmin, user } = useAppShell();
  const { unlimited, remaining } = useAiUsage(user?.uid, isAdmin);
  const rem = remaining("text");
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [error, setError] = useState("");        // hint de saisie (inline)
  const [importError, setImportError] = useState(null); // échec → popup
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Accès direct à la route par un non-abonné : retour bibliothèque.
  useEffect(() => { if (!isPlus) navigate("/recipes", { replace: true }); }, [isPlus, navigate]);

  // Focus DIFFÉRÉ (cf. ImportFromUrl) : la page entre en glissant, un focus
  // immédiat ouvrirait le clavier PENDANT la transition → « wobble ».
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 380);
    return () => clearTimeout(t);
  }, []);

  // Collage en un tap : lecture best-effort du presse-papiers sur geste utilisateur
  // (la permission est accordée dans ce contexte). Un échec est simplement ignoré.
  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard?.readText?.();
      if (t && t.trim()) { setText(t); setError(""); inputRef.current?.focus(); }
    } catch { /* clipboard indisponible : l'utilisateur colle à la main */ }
  };

  const go = async () => {
    if (!navigator.onLine) { setError("Pas de connexion internet. L'import intelligent a besoin d'être en ligne pour lire ton texte."); return; }
    if (!unlimited && rem?.blocked) { setError(rem.dayLeft === 0 ? "Limite du jour atteinte pour les imports depuis un texte. Réessaie demain." : "Limite du mois atteinte pour les imports depuis un texte."); return; }
    const t = text.trim();
    if (t.length < MIN_LEN) { setError("Colle un texte de recette un peu plus complet (ingrédients et étapes)."); return; }
    setError(""); setLoading(true);
    try {
      await importFromText(t);
      // Le brouillon s'ouvre dans l'éditeur (route /recipes/new posée par le shell).
      notify?.("Recette extraite, à relire");
    } catch (e) {
      setLoading(false);
      setImportError({ message: e?.message || "Import impossible.", code: e?.code });
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <ImportHeader title="Coller un texte" onBack={() => navigate(-1)} />

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560, margin: "0 auto" }}>
          {/* Intro */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(var(--accent-rgb),0.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="paste" size={19} color="var(--accent)" />
            </span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: "2px 0 4px", color: "var(--text)" }}>Colle ta recette</h2>
              <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: 0 }}>
                Mail, note, message… colle le texte tel quel : il est <strong style={{ color: "var(--text2)" }}>lu et mis en forme</strong>. Tu pourras <strong style={{ color: "var(--text2)" }}>tout relire et corriger</strong> avant d'enregistrer.
              </p>
            </div>
          </div>

          {/* Quota (abonné) ou illimité (admin) */}
          <QuotaMeter label="depuis un texte" rem={rem} unlimited={unlimited} />

          {/* Coller depuis le presse-papiers en un tap */}
          <button onClick={pasteFromClipboard} className="pressable" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "flex-start",
            padding: "9px 15px", borderRadius: 999, cursor: "pointer",
            background: "rgba(var(--accent-rgb),0.08)", border: "1px solid rgba(var(--accent-rgb),0.3)", color: "var(--accent)",
          }}>
            <Icon name="paste" size={15} color="currentColor" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Coller depuis le presse-papiers</span>
          </button>

          {/* Saisie : zone de texte généreuse, coins doux, fond surface */}
          <textarea ref={inputRef} rows={10}
            placeholder="Colle ici le texte de ta recette : titre, ingrédients, étapes…"
            value={text}
            onChange={e => { setText(e.target.value); if (error) setError(""); }}
            style={{
              width: "100%", resize: "vertical", minHeight: 200, lineHeight: 1.55,
              fontSize: 14, fontFamily: "inherit", color: "var(--text)",
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
              padding: "14px 16px", boxSizing: "border-box",
            }} />
          {error && <InlineError>{error}</InlineError>}

          {/* Aide */}
          <HintCard icon="bulb" iconColor="var(--accent)" tint="rgba(var(--accent-rgb),0.14)">
            Peu importe la mise en forme : listes, paragraphes, quantités approximatives… l'essentiel est que les <strong style={{ color: "var(--text)" }}>ingrédients et les étapes</strong> y soient.
          </HintCard>
        </div>
      </div>

      {/* Actions */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "12px 20px calc(12px + env(safe-area-inset-bottom))", display: "flex", justifyContent: "center", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <button className="btn btn-primary btn-pill" style={{ width: "100%", maxWidth: 340 }} disabled={text.trim().length < MIN_LEN || (!unlimited && rem?.blocked)} onClick={go}>
          <Icon name="sparkle" size={15} /> Extraire
        </button>
      </div>

      {/* Estimation : extraction Haiku d'un texte déjà propre, ~12 s. */}
      {loading && <LoadingOverlay estimateMs={12000} />}
      {importError && (
        <ErrorModal title="Import impossible" message={importError.message} code={importError.code}
          onClose={() => setImportError(null)}
          onRetry={() => { setImportError(null); go(); }} />
      )}
    </div>
  );
}
