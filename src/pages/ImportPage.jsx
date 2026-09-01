import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ErrorModal } from "../components/ErrorModal.jsx";
import { LoadingOverlay } from "../components/ImportUI.jsx";
import { Segmented, Lede, QuotaBar, SourcesShelf, Tips, ImpInlineError, ImportPlusGate } from "../components/ImportModules.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useAiUsage } from "../hooks/useAiUsage.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { fileToImagePart } from "@/lib/recipes/recipeUrlImport.js";
import { visibleSources, prettyHost } from "@/lib/sources/recommendedSources.js";
import { DEFAULT_SOURCES } from "@/constants/recommendedSources.js";
import "../styles/import.css";

// ─── PAGE IMPORT INTELLIGENT UNIFIÉE (lien / photo / texte) ──────────────────
// Un seul écran à onglets pour les trois modes d'import intelligent. Le mode est
// porté par l'URL (une route dédiée par mode, cf. App) pour préserver le partage
// natif et le retour arrière ; le brouillon extrait s'ouvre ensuite dans l'éditeur.
// L'écran est ACCESSIBLE à tous : un non-abonné le découvre et compose sa saisie,
// le mur d'offre ne se lève qu'à la tentative d'import (cf. `go`). La garde réelle
// reste serveur (Cardamome+), quota par mode.

const ROUTE_BY_MODE = { lien: "import-from-url", photo: "import-from-picture", texte: "import-from-text" };
const KIND_BY_MODE = { lien: "url", photo: "photo", texte: "text" };
const CTA_LABEL = { lien: "Importer", photo: "Extraire", texte: "Extraire" };
const URL_RE = /^https?:\/\/.+/i;
const MIN_TEXT_LEN = 40;
const MAX_PHOTOS = 2;

export function ImportPage({ mode = "lien" }) {
  const { importFromUrl, importFromImages, importFromText, sources, notify, isPlus, isAdmin, user } = useAppShell();
  const { unlimited, remaining } = useAiUsage(user?.uid, isAdmin);
  const rem = remaining(KIND_BY_MODE[mode]);
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();

  const [url, setUrl] = useState("");
  const [clip, setClip] = useState("");            // URL détectée dans le presse-papiers
  const [photos, setPhotos] = useState([]);        // [{ file, preview, part }]
  const [text, setText] = useState("");
  const [error, setError] = useState("");          // hint de saisie (inline)
  const [importError, setImportError] = useState(null); // échec réel → popup
  const [gate, setGate] = useState(false);         // mur d'offre (non-abonné)
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const urlRef = useRef(null);
  const textRef = useRef(null);
  const fileRef = useRef(null);
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = photos; }, [photos]);

  const sourceList = useMemo(() => {
    const v = visibleSources(sources);
    return v.length ? v : visibleSources(DEFAULT_SOURCES);
  }, [sources]);

  // Libère les aperçus photo au démontage uniquement (cf. ImportFromPicture d'origine).
  useEffect(() => () => { photosRef.current.forEach(p => URL.revokeObjectURL(p.preview)); }, []);

  // Partage natif (share_target) : un lien partagé arrive en query sur la route lien.
  // On en extrait la 1ʳᵉ URL, on pré-remplit, puis on nettoie la query.
  useEffect(() => {
    if (mode !== "lien" || !location.search) return;
    const p = new URLSearchParams(location.search);
    const shared = `${p.get("url") || ""} ${p.get("text") || ""} ${p.get("title") || ""}`;
    const m = shared.match(/https?:\/\/[^\s]+/i);
    if (m) setUrl(m[0]);
    navigate("/recipes/import-from-url", { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Presse-papiers (lien) : proposer de coller un lien copié, best-effort.
  useEffect(() => {
    if (mode !== "lien") return;
    let alive = true;
    navigator.clipboard?.readText?.()
      .then(t => { const v = (t || "").trim(); if (alive && URL_RE.test(v)) setClip(v); })
      .catch(() => {});
    return () => { alive = false; };
  }, [mode]);

  // Focus différé (la page/onglet entre en glissant : un focus immédiat ouvrirait le
  // clavier pendant la transition). Seulement sur écran large ou après l'animation.
  useEffect(() => {
    const t = setTimeout(() => {
      if (mode === "lien") urlRef.current?.focus();
      else if (mode === "texte") textRef.current?.focus();
    }, 380);
    return () => clearTimeout(t);
  }, [mode]);

  const selectMode = (m) => { if (m !== mode) navigate(`/recipes/${ROUTE_BY_MODE[m]}`, { replace: true }); };

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

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard?.readText?.();
      if (t && t.trim()) { setText(t); setError(""); textRef.current?.focus(); }
    } catch { /* presse-papiers indisponible : saisie manuelle */ }
  };

  const ready = mode === "lien" ? URL_RE.test(url.trim())
    : mode === "photo" ? photos.length > 0
    : text.trim().length >= MIN_TEXT_LEN;
  const blocked = !unlimited && rem?.blocked;

  const go = async () => {
    // Mur d'offre : c'est ICI, à la tentative d'import, qu'on bloque un non-abonné,
    // pas à l'entrée de l'écran (il a pu tout découvrir et composer sa saisie).
    if (!isPlus) { setGate(true); return; }
    if (!navigator.onLine) { setError("Pas de connexion internet. L'import intelligent a besoin d'être en ligne."); return; }
    if (blocked) { setError(rem.dayLeft === 0 ? "Limite du jour atteinte. Réessaie demain." : "Limite du mois atteinte pour ce mode."); return; }
    if (!ready) return;
    setError(""); setLoading(true);
    try {
      if (mode === "lien") { await importFromUrl(url.trim()); notify?.("Recette extraite, à relire"); }
      else if (mode === "photo") { await importFromImages(photos.map(p => p.part)); notify?.("Recette extraite, à relire"); }
      else { await importFromText(text.trim()); notify?.("Recette extraite, à relire"); }
    } catch (e) {
      setLoading(false);
      setImportError({ message: e?.message || "Import impossible.", code: e?.code });
    }
  };

  const estimateMs = mode === "photo" ? 11000 + photos.length * 7000 : mode === "texte" ? 12000 : 14000;

  // ── Briques partagées entre les deux mises en page ──
  const linkField = (
    <div className="imp-field">
      <span className="imp-glyph"><Icon name="link" size={19} color="currentColor" /></span>
      <input ref={urlRef} className="imp-urlfield" type="url" inputMode="url" placeholder="https://exemple.com/recette…"
        value={url} onChange={e => { setUrl(e.target.value); if (error) setError(""); }}
        onKeyDown={e => e.key === "Enter" && go()} />
    </div>
  );
  const clipBtn = (clip && clip !== url) ? (
    <button className="imp-clip" onClick={() => { setUrl(clip); setError(""); }}>
      <Icon name="copy" size={18} color="var(--accent)" />
      <span className="t"><b>Coller le lien copié</b><span>{prettyHost(clip)}</span></span>
      <Icon name="forward" size={16} color="var(--accent)" />
    </button>
  ) : null;

  const photoInput = (
    <input ref={fileRef} type="file" accept="image/*" multiple hidden
      onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
  );
  const photoGrid = (
    <div className="imp-photogrid">
      {photos.map((p, i) => (
        <div className="imp-photo" key={i}>
          <img src={p.preview} alt={`page ${i + 1}`} />
          <button className="rm" aria-label="Retirer" onClick={() => removePhoto(i)}>
            <Icon name="close" size={13} color="#fff" />
          </button>
        </div>
      ))}
      {photos.length < MAX_PHOTOS && (
        <button className="imp-addphoto" onClick={() => fileRef.current?.click()}>
          <span className="plus"><Icon name="plus" size={24} color="currentColor" /></span>
          <span className="l">{photos.length === 0 ? "Ajouter une photo" : "Ajouter la page 2"}</span>
          {photos.length === 0 && <span className="h">Livre, magazine ou fiche</span>}
        </button>
      )}
    </div>
  );
  const dropzone = (
    <div className={`imp-dropzone${drag ? " drag" : ""}`} onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
      <span className="plus"><Icon name="download" size={26} color="currentColor" /></span>
      <span className="l">Glisse tes photos ou clique pour choisir</span>
      <span className="h">Recette de livre, jusqu'à 2 pages, JPG ou PNG</span>
    </div>
  );
  const textArea = (
    <>
      <button className="imp-pastebtn" onClick={pasteFromClipboard}>
        <Icon name="copy" size={15} color="currentColor" /> Coller depuis le presse-papiers
      </button>
      <textarea ref={textRef} className="imp-txtarea" rows={10}
        placeholder="Colle ici le texte de ta recette : titre, ingrédients, étapes…"
        value={text} onChange={e => { setText(e.target.value); if (error) setError(""); }} />
    </>
  );
  // Le quota ne concerne que les abonnés ; pour un non-abonné il afficherait un
  // reliquat trompeur (il ne peut pas encore importer). Le CTA, lui, reste
  // cliquable pour un non-abonné : le clic lève le mur d'offre.
  const quota = isPlus ? <QuotaBar rem={rem} unlimited={unlimited} /> : null;
  const cta = (
    <button className="imp-cta" disabled={isPlus && (!ready || blocked)} onClick={go}>
      <Icon name="sparkle" size={16} color="#fff" /> {CTA_LABEL[mode]}
    </button>
  );
  const inlineErr = error ? <ImpInlineError>{error}</ImpInlineError> : null;

  const header = (
    <div className="imp-hdr">
      <button className="imp-back" aria-label="Retour" onClick={() => navigate(-1)}>
        <Icon name="back" size={17} color="currentColor" />
      </button>
      <h1>Importer</h1>
      {isDesktop && <Segmented mode={mode} onSelect={selectMode} />}
    </div>
  );

  const overlays = (
    <>
      {loading && <LoadingOverlay estimateMs={estimateMs} />}
      {gate && (
        <ImportPlusGate mode={mode} onClose={() => setGate(false)}
          onUpgrade={() => { setGate(false); navigate("/plus"); }} />
      )}
      {importError && (
        <ErrorModal title="Import impossible" message={importError.message} code={importError.code}
          onClose={() => setImportError(null)}
          onRetry={() => { setImportError(null); go(); }} />
      )}
    </>
  );

  if (isDesktop) {
    return (
      <div className="imp imp-desktop">
        {header}
        <div className="imp-body">
          <div className="imp-panes">
            <div className="imp-pane-action">
              <Lede mode={mode} />
              {mode === "lien" && <>{linkField}{clipBtn}</>}
              {mode === "photo" && <>{photoInput}{photos.length ? photoGrid : dropzone}</>}
              {mode === "texte" && textArea}
              {inlineErr}
              <div className="imp-dact">{quota}{cta}</div>
            </div>
            <div className="imp-pane-side">
              {mode === "lien" && <SourcesShelf sources={sourceList} layout="side" />}
              <Tips mode={mode} />
            </div>
          </div>
        </div>
        {overlays}
      </div>
    );
  }

  return (
    <div className="imp">
      {header}
      <div style={{ padding: "2px 20px 0", flexShrink: 0 }}><Segmented mode={mode} onSelect={selectMode} /></div>
      <div className="imp-body">
        <div className="imp-col">
          <Lede mode={mode} />
          {mode === "lien" && <>{linkField}{clipBtn}<SourcesShelf sources={sourceList} layout="shelf" /></>}
          {mode === "photo" && <>{photoInput}{photoGrid}</>}
          {mode === "texte" && textArea}
          {inlineErr}
          <Tips mode={mode} />
        </div>
      </div>
      <div className="imp-foot"><div className="imp-col">{quota}{cta}</div></div>
      {overlays}
    </div>
  );
}
