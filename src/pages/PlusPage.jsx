import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { PlusBadge } from "../components/PlusBadge.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── MIJOTÉ+ (route /plus) ───────────────────────────────────────────────────
// Page de présentation / achat de l'offre Mijoté+ : tableau comparatif Gratuit vs
// Mijoté+. Le paiement n'est pas encore branché (CTA « bientôt »). Le plan est
// dérivé de `isAdmin` en attendant un vrai système d'abonnement.

// Différenciateurs mis en avant (les fonctionnalités communes sont listées plus bas).
const FEATURES = [
  { label: "Recettes personnelles illimitées", free: true, plus: true },
  { label: "Planning repas & liste de courses", free: true, plus: true },
  { label: "Nutri-Score & saisonnalité", free: true, plus: true },
  { label: "Mode hors-ligne", free: true, plus: true },
  { label: "Foyer partagé", free: true, plus: true },
  { label: "Import IA depuis un lien", free: false, plus: true },
  { label: "Import IA depuis une photo", free: false, plus: true },
  { label: "Nouveaux imports IA en priorité", free: false, plus: true },
];

function Cell({ on }) {
  return on
    ? <Icon name="check" size={17} color="var(--green)" />
    : <span style={{ display: "inline-block", width: 12, height: 2, borderRadius: 2, background: "var(--text3)", opacity: 0.5 }} />;
}

export function PlusPage() {
  const navigate = useNavigate();
  const { isAdmin, notify } = useAppShell();
  const isPlus = isAdmin; // placeholder : à remplacer par le vrai statut d'abonnement

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "18px 20px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} aria-label="Retour" style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}>
          <Icon name="back" size={17} />
        </button>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Mijoté+</h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 20px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560, margin: "0 auto" }}>
          {/* Hero */}
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "inline-flex", marginBottom: 12 }}><PlusBadge size="lg" /></div>
            <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
              Passe à la vitesse supérieure
            </h2>
            <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55, margin: 0, maxWidth: 420, marginInline: "auto" }}>
              Débloque l'<strong style={{ color: "var(--text)" }}>import de recettes par IA</strong> — depuis un lien ou une photo de livre — et gagne un temps fou à saisir tes recettes.
            </p>
          </div>

          {/* Tableau comparatif */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", background: "var(--surface)" }}>
            {/* En-tête colonnes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 64px", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)" }}>Fonctionnalité</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text3)", textAlign: "center" }}>Gratuit</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)", textAlign: "center" }}>Mijoté+</span>
            </div>
            {FEATURES.map((f, i) => (
              <div key={f.label} style={{ display: "grid", gridTemplateColumns: "1fr 64px 64px", alignItems: "center", padding: "12px 14px", borderBottom: i < FEATURES.length - 1 ? "1px solid var(--border)" : "none", background: !f.free ? "rgba(232,112,58,0.04)" : "transparent" }}>
                <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.35 }}>{f.label}</span>
                <span style={{ display: "grid", placeItems: "center" }}><Cell on={f.free} /></span>
                <span style={{ display: "grid", placeItems: "center" }}><Cell on={f.plus} /></span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11.5, color: "var(--text3)", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
            L'abonnement Mijoté+ arrive bientôt. Les imports IA restent en accès limité en attendant.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "12px 20px calc(12px + env(safe-area-inset-bottom))", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        {isPlus ? (
          <button className="btn" style={{ width: "100%", borderRadius: 999, background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" }} onClick={() => navigate(-1)}>
            <Icon name="check" size={15} color="var(--green)" /> Tu as déjà Mijoté+
          </button>
        ) : (
          <button className="btn btn-primary btn-pill" style={{ width: "100%" }} onClick={() => notify?.("L'abonnement Mijoté+ arrive bientôt !")}>
            <Icon name="sparkle" size={15} /> Passer à Mijoté+
          </button>
        )}
      </div>
    </div>
  );
}
