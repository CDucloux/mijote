import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { FoyerGlyph } from "./FoyerGlyph.jsx";
import { FoyerEspaces } from "./FoyerEspaces.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";

// ─── BIENVENUE DANS LE FOYER ──────────────────────────────────────────────────
// S'affiche une seule fois (mémorisé en localStorage) quand l'utilisateur REJOINT
// un foyer qu'il n'a pas créé. Reprend le langage visuel du panneau Foyer (tuile
// carrée + pastilles des 4 espaces partagés) pour une continuité assumée, sans
// halo accent ni confettis d'emojis (des tells d'IA).
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
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 372, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, padding: "26px 24px 22px", boxShadow: "0 24px 70px rgba(0,0,0,0.5)", animation: "modalIn 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
        {/* Tuile carrée arrondie, reprise du header du panneau Foyer. Ombre neutre
            très douce (pas de halo vert : un glow accent est un tell d'IA banni). */}
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.28)", animation: "popIn 0.55s 0.05s both cubic-bezier(0.34,1.56,0.64,1)" }}>
          <FoyerGlyph size={30} color="#fff" />
        </div>

        {/* Hiérarchie assumée : le titre domine (display, gros, serré), le corps
            s'aligne à gauche en colonne lisible, sans tout-centré mécanique. */}
        <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 25, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.12, margin: "18px 0 8px" }}>
          Bienvenue dans le foyer
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 16px" }}>
          Tu as rejoint <strong style={{ color: "var(--text)" }}>« {household.name} »</strong>. Tes recettes ont été ajoutées, et à partir de maintenant tout se partage entre vous.
        </p>

        <FoyerEspaces style={{ marginBottom: 18 }} />

        <button className="btn btn-primary btn-pill" style={{ width: "100%", padding: "13px 0", fontSize: 15 }} onClick={close}>
          <Icon name="check" size={17} /> C'est parti
        </button>
      </div>
    </div>,
    document.body
  );
}
