import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { fileToImagePart } from "../lib/recipeUrlImport.js";

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
          Garde cette fenêtre ouverte : l'extraction est en cours et ne peut pas être interrompue.
        </div>
      </div>
    </div>,
    document.body
  );
}

// Ligne-option du sélecteur (empilées verticalement). `accent` = import IA
// (marqué par une petite tête qui réfléchit plutôt qu'un libellé « IA »).
function Choice({ icon, title, subtitle, onClick, accent, ai }) {
  return (
    <button onClick={onClick} className="pressable" style={{
      display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", cursor: "pointer",
      padding: "14px 15px", borderRadius: 16,
      background: accent ? "linear-gradient(100deg, rgba(232,112,58,0.13), var(--surface2) 75%)" : "var(--surface2)",
      border: `1px solid ${accent ? "rgba(232,112,58,0.38)" : "var(--border)"}`,
    }}>
      <span style={{ position: "relative", flexShrink: 0 }}>
        <span style={{ width: 44, height: 44, borderRadius: 13, display: "grid", placeItems: "center", background: accent ? "rgba(232,112,58,0.2)" : "var(--surface3)" }}>
          <Icon name={icon} size={21} color={accent ? "var(--accent)" : "var(--text2)"} />
        </span>
        {ai && (
          <span title="Extraction par IA" style={{ position: "absolute", top: -5, right: -5, display: "grid", placeItems: "center", width: 19, height: 19, borderRadius: 999, background: "var(--accent)", border: "2px solid var(--surface)", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
            <Icon name="thinking" size={11} color="#fff" />
          </span>
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>{title}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", lineHeight: 1.4, marginTop: 3 }}>{subtitle}</span>
      </span>
      <Icon name="forward" size={16} color="var(--text3)" />
    </button>
  );
}

export function NewRecipeButton({ onManual }) {
  const { isAdmin, importFromUrl, importFromImages, notify } = useAppShell();
  const [step, setStep] = useState("idle"); // idle | choose | url | photo | loading
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState([]); // [{ file, preview, part }], max 2
  const fileRef = useRef(null);

  const resetPhotos = () => { photos.forEach(p => URL.revokeObjectURL(p.preview)); setPhotos([]); };
  const openNew = () => {
    setError(""); setUrl(""); resetPhotos();
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
      notify?.(method === "jsonld" ? "Recette importée, à relire" : "Recette extraite, à relire");
    } catch (e) {
      // L'éditeur ne s'ouvre pas : on revient à la saisie d'URL avec le message.
      setStep("url");
      setError(e?.message || "Import impossible.");
    }
  };

  const addFiles = async (fileList) => {
    setError("");
    const files = Array.from(fileList || []).filter(f => f.type.startsWith("image/"));
    const room = 2 - photos.length;
    if (room <= 0) { setError("2 photos maximum (recette sur 2 pages)."); return; }
    const next = [];
    for (const file of files.slice(0, room)) {
      try { next.push({ file, preview: URL.createObjectURL(file), part: await fileToImagePart(file) }); }
      catch { setError("Une image n'a pas pu être lue."); }
    }
    setPhotos(p => [...p, ...next]);
  };
  const removePhoto = (i) => setPhotos(p => { const c = p[i]; if (c) URL.revokeObjectURL(c.preview); return p.filter((_, k) => k !== i); });

  const goPhotos = async () => {
    if (!photos.length) { setError("Ajoute au moins une photo."); return; }
    const parts = photos.map(p => p.part);
    setError(""); setStep("loading");
    try {
      await importFromImages(parts);
      resetPhotos(); setStep("idle");
      notify?.("Recette extraite, à relire");
    } catch (e) {
      setStep("photo");
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
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 4px" }}>Nouvelle recette</h3>
          <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "0 0 18px" }}>Comment veux-tu la créer ?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Choice icon="link" accent ai title="Importer depuis un lien" subtitle="Colle une URL : l'IA extrait et met en forme la recette." onClick={() => { setError(""); setStep("url"); }} />
            <Choice icon="photo" accent ai title="Importer une photo" subtitle="Photographie une recette de livre, jusqu'à 2 pages." onClick={() => { setError(""); resetPhotos(); setStep("photo"); }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500 }}>ou</span>
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <Choice icon="edit" title="Écrire la recette" subtitle="Saisis les ingrédients et les étapes toi-même." onClick={goManual} />
          </div>
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

      {/* Import par photo */}
      {step === "photo" && (
        <SwipeableSheet onClose={() => { resetPhotos(); setStep("idle"); }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(232,112,58,0.15)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="photo" size={16} color="var(--accent)" /></span>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Importer une photo</h3>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 14px" }}>
            Photographie la recette d'un livre. Ajoute une <strong style={{ color: "var(--text2)" }}>2ᵉ photo</strong> si elle tient sur deux pages. Tu pourras tout relire avant d'enregistrer.
          </p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
            onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: error ? 8 : 16 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: "3/4", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                <img src={p.preview} alt={`page ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <Icon name="close" size={13} />
                </button>
              </div>
            ))}
            {photos.length < 2 && (
              <button onClick={() => fileRef.current?.click()} className="pressable" style={{ aspectRatio: "3/4", borderRadius: 12, border: "1.5px dashed var(--border)", background: "var(--surface2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text3)", cursor: "pointer" }}>
                <Icon name="plus" size={20} color="var(--accent)" />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{photos.length ? "Ajouter la page 2" : "Ajouter une photo"}</span>
              </button>
            )}
          </div>
          {error && <div style={{ fontSize: 12.5, color: "var(--red)", margin: "0 0 14px", lineHeight: 1.4 }}>{error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { resetPhotos(); setStep("choose"); }}>Retour</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!photos.length} onClick={goPhotos}>
              <Icon name="sparkle" size={15} /> Extraire
            </button>
          </div>
        </SwipeableSheet>
      )}

      {/* Attente : non-annulable */}
      {step === "loading" && <LoadingOverlay />}
    </>
  );
}
