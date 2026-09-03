import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { PlusBadge } from "../components/PlusBadge.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { startCheckout, openBillingPortal } from "@/lib/firebase/subscription.js";
import "../styles/plus.css";

// Tarifs Cardamome+. `price` = ID Stripe (extension), fourni par l'env.
const PRICES = {
  monthly: { amount: "4,99 €", per: "/ mois", cta: "4,99 €/mois", price: import.meta.env.VITE_STRIPE_PRICE_MONTHLY },
  yearly: { amount: "49,99 €", per: "/ an", cta: "49,99 €/an", note: "soit 4,17 €/mois · économise 10 €/an", price: import.meta.env.VITE_STRIPE_PRICE_YEARLY },
};

// ─── FORMULE (route /plus) ──────────────────────────────────────────────────────
// Page de présentation / achat de l'offre Cardamome+ : tableau comparatif Gratuit vs
// Cardamome+. Desktop en split asymétrique (rail de vente + comparatif), mobile en
// colonne unique avec CTA collé en bas. La logique de paiement (Stripe) est intacte.

// Comparatif Gratuit vs Cardamome+. Une valeur booléenne rend une coche / un tiret ;
// une chaîne rend un libellé (ex. quota de recettes).
const FEATURES = [
  { label: "Nombre de recettes", free: "50", plus: "Illimité" },
  { label: "Planning repas & liste de courses", free: true, plus: true },
  { label: "Nutri-Score & saisonnalité", free: true, plus: true },
  { label: "Mode hors-ligne", free: true, plus: true },
  { label: "Foyer partagé", free: false, plus: true },
  { label: "Import intelligent depuis un lien", free: false, plus: true },
  { label: "Import intelligent depuis une photo", free: false, plus: true },
  { label: "Journal d'itérations", free: false, plus: true },
  { label: "Génération de planning", free: false, plus: true },
  { label: "Batch cooking", free: false, plus: true },
];

function Cell({ value, accent }) {
  if (typeof value === "string") {
    return <span style={{ fontSize: 12.5, fontWeight: 600, color: accent ? "var(--accent)" : "var(--text2)" }}>{value}</span>;
  }
  return value
    ? <Icon name="check" size={17} color="var(--ok)" />
    : <Icon name="close" size={14} color="var(--red)" />;
}

export function PlusPage() {
  const navigate = useNavigate();
  const { isPlus, notify, user } = useAppShell();
  const location = useLocation();
  const [billing, setBilling] = useState("monthly"); // mensuel mis en avant : 4,99 € accroche mieux que 49,99 €
  const [busy, setBusy] = useState(false);
  const price = PRICES[billing];
  // Le paiement est prêt dès que les deux tarifs Stripe sont fournis par l'env.
  const paymentReady = !!(PRICES.monthly.price && PRICES.yearly.price);

  // Retour de Stripe Checkout (success_url) : petit message, puis on nettoie la query.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("checkout") === "success") {
      notify?.("Bienvenue dans Cardamome+ ! 🎉");
      navigate("/plus", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lance le paiement Stripe (extension Firebase) puis redirige. Si les tarifs ne
  // sont pas encore configurés (env absente), on informe simplement.
  const onSubscribe = async () => {
    if (!user?.uid || !price.price) { notify?.("L'abonnement Cardamome+ arrive bientôt !"); return; }
    setBusy(true);
    await startCheckout(user.uid, price.price, msg => { setBusy(false); notify?.(msg, "error"); });
  };
  const onManage = async () => {
    setBusy(true);
    await openBillingPortal(msg => { setBusy(false); notify?.(msg, "error"); });
  };

  // ─── Bascule mensuel / annuel : curseur glissant ──────────────────────────
  // On mesure le bouton actif et on positionne le `.plus-thumb` par-dessus. La
  // glisse ne doit répondre qu'à l'action de l'utilisateur : au montage, au
  // resize et après le chargement des polices, on repositionne SANS transition.
  const toggleRef = useRef(null);
  const monthlyRef = useRef(null);
  const yearlyRef = useRef(null);
  const thumbRef = useRef(null);
  const animatedRef = useRef(false);

  const placeThumb = useCallback((animate) => {
    const active = billing === "monthly" ? monthlyRef.current : yearlyRef.current;
    const thumb = thumbRef.current;
    if (!active || !thumb) return;
    if (!animate) thumb.style.transition = "none";
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.height = `${active.offsetHeight}px`;
    thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    if (!animate) requestAnimationFrame(() => { thumb.style.transition = ""; });
  }, [billing]);

  // Positionne au changement d'onglet : la première passe (montage) ne glisse pas.
  useLayoutEffect(() => {
    if (isPlus) return; // toggle absent en état abonné
    placeThumb(animatedRef.current);
    animatedRef.current = true;
  }, [billing, isPlus, placeThumb]);

  // Recalage sans glisse au resize et après chargement des polices (largeur des
  // boutons dépendante de la fonte).
  useEffect(() => {
    if (isPlus) return;
    const replace = () => placeThumb(false);
    window.addEventListener("resize", replace);
    if (document.fonts?.ready) document.fonts.ready.then(replace);
    return () => window.removeEventListener("resize", replace);
  }, [isPlus, placeThumb]);

  // Un seul handler par action, rendu à deux emplacements (rail desktop + barre
  // collée mobile) pour éviter toute divergence de logique.
  const renderCta = () =>
    isPlus ? (
      <button className="btn" style={{ width: "100%", borderRadius: 999, background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }} disabled={busy} onClick={onManage}>
        <Icon name="settings" size={15} /> Gérer mon abonnement
      </button>
    ) : (
      <button className="btn btn-primary btn-pill" style={{ width: "100%" }} disabled={busy} onClick={onSubscribe}>
        <Icon name="sparkle" size={15} /> {busy ? "Redirection…" : `Passer à Cardamome+ · ${price.cta}`}
      </button>
    );

  return (
    <div className="plus-root">
      {/* En-tête */}
      <header className="plus-appbar">
        <button onClick={() => navigate(-1)} aria-label="Retour" className="import-back" style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}>
          <Icon name="back" size={17} />
        </button>
        <h1>Formule</h1>
      </header>

      <main className="plus-stage" data-elastic-scroll>
        <div className={isPlus ? "plus-layout" : "plus-layout plus-layout--split"}>
          {isPlus ? (
            /* État abonné : bandeau de confirmation, hors split (colonne unique). */
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 18, background: "rgba(var(--ok-rgb),0.1)", border: "1px solid rgba(var(--ok-rgb),0.4)" }}>
              <span style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--ok)", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 5px 16px -5px rgba(var(--ok-rgb),0.65)" }}>
                <Icon name="check" size={24} color="#fff" />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  Tu es abonné·e à Cardamome+ <PlusBadge />
                </div>
                <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5, margin: "3px 0 0" }}>
                  Merci de ton soutien&nbsp;! Tu profites de l'ensemble des fonctionnalités disponibles dans Cardamome.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Rail de vente : pitch + tarif + CTA (desktop) */}
              <section className="plus-pitch">
                <span className="plus-badge-wrap"><PlusBadge size="lg" /></span>
                <h2 className="plus-title">Passe à la vitesse supérieure</h2>
                <p className="plus-lede">
                  Débloque l'<strong>import intelligent de recettes</strong> (depuis un lien ou une photo de livre) et gagne un temps fou à saisir tes recettes.
                </p>

                <div className="plus-pricing">
                  <div className="plus-toggle" ref={toggleRef} role="tablist" aria-label="Périodicité">
                    <span className="plus-thumb" ref={thumbRef} aria-hidden="true" />
                    <button ref={monthlyRef} role="tab" aria-selected={billing === "monthly"} onClick={() => setBilling("monthly")} className={`plus-toggle-btn${billing === "monthly" ? " is-on" : ""}`}>
                      Mensuel
                    </button>
                    <button ref={yearlyRef} role="tab" aria-selected={billing === "yearly"} onClick={() => setBilling("yearly")} className={`plus-toggle-btn${billing === "yearly" ? " is-on" : ""}`}>
                      Annuel <span className="plus-save">-17%</span>
                    </button>
                  </div>
                  <div className="plus-price">
                    <span className="plus-price-amount">{price.amount}</span>
                    <span className="plus-price-per">{price.per}</span>
                  </div>
                  {price.note && <div className="plus-price-note">{price.note}</div>}
                </div>

                <div className="plus-cta-rail">{renderCta()}</div>

                <p className="plus-reassure">
                  <Icon name="lock" size={13} />
                  {paymentReady
                    ? "Paiement sécurisé via Stripe · résiliable à tout moment."
                    : "L'abonnement Cardamome+ arrive bientôt. Les imports intelligents restent en accès limité en attendant."}
                </p>
              </section>

              {/* Comparatif : tableau + bande d'accent (desktop) */}
              <section className="plus-compare" aria-label="Comparatif des plans">
                <div className="plus-highlight" aria-hidden="true" />
                <div className="plus-thead">
                  <span className="plus-col">Fonctionnalité</span>
                  <span className="plus-col plus-col--center">Plan gratuit</span>
                  <span className="plus-col plus-col--plus plus-col--center">
                    <span className="plus-col-name">Cardamome+</span>
                    <span className="plus-col-tag">Recommandé</span>
                  </span>
                </div>
                {FEATURES.map((f) => (
                  <div key={f.label} className={`plus-row${!f.free ? " plus-row--diff" : ""}`}>
                    <span className="plus-feat">{f.label}</span>
                    <span className="plus-cell"><Cell value={f.free} /></span>
                    <span className="plus-cell"><Cell value={f.plus} accent /></span>
                  </div>
                ))}
              </section>
            </>
          )}
        </div>
      </main>

      {/* CTA collé en bas : mobile (les deux états) + desktop (état abonné seul). */}
      <div className={`plus-cta-bar${isPlus ? "" : " plus-cta-bar--doubled"}`}>
        {renderCta()}
      </div>
    </div>
  );
}
