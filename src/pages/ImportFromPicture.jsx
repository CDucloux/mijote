import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ErrorModal } from "../components/ErrorModal.jsx";
import { LoadingOverlay, InlineError, HintCard, ImportHeader } from "../components/ImportUI.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { fileToImagePart } from "@/lib/recipes/recipeUrlImport.js";

// ─── IMPORT IA DEPUIS DES PHOTOS (route /recipes/import-from-picture) ─────────
// Photographie d'une recette de livre (1 à 2 pages) → l'IA extrait et met en
// forme ; le brouillon s'ouvre dans l'éditeur. Réservé aux admins (crédit IA).

const MAX_PHOTOS = 2;

export function ImportFromPicture() {
  const { importFromImages, notify, isAdmin } = useAppShell();
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
  useEffect(() => { if (!isAdmin) navigate("/recipes", { replace: true }); }, [isAdmin, navigate]);
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
    if (!photos.length) { setError("Ajoute au moins une photo."); return; }
    const parts = photos.map(p => p.part);
    setError(""); setLoading(true);
    try {
      await importFromImages(parts);
      navigate("/recipes", { replace: true });
      notify?.("Recette extraite, à relire");
    } catch (e) {
      setLoading(false);
      setImportError({ message: e?.message || "Import impossible.", code: e?.code });
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <ImportHeader icon="photo" title="Importer une photo" onBack={() => navigate(-1)} />

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560, margin: "0 auto" }}>
          {/* Intro */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(232,112,58,0.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="photo" size={19} color="var(--accent)" />
            </span>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: "2px 0 4px", color: "var(--text)" }}>Photographie la recette</h2>
              <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: 0 }}>
                Prends en photo une recette de livre. Ajoute une <strong style={{ color: "var(--text2)" }}>2ᵉ photo</strong> si elle tient sur deux pages. Tu pourras <strong style={{ color: "var(--text2)" }}>tout relire</strong> avant d'enregistrer.
              </p>
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {photos.map((p, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: "3/4", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)" }}>
                <img src={p.preview} alt={`page ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => removePhoto(i)} aria-label="Retirer" style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <Icon name="close" size={13} />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button onClick={() => fileRef.current?.click()} className="pressable" style={{ aspectRatio: "3/4", borderRadius: 14, border: "1.5px dashed var(--border)", background: "var(--surface2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text3)", cursor: "pointer" }}>
                <Icon name="plus" size={20} color="var(--accent)" />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{photos.length ? "Ajouter la page 2" : "Ajouter une photo"}</span>
              </button>
            )}
          </div>
          {error && <InlineError>{error}</InlineError>}

          <HintCard icon="lock" iconColor="#e8920a">
            Les photos sont envoyées à notre prestataire d'IA pour l'extraction. <strong style={{ color: "var(--text)" }}>Aucune donnée de ton compte</strong> n'est transmise.
          </HintCard>
        </div>
      </div>

      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "12px 20px calc(12px + env(safe-area-inset-bottom))", display: "flex", gap: 10, maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate(-1)}>Retour</button>
        <button className="btn btn-primary" style={{ flex: 1.4 }} disabled={!photos.length} onClick={go}>
          <Icon name="sparkle" size={15} /> Extraire
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
