import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { FoyerGlyph } from "./FoyerGlyph.jsx";
import { FoyerEspaces } from "./FoyerEspaces.jsx";
import { useHousehold } from "../hooks/useHousehold.js";

// ─── INVITATION AU FOYER (accueil) ────────────────────────────────────────────
// Dès l'arrivée dans l'app, si une invitation à rejoindre un foyer attend, on la
// présente en modale bloquante : maintenant ou jamais, c'est rejoindre ou refuser,
// sans échappatoire « plus tard ». Reprend le langage visuel de la modale de
// bienvenue (tuile carrée + FoyerGlyph + pastilles des espaces), sans tell d'IA.

export function HouseholdInvite() {
  const { invites, actions } = useHousehold();
  const [working, setWorking] = useState(false);
  const inv = invites.find(i => i.id) || null;

  if (!inv) return null;

  const members = (inv.memberEmails || []).length;

  // Succès → l'invitation disparaît (la modale rend `null`) ; échec → on relâche le
  // verrou pour redonner la main. Dans les deux cas, réinitialiser `working` est sûr.
  const act = async (fn) => {
    if (working) return;
    setWorking(true);
    await fn(inv.id);
    setWorking(false);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }}>
      <div style={{ width: "100%", maxWidth: 372, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, padding: "26px 24px 24px", boxShadow: "0 24px 70px rgba(0,0,0,0.5)", animation: "modalIn 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          {/* Tuile carrée arrondie, reprise du header du panneau Foyer. Ombre neutre
              douce (pas de halo vert : un glow accent est un tell d'IA banni). */}
          <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 16, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.28)", animation: "popIn 0.55s 0.05s both cubic-bezier(0.34,1.56,0.64,1)" }}>
            <FoyerGlyph size={30} color="#fff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--accent2)", marginBottom: 3 }}>Invitation</div>
            <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.1, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {inv.name}
            </h2>
            <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 2 }}>{members} membre{members > 1 ? "s" : ""} · foyer partagé</div>
          </div>
        </div>

        <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 14px" }}>
          On t'invite à cuisiner à plusieurs. En rejoignant, tes recettes s'ajoutent au foyer et vous partagez tout. <strong style={{ color: "var(--text)" }}>Ta version perso reste sauvegardée.</strong>
        </p>

        <FoyerEspaces style={{ marginBottom: 18 }} />

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-pill" disabled={working} style={{ flex: "0 0 auto", padding: "13px 18px" }} onClick={() => act(actions.decline)}>
            Refuser
          </button>
          <button className="btn btn-primary btn-pill" disabled={working} style={{ flex: 1, padding: "13px 0", fontSize: 15 }} onClick={() => act(actions.accept)}>
            {working
              ? <span style={{ width: 17, height: 17, border: "2px solid rgba(255,255,255,0.5)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              : <><Icon name="check" size={17} /> Rejoindre</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
