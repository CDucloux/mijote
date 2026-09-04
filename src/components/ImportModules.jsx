import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { PlusBadge } from "./PlusBadge.jsx";
import { monogramOf, tintOf } from "@/lib/sources/recommendedSources.js";

// ─── BRIQUES DE LA PAGE D'IMPORT INTELLIGENT ────────────────────────────────
// Présentation pure (aucune I/O) : contrôle segmenté, intro par mode, quota
// linéaire « à la Cardamome », étagère de sources recommandées et tips. La logique
// (imports, quota réel, presse-papiers) vit dans ImportPage.

/** Intro (titre + phrase) par mode. */
export const LEDE = {
  lien: { h: "Colle un lien de recette", p: "L'import intelligent lit la page et met tout en forme. Tu relis et corriges avant d'enregistrer." },
  photo: { h: "Photographie la recette", p: "Prends une recette de livre en photo, jusqu'à 2 pages. Tu relis tout avant d'enregistrer." },
  texte: { h: "Colle ta recette", p: "Un mail, une note, un message : l'import intelligent met le texte en forme. Tu relis avant d'enregistrer." },
};

/** Conseils propres à chaque mode (rail contextuel). */
export const TIPS = {
  lien: { h: "Bien importer un lien", items: [
    ["Vise la page de la recette", " : pas la page d'accueil ni une liste."],
    ["Blogs, magazines, sites perso", " : ça passe en général sans souci."],
    ["Un site qui bloque ?", " Copie le texte de la recette et passe par l'onglet Texte."],
  ] },
  photo: { h: "Pour une bonne extraction", items: [
    ["À plat, bien éclairé", " : évite l'ombre de ta main et les reflets."],
    ["Cadre la recette entière", " : titre, ingrédients et étapes."],
    ["Deux pages ?", " Une photo par page, dans l'ordre de lecture."],
  ] },
  texte: { h: "Ce qui marche", items: [
    ["Colle tel quel", " un mail, une note, un message : la mise en forme n'importe pas."],
    ["Garde ingrédients et étapes", " : le minimum pour reconstruire la recette."],
    ["Quantités approximatives ?", " Tu ajustes après relecture."],
  ] },
};

const MODES = [
  { key: "lien", label: "Lien", icon: "link" },
  { key: "photo", label: "Photo", icon: "photo" },
  { key: "texte", label: "Texte", icon: null },
];

/** Icône « texte » (trois lignes) : absente du set, inline pour coller à la maquette. */
function TextGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h16M4 11h16M4 16h10" />
    </svg>
  );
}

/** Contrôle segmenté Lien / Photo / Texte, pouce glissant animé (index du mode). */
export function Segmented({ mode, onSelect }) {
  const i = MODES.findIndex(m => m.key === mode);
  return (
    <div className="imp-seg" role="tablist">
      <span className="imp-seg__thumb" style={{ transform: `translateX(${i * 100}%)` }} />
      {MODES.map(m => (
        <button key={m.key} role="tab" aria-selected={m.key === mode} className={m.key === mode ? "on" : ""} onClick={() => onSelect(m.key)}>
          {m.icon ? <Icon name={m.icon} size={16} color="currentColor" /> : <TextGlyph />}
          {m.label}
        </button>
      ))}
    </div>
  );
}

/** Intro par mode. */
export function Lede({ mode }) {
  const l = LEDE[mode];
  return <div className="imp-lede"><h2>{l.h}</h2><p>{l.p}</p></div>;
}

/**
 * Quota linéaire, focalisé sur le reliquat du JOUR (se réinitialise à minuit).
 * Bascule en variante « limite du mois » si c'est le mois qui bloque, et en
 * variante admin (illimité). Purement indicatif : l'autorité reste le serveur.
 */
export function QuotaBar({ rem, unlimited }) {
  if (unlimited) {
    return (
      <div className="imp-quota admin">
        <span className="adot"><Icon name="shield" size={11} color="currentColor" /></span>
        <span className="atxt">Import intelligent <b>illimité</b></span>
      </div>
    );
  }
  if (!rem) return null;
  const monthBlocks = rem.dayLeft > 0 && rem.monthLeft === 0;
  const left = monthBlocks ? rem.monthLeft : rem.dayLeft;
  const limit = monthBlocks ? rem.monthLimit : rem.dayLimit;
  const used = Math.max(0, limit - left);
  const pct = limit ? Math.round((used / limit) * 100) : 100;
  const low = !rem.blocked && left <= 1;
  const period = monthBlocks ? "ce mois-ci" : "aujourd'hui";
  const count = rem.blocked
    ? (monthBlocks ? "Limite du mois atteinte" : "Limite du jour atteinte")
    : `${left} import${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""} ${period}`;
  const reset = rem.blocked
    ? (monthBlocks ? "Se réinitialise le mois prochain, ou essaie une photo / un texte" : "Se réinitialise à minuit, ou essaie une photo / un texte")
    : "Se réinitialise à minuit";
  return (
    <div className={`imp-quota${low ? " low" : ""}${rem.blocked ? " blocked" : ""}`}>
      <div className="imp-q-top">
        <span className="imp-q-label"><span className="spark"><Icon name="sparkle" size={13} color="currentColor" /></span>Import intelligent</span>
        <span className="imp-q-count">{count}</span>
      </div>
      <div className="imp-q-track"><div className="imp-q-fill" style={{ width: `${pct}%` }} /></div>
      <div className="imp-q-reset">{reset}</div>
    </div>
  );
}

/** Une ligne créateur : logo (ou monogramme teinté) + nom + catégorie + « import net ». */
function Creator({ source, onOpen }) {
  const tint = tintOf(source.tint);
  return (
    <button className="imp-creator ripple" onClick={() => onOpen(source.url)}>
      <span className="imp-mono" style={{ background: `rgba(${tint.rgb},0.16)`, color: tint.color }}>
        {source.image ? <img src={source.image} alt="" loading="lazy" /> : monogramOf(source)}
      </span>
      <span className="meta">
        <span className="name">{source.name}</span>
        <span className="row2">
          {source.category && <span className="imp-tag">{source.category}</span>}
          {source.net && <span className="imp-net"><Icon name="check" size={11} color="currentColor" />import net</span>}
        </span>
      </span>
      <span className="imp-extl"><Icon name="externalLink" size={15} color="currentColor" /></span>
    </button>
  );
}

const SHELF_PREVIEW = 4;

/**
 * Étagère « Sources recommandées ». `layout` = "shelf" (mobile : en-tête éditorial
 * avec la note manuscrite) ou "side" (desktop : titre discret du rail droit).
 * Au-delà de 4 sources, un pied « Voir toutes les sources » déplie le reste.
 */
export function SourcesShelf({ sources, layout = "shelf" }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources.length) return null;
  const openSource = (url) => { if (url) window.open(url, "_blank", "noopener"); };
  const shown = expanded ? sources : sources.slice(0, SHELF_PREVIEW);
  const rest = sources.length - shown.length;
  const sub = "Des créatrices et créateurs que nous apprécions pour leurs recettes soignées, accessibles et pleines de goût.";
  return (
    <div>
      {layout === "shelf" ? (
        <div className="imp-shelf-head">
          <div>
            <p className="ttl">Sources recommandées</p>
            <p className="sub">{sub}</p>
          </div>
          <span className="hand">triées&nbsp;sur&nbsp;le&nbsp;volet</span>
        </div>
      ) : (
        <>
          <p className="grid-ttl">Sources recommandées</p>
          <p className="grid-sub">{sub}</p>
        </>
      )}
      <div className="imp-shelf">
        {shown.map(s => <Creator key={s.id} source={s} onOpen={openSource} />)}
        {rest > 0 && (
          <div className="imp-shelf-foot">
            <button onClick={() => setExpanded(true)}>Voir toutes les sources{rest > 0 ? ` (${rest})` : ""}</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Rail de conseils numérotés propre au mode. */
export function Tips({ mode }) {
  const t = TIPS[mode];
  if (!t) return null;
  return (
    <div className="imp-tips">
      <h3>{t.h}</h3>
      {t.items.map(([strong, rest], i) => (
        <div className="imp-tip" key={i}>
          <span className="n">{i + 1}</span>
          <p><b>{strong}</b>{rest}</p>
        </div>
      ))}
    </div>
  );
}

/** Argumentaire du mur d'offre, formulé selon le mode tenté. */
const GATE_PITCH = {
  lien: "Colle n'importe quel lien : l'import intelligent lit la page et met la recette en forme.",
  photo: "Photographie une recette de livre, jusqu'à 2 pages : l'import intelligent la reconstruit.",
  texte: "Un mail, une note, un message : l'import intelligent en fait une vraie recette, prête à relire.",
};

/**
 * Mur d'offre de l'import intelligent, présenté AU MOMENT où un non-abonné tente
 * l'import (et non à l'entrée de l'écran) : feuille avec argumentaire propre au
 * mode et bascule vers l'offre. Présentation pure ; la navigation vers /plan est
 * déléguée à `onUpgrade`, la fermeture à `onClose`.
 */
export function ImportPlusGate({ mode, onClose, onUpgrade }) {
  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (
        <div style={{ textAlign: "center", padding: "2px 2px 4px" }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent)", display: "inline-grid", placeItems: "center", boxShadow: "0 8px 20px -8px rgba(var(--accent-rgb),0.65)", marginBottom: 14 }}>
            <Icon name="sparkle" size={24} color="#fff" />
          </span>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 8px" }}>Débloque l'import intelligent</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55, maxWidth: 320, margin: "0 auto 18px" }}>
            {GATE_PITCH[mode] || GATE_PITCH.lien} C'est réservé à <PlusBadge />.
          </p>
          <button onClick={() => close(onUpgrade)} className="btn btn-primary btn-pill" style={{ width: "100%", justifyContent: "center", padding: "13px 20px" }}>
            <Icon name="sparkle" size={16} color="#fff" /> Passer à Cardamome+
          </button>
          <button onClick={() => close()} className="pressable" style={{ marginTop: 8, width: "100%", padding: 11, background: "transparent", border: "none", color: "var(--text3)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            Plus tard
          </button>
        </div>
      )}
    </SwipeableSheet>
  );
}

/** Erreur inline (URL invalide, trop de photos, texte trop court…). */
export function ImpInlineError({ children }) {
  return (
    <div className="imp-inline-err">
      <Icon name="warning" size={15} color="var(--red)" />
      <span>{children}</span>
    </div>
  );
}
