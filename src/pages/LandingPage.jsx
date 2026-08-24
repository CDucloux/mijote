import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { EmptyArt } from "../components/EmptyArt.jsx";
import { landingPrimaryCta } from "@/lib/landing/cta.js";
import "../styles/landing.css";

// ─── LANDING PUBLIQUE (route /) ───────────────────────────────────────────────
// Manifeste éditorial ponctué de preuves produit. Aucune donnée inventée : chaque
// affirmation s'appuie sur une capacité réellement présente (voir README). La
// logique consciente de l'auth (libellé + cible du CTA) vit dans src/lib/landing.

// Preuves d'usage : chaque item est une capacité réelle, décrite par ce qu'elle
// change au quotidien (jamais « fonctionnalité X »). Icônes d'un set cohérent.
const PROOFS = [
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
  "Mode hors-ligne",
];
const PLAN_PLUS = [
  ["Recettes illimitées", true],
  ["Import par IA, depuis un lien ou une photo de livre", true],
  ["Foyer partagé", false],
  ["Journal d'itérations", false],
  ["Génération de planning et batch cooking", false],
];

/**
 * Landing publique servie sur `/`. Reste consultable connecté ou non : seul le CTA
 * principal s'adapte (`Essayer` vs `Ouvrir`). Aucun accès Firestore ni logique
 * métier ici, c'est une page de présentation pure.
 *
 * @param {{ user: ({uid?: string}|null|undefined), isDark: boolean, toggleTheme: () => void }} props
 */
export function LandingPage({ user, isDark, toggleTheme }) {
  const navigate = useNavigate();
  const primary = landingPrimaryCta(user);
  const scrollTo = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Fonction de rendu (et non composant déclaré au render) : le CTA principal
  // apparaît trois fois (barre, hero, conclusion), on factorise sans remonter un
  // sous-composant qui réinitialiserait son état à chaque render.
  const primaryCta = (small = false) => (
    <button className={`lp-cta${small ? " lp-cta--sm" : ""}`} onClick={() => navigate(primary.to)}>
      {primary.label}
      <Icon name="forward" size={small ? 15 : 17} color="#fff" />
    </button>
  );

  return (
    <div className="lp-root">
      <header className="lp-wrap lp-nav">
        <span className="lp-brand">Cardam<span className="lp-brand__dot">o</span>me<span className="lp-brand__dot">·</span></span>
        <div className="lp-nav__right">
          <button className="lp-theme" onClick={toggleTheme} aria-label={isDark ? "Passer en clair" : "Passer en sombre"}>
            <Icon name={isDark ? "sun" : "moon"} size={17} />
          </button>
          {primaryCta(true)}
        </div>
      </header>

      {/* 1. Coup de poing */}
      <section className="lp-wrap lp-hero">
        <div className="lp-hero__grid">
          <div>
            <h1 className="lp-hero__title">Les apps de recettes sont devenues des poubelles.</h1>
            <p className="lp-hero__lede">
              Des milliers de recettes. Des doublons. Du contenu moyen. Et toi, toujours planté
              devant ton frigo à te demander <strong>quoi faire à manger</strong>.
            </p>
            <div className="lp-hero__actions lp-cta-row">
              {primaryCta()}
              <button className="lp-cta lp-cta--ghost" onClick={scrollTo("lp-livres")}>
                Voir pourquoi
                <Icon name="chevronDown" size={16} />
              </button>
            </div>
            <p className="lp-hero__note">on avait envie de le dire tout haut.</p>
          </div>
          <div className="lp-hero__art"><EmptyArt name="casserole" size={300} /></div>
        </div>
      </section>

      {/* 2. Situation vécue */}
      <section className="lp-wrap lp-section">
        <span className="lp-eyebrow">Le vrai problème</span>
        <h2 className="lp-h2 lp-h2--wide">Le problème n'est pas le manque de recettes.</h2>
        <p className="lp-p">
          Tu n'en as jamais manqué. Tu croules dessous. Des captures d'écran. Des liens que tu
          t'envoies à toi-même. Vingt onglets ouverts. Des favoris que tu ne rouvriras jamais.
        </p>
        <p className="lp-punch">
          Ajouter du contenu n'a jamais aidé personne à cuisiner. Ça remplit une base de données,
          <em> pas une assiette.</em>
        </p>
      </section>

      <hr className="lp-wrap lp-rule" />

      {/* 3. Tes livres */}
      <section id="lp-livres" className="lp-wrap lp-section">
        <div className="lp-split lp-split--reverse">
          <div className="lp-split__art"><EmptyArt name="bibliotheque" size={240} /></div>
          <div>
            <span className="lp-eyebrow">Tes livres</span>
            <h2 className="lp-h2">Tu as 15 livres de cuisine. Tu les aimes.</h2>
            <p className="lp-p">
              Nous aussi. Un livre, ça se tache, ça s'annote, ça se transmet. Le livre n'est pas
              le problème. Le problème, c'est tout ce qu'il y a autour.
            </p>
            <p className="lp-refrain">Quel livre ?<span>Quelle page&nbsp;?</span></p>
            <ul className="lp-situations">
              <li>Recopier les ingrédients à la main.</li>
              <li>Convertir les quantités pour quatre.</li>
              <li>Refaire la liste de courses à chaque fois.</li>
              <li>Garder la page ouverte sans la couvrir de gras.</li>
              <li>Te souvenir de ce que tu avais changé la dernière fois.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. La réponse : garde tes livres */}
      <section className="lp-wrap lp-section">
        <span className="lp-eyebrow">Ce que fait Cardamome</span>
        <h2 className="lp-h2 lp-h2--wide">Garde tes livres. Oublie les tracas autour.</h2>
        <p className="lp-p">
          Photographie une ou deux pages, ou colle un lien. Cardamome lit la recette, sépare les
          ingrédients des étapes, relie les ustensiles, et repère même les <strong>préparations de
          base</strong> (la sauce, la pâte, le caramel) avec leur rendement.
        </p>
        <p className="lp-punch">Tu relis, tu ranges. Le livre retourne sur l'étagère, <em>propre.</em></p>
      </section>

      {/* 5. Extraire vs comprendre */}
      <section className="lp-wrap lp-section">
        <span className="lp-eyebrow">La différence</span>
        <h2 className="lp-h2 lp-h2--wide">Les autres extraient du texte. Cardamome comprend ta recette.</h2>
        <p className="lp-p">
          Extraire, c'est recopier des mots dans des cases. Comprendre, c'est savoir ce que ces
          mots veulent dire quand tu passes en cuisine.
        </p>
        <ul className="lp-situations">
          <li>Tu changes le nombre de portions : les quantités suivent.</li>
          <li>Un ingrédient reconnu porte sa saison et son Nutri-Score.</li>
          <li>Une préparation de base éclate toute seule dans les courses.</li>
          <li>Une quantité te donne son équivalent en cuillères, sans balance.</li>
        </ul>
      </section>

      <hr className="lp-wrap lp-rule" />

      {/* 6. Prise de position sur le catalogue */}
      <section className="lp-wrap lp-section">
        <span className="lp-eyebrow">Notre parti pris</span>
        <h2 className="lp-h2 lp-h2--wide">On pourrait te donner 15 000 recettes. Mais à quoi bon ?</h2>
        <p className="lp-p">
          Tu n'as pas besoin de 47 recettes de carbonara. Tu en veux une. La bonne. Celle que tu
          réussis, et que tu recuisines.
        </p>
        <p className="lp-punch">
          Une bonne app de cuisine ne t'occupe pas pendant que tu cherches quoi faire.
          <em> Elle t'aide à cuisiner.</em>
        </p>
        <p className="lp-p">
          Il y a bien un espace pour découvrir des recettes publiées par d'autres et les cloner
          d'un geste. Choisi, pas entassé.
        </p>
      </section>

      {/* 7. Manifeste */}
      <section className="lp-wrap lp-section">
        <span className="lp-eyebrow">Le manifeste</span>
        <h2 className="lp-h2">Oui, on a des opinions.</h2>
        <div className="lp-manifesto">
          <p>Plus de contenu ne rend pas une app <em>meilleure.</em></p>
          <p>Une recette sauvegardée <span className="lp-mute">n'est pas</span> une recette cuisinée.</p>
          <p>Le doublon n'est pas un choix, c'est du <span className="lp-mute">remplissage.</span></p>
          <p>Ce qui compte tient dans une assiette, <em>pas dans un compteur.</em></p>
        </div>
      </section>

      <hr className="lp-wrap lp-rule" />

      {/* 8. Preuves d'usage */}
      <section className="lp-wrap lp-section">
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

      {/* 9. Cardamome et Cardamome+ */}
      <section className="lp-wrap lp-section">
        <span className="lp-eyebrow">L'offre</span>
        <h2 className="lp-h2 lp-h2--wide">Cardamome, et Cardamome+.</h2>
        <p className="lp-p">
          Commence sans rien débourser. Passe à Cardamome+ le jour où tu veux l'import par IA et
          le reste. Pas de pub, jamais. Tes données ne se revendent pas.
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
                <li key={f}><span className="lp-plan__check"><Icon name="check" size={16} /></span>{f}</li>
              ))}
            </ul>
          </div>
          <div className="lp-plan lp-plan--plus">
            <h3 className="lp-plan__name">Cardamome+ <span className="lp-plan__badge">+</span></h3>
            <div className="lp-plan__price">
              <span className="lp-plan__amount">3,99 €</span>
              <span className="lp-plan__per">/ mois</span>
            </div>
            <p className="lp-plan__hint lp-plan__hint--save">ou 29,99 €/an, soit 2,50 €/mois.</p>
            <ul className="lp-plan__list">
              {PLAN_PLUS.map(([f, strong]) => (
                <li key={f}><span className="lp-plan__check"><Icon name="check" size={16} /></span>{strong ? <strong>{f}</strong> : f}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 10. Conclusion */}
      <section className="lp-wrap lp-section lp-final">
        <h2 className="lp-final__title">Pas la plus grosse app. Celle que tu ouvres vraiment.</h2>
        <div className="lp-final__actions lp-cta-row">
          {primaryCta()}
        </div>
        <p className="lp-sign">Fait par des gens qui cuisinent pour de vrai, pas par un algorithme qui remplit des cases.</p>
      </section>

      <footer className="lp-wrap lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__links">
            <a href="/legal/terms">CGU</a>
            <a href="/legal/privacy">Confidentialité</a>
            <a href="/legal">Informations légales</a>
          </div>
          <span className="lp-footer__meta">© 2026 Cardamome · v{__APP_VERSION__}</span>
        </div>
      </footer>
    </div>
  );
}
