import { Icon } from "../Icon.jsx";
import { Img } from "../Img.jsx";
import { RecipePlaceholder } from "../RecipePlaceholder.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";

/**
 * Feuille de partage d'une recette publique : aperçu type carte + options (copier le
 * lien, WhatsApp, SMS, partage natif). Copier et partage natif sont délégués au parent
 * (`onCopyLink` / `onNativeShare`) ; les liens WhatsApp/SMS ouvrent une cible externe
 * puis referment la feuille via `onClose`.
 */
export function ShareSheet({ recipe, publicUrl, shareText, onCopyLink, onNativeShare, onClose }) {
  const opt = (label, bg, glyph, onClick) => (
    <button onClick={onClick} className="pressable" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
      <span style={{ width: 54, height: 54, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{glyph}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text2)" }}>{label}</span>
    </button>
  );
  return (
    <SwipeableSheet onClose={onClose}>
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 600, margin: "0 0 14px" }}>Partager</h3>

      {/* Aperçu type carte de la recette */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 18 }}>
        <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
          <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} fallback={<RecipePlaceholder name={recipe.name} fontSize={30} style={{ width: "100%", height: "100%" }} />} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 15.5, fontWeight: 600, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{recipe.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}><Icon name="globe" size={11} color="var(--text3)" /> Recette publique · Cardamome</div>
        </div>
      </div>

      {/* Options de partage */}
      <div style={{ display: "flex", gap: 12, justifyContent: "space-around", marginBottom: 6 }}>
        {opt("Copier le lien", "var(--surface3)", (
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5" stroke="var(--text)" strokeWidth="1.9" /><path d="M6 15H5.5A2.5 2.5 0 0 1 3 12.5v-7A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V6" stroke="var(--text)" strokeWidth="1.9" strokeLinecap="round" /></svg>
        ), onCopyLink)}
        {opt("WhatsApp", "#25D366", (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.04c-.24.68-1.42 1.31-1.95 1.36-.53.05-1.02.24-3.44-.72-2.9-1.14-4.75-4.1-4.9-4.29-.14-.19-1.17-1.56-1.17-2.97 0-1.41.74-2.11 1-2.4.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.09.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.3 1.42.29.14.45.12.62-.07.17-.19.71-.83.9-1.12.19-.29.38-.24.65-.14.26.1 1.67.79 1.96.93.29.14.48.22.55.34.07.12.07.68-.17 1.36Z" /></svg>
        ), () => { window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + publicUrl)}`, "_blank", "noopener"); onClose(); })}
        {opt("SMS", "#34C759", (
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5v-9Z" fill="#fff" /></svg>
        ), () => { window.location.href = `sms:?&body=${encodeURIComponent(shareText + " " + publicUrl)}`; onClose(); })}
        {typeof navigator !== "undefined" && navigator.share && opt("Plus…", "var(--surface3)", (
          <Icon name="share" size={22} color="var(--text)" />
        ), onNativeShare)}
      </div>
    </SwipeableSheet>
  );
}
