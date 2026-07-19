import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── BOUTON « NOUVELLE » (choix : import par lien IA — admin — ou saisie manuelle) ─
// L'import par lien consomme un crédit IA : l'écran d'attente est VOLONTAIREMENT
// non-annulable (pas de fermeture, pas de swipe, pas de bouton) pour éviter qu'un
// crédit parte dans le vide.

const LOADING_STEPS = [
  "Lecture de la page…",
  "Repérage de la recette…",
  "Extraction des ingrédients…",
  "Rédaction des étapes…",
  "Presque prêt…",
];

function LoadingOverlay() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(v => Math.min(v + 1, LOADING_STEPS.length - 1)), 2400);
    return () => clearInterval(t);
  }, []);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(20,15,12,0.72)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 24, animation: "fadeIn 0.2s backwards" }}>
      <div style={{ width: "100%", maxWidth: 340, background: "var(--surface)", borderRadius: 24, padding: "34px 26px 28px", textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.45)" }}>
        {/* Marmite qui pulse dans un anneau qui tourne */}
        <div style={{ position: "relative", width: 84, height: 84, margin: "0 auto 20px" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid var(--surface3)", borderTopColor: "var(--accent)", animation: "spin 0.9s linear infinite" }} />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 34, animation: "potPulse 1.6s ease-in-out infinite" }}>🍲</div>
        </div>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 600, margin: "0 0 6px" }}>On mijote ta recette…</h3>
        <div style={{ fontSize: 13.5, color: "var(--accent)", fontWeight: 600, minHeight: 20, transition: "opacity 0.3s" }}>{LOADING_STEPS[i]}</div>
        <div style={{ display: "inline-flex", gap: 4, margin: "12px 0 14px" }}>
          {[0, 1, 2].map(d => <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: `importDots 1.2s ${d * 0.16}s ease-in-out infinite` }} />)}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text3)", lineHeight: 1.5 }}>
          Garde cette fenêtre ouverte — l'extraction est en cours et ne peut pas être interrompue.
        </div>
      </div>
    </div>,
    document.body
  );
}

// Grande option cliquable du sélecteur.
function Choice({ icon, title, subtitle, onClick, accent }) {
  return (
    <button onClick={onClick} className="pressable" style={{
      display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", cursor: "pointer",
      padding: "16px 16px", borderRadius: 16, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 12,
    }}>
      <span style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", background: accent ? "rgba(232,112,58,0.15)" : "var(--surface3)" }}>
        <Icon name={icon} size={20} color={accent ? "var(--accent)" : "var(--text2)"} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{title}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--text3)", marginTop: 2, lineHeight: 1.35 }}>{subtitle}</span>
      </span>
      <Icon name="forward" size={16} color="var(--text3)" />
    </button>
  );
}

export function NewRecipeButton({ onManual }) {
  const { isAdmin, importFromUrl, notify } = useAppShell();
  const [step, setStep] = useState("idle"); // idle | choose | url | loading
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const openNew = () => {
    setError(""); setUrl("");
    if (isAdmin) setStep("choose");
    else onManual();               // sans droits d'import : saisie manuelle directe
  };
  const goManual = () => { setStep("idle"); onManual(); };

  const go = async () => {
    const u = url.trim();
    if (!/^https?:\/\/.+/i.test(u)) { setError("Colle une URL complète (https://…)."); return; }
    setError(""); setStep("loading");
    try {
      const { method } = await importFromUrl(u);
      setStep("idle"); setUrl("");
      notify?.(method === "jsonld" ? "Recette importée — à relire" : "Recette extraite — à relire");
    } catch (e) {
      // L'éditeur ne s'ouvre pas : on revient à la saisie d'URL avec le message.
      setStep("url");
      setError(e?.message || "Import impossible.");
    }
  };

  return (
    <>
      <button className="btn btn-primary" style={{ padding: "8px 14px", borderRadius: 12 }} onClick={openNew}>
        <Icon name="plus" size={16} /> Nouvelle
      </button>

      {/* Sélecteur : importer par lien (admin) ou écrire */}
      {step === "choose" && (
        <SwipeableSheet onClose={() => setStep("idle")}>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>Nouvelle recette</h3>
          <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "0 0 16px" }}>Comment veux-tu la créer ?</p>
          <Choice icon="link" accent title="Importer depuis un lien" subtitle="Colle l'URL d'une recette, l'IA l'extrait et la met en forme." onClick={() => { setError(""); setStep("url"); }} />
          <Choice icon="edit" title="Écrire la recette" subtitle="Saisis les ingrédients et les étapes toi-même." onClick={goManual} />
        </SwipeableSheet>
      )}

      {/* Saisie de l'URL */}
      {step === "url" && (
        <SwipeableSheet onClose={() => setStep("idle")}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(232,112,58,0.15)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="link" size={16} color="var(--accent)" /></span>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Importer depuis un lien</h3>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 14px" }}>
            Colle le lien d'une recette. Tu pourras <strong style={{ color: "var(--text2)" }}>tout relire et corriger</strong> avant d'enregistrer.
          </p>
          <input className="field-input" type="url" inputMode="url" placeholder="https://exemple.com/recette…"
            value={url} autoFocus
            onChange={e => { setUrl(e.target.value); if (error) setError(""); }}
            onKeyDown={e => e.key === "Enter" && go()} style={{ marginBottom: error ? 8 : 16 }} />
          {error && <div style={{ fontSize: 12.5, color: "var(--red)", margin: "0 0 14px", lineHeight: 1.4 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(isAdmin ? "choose" : "idle")}>Retour</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!url.trim()} onClick={go}>
              <Icon name="plus" size={15} /> Importer
            </button>
          </div>
        </SwipeableSheet>
      )}

      {/* Attente : non-annulable */}
      {step === "loading" && <LoadingOverlay />}
    </>
  );
}
