import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";

// ─── BIENVENUE DANS LE FOYER ──────────────────────────────────────────────────
// S'affiche une seule fois (mémorisé en localStorage) quand l'utilisateur REJOINT
// un foyer qu'il n'a pas créé. Petit moment de célébration.
const seenKey = (hid) => `mijote_foyer_welcomed_${hid}`;

export function HouseholdWelcome() {
  const { user } = useAppShell();
  const { household } = useHousehold();
  const [show, setShow] = useState(false);
  const [hid, setHid] = useState(null);

  useEffect(() => {
    if (!household || !user) return;
    if (household.ownerUid === user.uid) return; // le créateur n'est pas « accueilli »
    let seen = false;
    try { seen = localStorage.getItem(seenKey(household.id)) === "1"; } catch { /* ignore */ }
    if (!seen) { setHid(household.id); setShow(true); }
  }, [household, user]);

  const close = () => {
    try { if (hid) localStorage.setItem(seenKey(hid), "1"); } catch { /* ignore */ }
    setShow(false);
  };

  if (!show || !household) return null;

  return createPortal(
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }}>
      {/* Confettis d'emojis */}
      {["🏡", "✨", "🎉", "🍲", "🥳", "🧑‍🍳"].map((e, i) => (
        <span key={i} style={{ position: "absolute", fontSize: 26 + i * 4, animation: `floatUp ${1.3 + i * 0.3}s ease forwards`, animationDelay: `${i * 0.12}s`, left: `${12 + i * 14}%`, top: `${62 + Math.sin(i) * 14}%`, pointerEvents: "none" }}>{e}</span>
      ))}
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 22, padding: "30px 24px 22px", boxShadow: "0 24px 70px rgba(0,0,0,0.5)", textAlign: "center", animation: "modalIn 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(167,201,124,0.4)", animation: "popIn 0.6s 0.1s both cubic-bezier(0.34,1.56,0.64,1)" }}>
          <span style={{ fontSize: 32, lineHeight: 1 }}>🏡</span>
        </div>
        <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 8px", animation: "popIn 0.5s 0.2s both ease" }}>
          Bienvenue dans le foyer !
        </h2>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 22px" }}>
          Tu as rejoint <strong style={{ color: "var(--text)" }}>« {household.name} »</strong>. À partir de maintenant, vous partagez vos <strong style={{ color: "var(--text)" }}>recettes, votre stock, vos listes de courses et votre planning</strong>. Tes recettes ont été ajoutées au foyer 🙂
        </p>
        <button className="btn btn-primary" style={{ width: "100%", padding: "13px 0", fontSize: 15, borderRadius: 14 }} onClick={close}>
          <Icon name="check" size={17} /> C'est parti !
        </button>
      </div>
    </div>,
    document.body
  );
}
