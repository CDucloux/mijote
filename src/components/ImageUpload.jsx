import { useState, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { Img } from "./Img.jsx";
import { uploadImage, compressImage } from "@/lib/firebase/storage.js";

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────
export function ImageUpload({ value, onChange, style, pathPrefix = "misc" }) {
  const inputId = useRef("img_" + Math.random().toString(36).slice(2)).current;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadImage(file, pathPrefix);
      onChange(url);
    } catch {
      // Fallback: if Storage upload fails, keep working with compressed base64
      try {
        const { blob } = await compressImage(file);
        const reader = new FileReader();
        reader.onload = ev => onChange(ev.target.result);
        reader.readAsDataURL(blob);
      } catch {
        setError("Échec de l'upload");
      }
    } finally {
      setUploading(false);
      e.target.value = ""; // allow re-selecting the same file
    }
  };
  return (
    <div style={{ position: "relative", ...style }}>
      {value ? (
        <div style={{ position: "relative" }}>
          <Img src={value} style={{ width: "100%", height: style?.height || 120, borderRadius: 12 }} />
          <button onClick={() => onChange("")} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <Icon name="close" size={13} />
          </button>
          <label htmlFor={inputId} style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.6)", borderRadius: 8, padding: "4px 8px", fontSize: 11, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="photo" size={12} color="#fff" /> {uploading ? "…" : "Changer"}
          </label>
        </div>
      ) : (
        <label htmlFor={inputId} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: style?.height || 80, background: "var(--surface2)", border: "2px dashed rgba(255,255,255,0.12)", borderRadius: 12, color: "var(--text3)", cursor: "pointer" }}>
          {uploading ? (
            <>
              <div style={{ width: 22, height: 22, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Compression & upload…</span>
            </>
          ) : (
            <>
              <Icon name="photo" size={22} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Choisir une photo</span>
              <span style={{ fontSize: 11, color: "var(--text3)" }}>{error || "Galerie ou appareil photo"}</span>
            </>
          )}
        </label>
      )}
      <input id={inputId} type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} />
    </div>
  );
}
