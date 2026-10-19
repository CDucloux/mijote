import { Icon, type IconName } from "../ui/Icon.jsx";

// Preuves d'usage : chaque item est une capacité réelle, décrite par ce qu'elle
// change au quotidien (jamais « fonctionnalité X »). Icônes d'un set cohérent.
const PROOFS: { icon: IconName; title: string; desc: string }[] = [
  { icon: "calendar", title: "Planning en un geste", desc: "Compose ta semaine, ou laisse Cardamome la générer selon tes envies et la saison." },
  { icon: "shopping", title: "Courses reliées au stock", desc: "La liste sort des recettes, triée par rayon, et sait déjà ce que tu as dans tes placards." },
  { icon: "layers", title: "Batch cooking", desc: "Regroupe les préparations à faire d'avance dans une session, sans t'y perdre." },
  { icon: "globe", title: "Foyer partagé", desc: "Recettes, planning et courses en temps réel avec celles et ceux qui cuisinent avec toi." },
  { icon: "list2", title: "Mode pas à pas", desc: "Guidage plein écran, mise en place cochable, minuteurs qui sonnent même écran verrouillé." },
  { icon: "history", title: "Journal d'itérations", desc: "Chaque version gardée : ce que tu as changé, et pourquoi c'était meilleur cette fois." },
  { icon: "wifiOff", title: "Hors ligne, puis sync", desc: "Tout reste là sans réseau, et rejoint le cloud dès que la connexion revient." },
  { icon: "leaf", title: "Saison & Nutri-Score", desc: "Déduits des ingrédients, affichés sans que tu aies rien à saisir." },
];

const PLAN_FREE = [
  "Jusqu'à 50 recettes",
  "Planning repas et liste de courses",
  "Nutri-Score et saisonnalité",
  "Recettes publiques à cloner",
  "Mode hors-ligne",
];
const PLAN_PLUS: [feature: string, highlight: boolean][] = [
  ["Recettes illimitées", true],
  ["Import intelligent, depuis un lien ou une photo de livre", true],
  ["Foyer partagé", false],
  ["Journal d'itérations", false],
  ["Génération de planning et batch cooking", false],
];

/** Preuves d'usage (cible de l'ancre « Les fonctionnalités »). */
export function ProofsSection() {
  return (
    <section id="fonctionnalites" className="lp-wrap lp-section lp-slide">
      <span className="lp-eyebrow">Au quotidien</span>
      <h2 className="lp-h2">Concrètement, ça change quoi ?</h2>
      <div className="lp-proof">
        {PROOFS.map((f) => (
          <div key={f.title} className="lp-proof__item">
            <span className="lp-proof__icon"><Icon name={f.icon} size={19} /></span>
            <h3 className="lp-proof__title">{f.title}</h3>
            <p className="lp-proof__desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Offre : Cardamome gratuit et Cardamome+. */
export function OfferSection() {
  return (
    <section id="offre" className="lp-wrap lp-section lp-slide">
      <span className="lp-eyebrow">L'offre</span>
      <h2 className="lp-h2 lp-h2--wide">Cardamome, et Cardamome+.</h2>
      <p className="lp-p">
        Commence sans rien débourser. Passe à Cardamome+ lorsque tu veux importer tes recettes
        depuis un lien ou une photo, les conserver sans limite et partager ton organisation avec
        ton foyer. Pas de pub, jamais. Tes données ne se revendent pas.
      </p>
      <div className="lp-plans">
        <div className="lp-plan">
          <h3 className="lp-plan__name">Cardamome</h3>
          <div className="lp-plan__price">
            <span className="lp-plan__amount">0 €</span>
            <span className="lp-plan__per">pour commencer</span>
          </div>
          <p className="lp-plan__hint">De quoi cuisiner pour de vrai, sans carte bleue.</p>
          <ul className="lp-plan__list">
            {PLAN_FREE.map((f) => (
              <li key={f}><span className="lp-plan__check"><Icon name="check" size={13} weight="bold" /></span>{f}</li>
            ))}
          </ul>
        </div>
        <div className="lp-plan lp-plan--plus">
          <span className="lp-plan__flag">Recommandé</span>
          <h3 className="lp-plan__name">Cardamome+ <span className="lp-plan__badge">+</span></h3>
          <div className="lp-plan__price">
            <span className="lp-plan__amount">4,99 €</span>
            <span className="lp-plan__per">/ mois</span>
          </div>
          <p className="lp-plan__hint lp-plan__hint--save">ou 49,99 €/an, soit 4,17 €/mois.</p>
          <ul className="lp-plan__list">
            {PLAN_PLUS.map(([f, strong]) => (
              <li key={f}><span className="lp-plan__check"><Icon name="check" size={13} weight="bold" /></span>{strong ? <strong>{f}</strong> : f}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
