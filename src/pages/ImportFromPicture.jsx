import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ErrorModal } from "../components/ErrorModal.jsx";
import { LoadingOverlay, InlineError, ImportHeader, QuotaMeter } from "../components/ImportUI.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useAiUsage } from "../hooks/useAiUsage.js";
import { fileToImagePart } from "@/lib/recipes/recipeUrlImport.js";

// ─── IMPORT IA DEPUIS DES PHOTOS (route /recipes/import-from-picture) ─────────
// Photographie d'une recette de livre (1 à 2 pages) → l'IA extrait et met en
// forme ; le brouillon s'ouvre dans l'éditeur. Réservé aux admins (crédit IA).

const MAX_PHOTOS = 2;

/** Emplacement d'ajout de photo : pastille d'icône accent + libellé, cadre pointillé. */
function AddPhoto({ label, hint, onClick, style }) {
  return (
    <button onClick={onClick} className="pressable" style={{
      aspectRatio: "3/4", borderRadius: 16, border: "1.5px dashed rgba(var(--accent-rgb),0.4)",
      background: "rgba(var(--accent-rgb),0.05)", padding: 12,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer",
      ...style,
    }}>
      <span style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(var(--accent-rgb),0.14)", display: "grid", placeItems: "center" }}>
        <Icon name="plus" size={24} color="var(--accent)" />
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>{label}</span>
      {hint && <span style={{ fontSize: 11, color: "var(--text3)", textAlign: "center", lineHeight: 1.4 }}>{hint}</span>}
    </button>
  );
}

export function ImportFromPicture() {
  const { importFromImages, notify, isPlus, isAdmin, user } = useAppShell();
  const { unlimited, remaining } = useAiUsage(user?.uid, isAdmin);
  const rem = remaining("photo");
  const navigate = useNavigate();
  const [photos, setPhotos] = useState([]); // [{ file, preview, part }]
  const [error, setError] = useState("");
  const [importError, setImportError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  // Miroir des aperçus courants, pour ne les révoquer QU'au démontage (sans quoi un
  // effet dépendant de `photos` révoquerait des URLs encore affichées à chaque ajout).
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = photos; }, [photos]);

  // Accès direct par un non-admin → retour bibliothèque.
  useEffect(() => { if (!isPlus) navigate("/recipes", { replace: true }); }, [isPlus, navigate]);
  // Libère les URLs d'aperçu au démontage uniquement.
  useEffect(() => () => { photosRef.current.forEach(p => URL.revokeObjectURL(p.preview)); }, []);

  const addFiles = async (fileList) => {
    setError("");
    const files = Array.from(fileList || []).filter(f => f.type.startsWith("image/"));
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { setError("2 photos maximum (recette sur 2 pages)."); return; }
    const next = [];
    for (const file of files.slice(0, room)) {
      try { next.push({ file, preview: URL.createObjectURL(file), part: await fileToImagePart(file) }); }
      catch (e) { setError(e?.message || "Une image n'a pas pu être lue."); }
    }
    setPhotos(p => [...p, ...next]);
  };
  const removePhoto = (i) => setPhotos(p => { const c = p[i]; if (c) URL.revokeObjectURL(c.preview); return p.filter((_, k) => k !== i); });

  const go = async () => {
    if (!navigator.onLine) { setError("Pas de connexion internet. L'import IA a besoin d'être en ligne pour analyser tes photos."); return; }
    if (!unlimited && rem?.blocked) { setError(rem.dayLeft === 0 ? "Limite du jour atteinte pour les imports photo. Réessaie demain." : "Limite du mois atteinte pour les imports photo."); return; }
    if (!photos.length) { setError("Ajoute au moins une photo."); return; }
    const parts = photos.map(p => p.part);
    setError(""); setLoading(true);
    try {
      await importFromImages(parts);
      // Le brouillon s'ouvre dans l'éditeur (route /recipes/new posée par le shell).
      notify?.("Recette extraite, à relire");
    } catch (e) {
      setLoading(false);
      setImportError({ message: e?.message || "Import impossible.", code: e?.code });
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <ImportHeader title="Importer une photo" onBack={() => navigate(-1)} />

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560, margin: "0 auto" }}>
          {/* Intro */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(var(--accent-rgb),0.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="photo" size={19} color="var(--accent)" />
            </span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: "2px 0 4px", color: "var(--text)" }}>Photographie la recette</h2>
              <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: 0 }}>
                Prends en photo une recette de livre. Ajoute une <strong style={{ color: "var(--text2)" }}>2ᵉ photo</strong> si elle tient sur deux pages. Tu pourras <strong style={{ color: "var(--text2)" }}>tout relire</strong> avant d'enregistrer.
              </p>
            </div>
          </div>

          {/* Quota (abonné) ou illimité (admin) */}
          <QuotaMeter label="photo" rem={rem} unlimited={unlimited} />

          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          {/* Vide → un seul emplacement centré. Dès qu'il y a une photo → grille
              2 colonnes : image(s) à gauche, second emplacement à droite. */}
          {photos.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <AddPhoto onClick={() => fileRef.current?.click()} label="Ajouter une photo" hint="Livre, magazine ou fiche" style={{ width: "min(72%, 240px)" }} />
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: "relative", aspectRatio: "3/4", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <img src={p.preview} alt={`page ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button onClick={() => removePhoto(i)} aria-label="Retirer" style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
                    <Icon name="close" size={13} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <AddPhoto onClick={() => fileRef.current?.click()} label="Ajouter la page 2" />
              )}
            </div>
          )}
          {error && <InlineError>{error}</InlineError>}
        </div>
      </div>

      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "12px 20px calc(12px + env(safe-area-inset-bottom))", display: "flex", justifyContent: "center", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <button className="btn btn-primary btn-pill" style={{ width: "100%", maxWidth: 340 }} disabled={!photos.length || (!unlimited && rem?.blocked)} onClick={go}>
          <Icon name="sparkle" size={15} /> Extraire
        </button>
      </div>

      {/* Estimation : ~11 s de base + ~7 s par photo (extraction Sonnet plus lente). */}
      {loading && <LoadingOverlay estimateMs={11000 + photos.length * 7000} />}
      {importError && (
        <ErrorModal title="Import impossible" message={importError.message} code={importError.code}
          onClose={() => setImportError(null)}
          onRetry={() => { setImportError(null); go(); }} />
      )}
    </div>
  );
}
