import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { PlusBadge } from "../components/PlusBadge.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { startCheckout, openBillingPortal } from "@/lib/firebase/subscription.js";

// Tarifs Mijoté+. `price` = ID Stripe (extension), fourni par l'env.
const PRICES = {
  monthly: { amount: "3,99 €", per: "/ mois", cta: "3,99 €/mois", price: import.meta.env.VITE_STRIPE_PRICE_MONTHLY },
  yearly: { amount: "29,99 €", per: "/ an", cta: "29,99 €/an", note: "soit 2,50 €/mois · économise 18 €/an", price: import.meta.env.VITE_STRIPE_PRICE_YEARLY },
};

// ─── MIJOTÉ+ (route /plus) ───────────────────────────────────────────────────
// Page de présentation / achat de l'offre Mijoté+ : tableau comparatif Gratuit vs
// Mijoté+. Le paiement n'est pas encore branché (CTA « bientôt »). Le plan est
// dérivé de `isAdmin` en attendant un vrai système d'abonnement.

// Comparatif Gratuit vs Mijoté+. Une valeur booléenne rend une coche / un tiret ;
// une chaîne rend un libellé (ex. quota de recettes).
const FEATURES = [
  { label: "Nombre de recettes", free: "50", plus: "Illimité" },
  { label: "Planning repas & liste de courses", free: true, plus: true },
  { label: "Nutri-Score & saisonnalité", free: true, plus: true },
  { label: "Mode hors-ligne", free: true, plus: true },
  { label: "Foyer partagé", free: false, plus: true },
  { label: "Import IA depuis un lien", free: false, plus: true },
  { label: "Import IA depuis une photo", free: false, plus: true },
  { label: "Journal d'itérations", free: false, plus: true },
  { label: "Génération de planning", free: false, plus: true },
  { label: "Batch cooking", free: false, plus: true },
];

function Cell({ value, accent }) {
  if (typeof value === "string") {
    return <span style={{ fontSize: 12.5, fontWeight: 700, color: accent ? "var(--accent)" : "var(--text2)" }}>{value}</span>;
  }
  return value
    ? <Icon name="check" size={17} color="var(--green)" />
    : <span style={{ display: "inline-block", width: 12, height: 2, borderRadius: 2, background: "var(--text3)", opacity: 0.5 }} />;
}

export function PlusPage() {
  const navigate = useNavigate();
  const { isPlus, notify, user } = useAppShell();
  const location = useLocation();
  const [billing, setBilling] = useState("yearly"); // annuel mis en avant par défaut
  const [busy, setBusy] = useState(false);
  const price = PRICES[billing];
  // Le paiement est prêt dès que les deux tarifs Stripe sont fournis par l'env.
  const paymentReady = !!(PRICES.monthly.price && PRICES.yearly.price);

  // Retour de Stripe Checkout (success_url) : petit message, puis on nettoie la query.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("checkout") === "success") {
      notify?.("Bienvenue dans Mijoté+ ! 🎉");
      navigate("/plus", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lance le paiement Stripe (extension Firebase) puis redirige. Si les tarifs ne
  // sont pas encore configurés (env absente), on informe simplement.
  const onSubscribe = async () => {
    if (!user?.uid || !price.price) { notify?.("L'abonnement Mijoté+ arrive bientôt !"); return; }
    setBusy(true);
    await startCheckout(user.uid, price.price, msg => { setBusy(false); notify?.(msg, "error"); });
  };
  const onManage = async () => {
    setBusy(true);
    await openBillingPortal(msg => { setBusy(false); notify?.(msg, "error"); });
  };

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
          {/* Hero : bandeau de confirmation vert si abonné, sinon pitch */}
          {isPlus ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 18, background: "rgba(76,175,125,0.1)", border: "1px solid rgba(76,175,125,0.4)" }}>
              <span style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--green)", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 5px 16px -5px rgba(76,175,125,0.65)" }}>
                <Icon name="check" size={24} color="#fff" />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  Tu es abonné·e à Mijoté+ <PlusBadge />
                </div>
                <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5, margin: "3px 0 0" }}>
                  Merci de ton soutien&nbsp;! Tu profites de toutes les fonctionnalités : recettes illimitées, imports IA, foyer partagé…
                </p>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "inline-flex", marginBottom: 12 }}><PlusBadge size="lg" /></div>
              <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
                Passe à la vitesse supérieure
              </h2>
              <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55, margin: 0, maxWidth: 420, marginInline: "auto" }}>
                Débloque l'<strong style={{ color: "var(--text)" }}>import de recettes par IA</strong> (depuis un lien ou une photo de livre) et gagne un temps fou à saisir tes recettes.
              </p>
            </div>
          )}

          {/* Tableau comparatif */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", background: "var(--surface)" }}>
            {/* En-tête colonnes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 74px 74px", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)" }}>Fonctionnalité</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textAlign: "center", lineHeight: 1.2 }}>Plan<br />gratuit</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textAlign: "center", lineHeight: 1.2 }}>Plan<br />Mijoté+</span>
            </div>
            {FEATURES.map((f, i) => (
              <div key={f.label} style={{ display: "grid", gridTemplateColumns: "1fr 74px 74px", alignItems: "center", padding: "12px 14px", borderBottom: i < FEATURES.length - 1 ? "1px solid var(--border)" : "none", background: !f.free ? "rgba(232,112,58,0.04)" : "transparent" }}>
                <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.35 }}>{f.label}</span>
                <span style={{ display: "grid", placeItems: "center" }}><Cell value={f.free} /></span>
                <span style={{ display: "grid", placeItems: "center" }}><Cell value={f.plus} accent /></span>
              </div>
            ))}
          </div>

          {/* Tarifs : bascule mensuel / annuel */}
          {!isPlus && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 16, padding: "16px 16px 18px", background: "var(--surface)", textAlign: "center" }}>
              <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--surface2)", borderRadius: 999, marginBottom: 14 }}>
                {[["monthly", "Mensuel"], ["yearly", "Annuel"]].map(([key, label]) => (
                  <button key={key} onClick={() => setBilling(key)} style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 999, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                    background: billing === key ? "var(--surface)" : "transparent",
                    color: billing === key ? "var(--text)" : "var(--text3)",
                    boxShadow: billing === key ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  }}>
                    {label}
                    {key === "yearly" && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "var(--green)", borderRadius: 999, padding: "1px 6px" }}>-37%</span>}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
                <span style={{ fontFamily: "var(--ff-display)", fontSize: 34, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em" }}>{price.amount}</span>
                <span style={{ fontSize: 14, color: "var(--text3)", fontWeight: 500 }}>{price.per}</span>
              </div>
              {price.note && <div style={{ fontSize: 12, color: "var(--green)", fontWeight: 600, marginTop: 4 }}>{price.note}</div>}
            </div>
          )}

          <p style={{ fontSize: 11.5, color: "var(--text3)", textAlign: "center", lineHeight: 1.5, margin: 0 }}>
            {paymentReady
              ? "Paiement sécurisé via Stripe · résiliable à tout moment."
              : "L'abonnement Mijoté+ arrive bientôt. Les imports IA restent en accès limité en attendant."}
          </p>
        </div>
      </div>

      {/* CTA */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border)", padding: "12px 20px calc(12px + env(safe-area-inset-bottom))", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        {isPlus ? (
          <button className="btn" style={{ width: "100%", borderRadius: 999, background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }} disabled={busy} onClick={onManage}>
            <Icon name="settings" size={15} /> Gérer mon abonnement
          </button>
        ) : (
          <button className="btn btn-primary btn-pill" style={{ width: "100%" }} disabled={busy} onClick={onSubscribe}>
            <Icon name="sparkle" size={15} /> {busy ? "Redirection…" : `Passer à Mijoté+ · ${price.cta}`}
          </button>
        )}
      </div>
    </div>
  );
}
