import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { landingPrimaryCta } from "@/lib/landing/cta.js";
import "../styles/landing.css";

// ─── LANDING PUBLIQUE (route /) ───────────────────────────────────────────────
// Manifeste éditorial ponctué de preuves produit. Aucune donnée inventée : chaque
// affirmation s'appuie sur une capacité réellement présente (voir README). La
// logique consciente de l'auth (libellé + cible du CTA) vit dans src/lib/landing.
//
// Les visuels « app » (scènes ci-dessous) ne sont PAS des captures : ce sont des
// maquettes vivantes bâties sur les mêmes tokens de design que l'app (accent, oak,
// wall, spice, ff-display/ff-hand…) et sur les mêmes composants (carte recette,
// écran d'accueil), donc fidèles au produit, theme-aware, sans aucun asset externe
// ni image générée. Elles montrent l'app sans rien inventer.

// Ancres de la barre de navigation : sauts vers les sections clés. Peu nombreuses,
// pour rester lisibles et ne pas transformer la nav en menu fourre-tout.
const NAV_LINKS = [
  { label: "Le problème", id: "probleme" },
  { label: "Import intelligent", id: "import" },
  { label: "L'offre", id: "offre" },
];

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
  ["Import intelligent, depuis un lien ou une photo de livre", true],
  ["Foyer partagé", false],
  ["Journal d'itérations", false],
  ["Génération de planning et batch cooking", false],
];

// ─── Maquettes vivantes (tokens + composants de l'app, aucun asset) ───────────

/** Marque : la gousse de cardamome (même tracé que la sidebar de l'app) suivie du
 *  mot-symbole. Le pod prend les tokens d'accent, donc suit le thème. */
function LogoPod({ size = 27 }) {
  return (
    <svg className="lp-pod" viewBox="15 15 70 70" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M50 15 C68 30 74 48 67 63 C62.5 74 55.5 80 50 85 C44.5 80 37.5 74 33 63 C26 48 32 30 50 15 Z" fill="var(--accent2)" />
      <g stroke="var(--accent-strong)" strokeLinecap="round">
        <path d="M50 24 C50 40 50 62 50 77" strokeWidth="4" />
        <path d="M42 30 C39.5 45 41 60 47 74" strokeWidth="3.4" />
        <path d="M58 30 C60.5 45 59 60 53 74" strokeWidth="3.4" />
      </g>
    </svg>
  );
}

/** Châssis « téléphone » qui encadre une scène d'app. Purement décoratif. */
function PhoneFrame({ children, label }) {
  return (
    <div className="lp-device" role="img" aria-label={label}>
      <span className="lp-device__notch" aria-hidden="true" />
      <div className="lp-device__screen">{children}</div>
    </div>
  );
}

/** Aperçu de l'accueil : reproduit l'écran d'accueil réel (dashboard) en réduction.
 *  Données neutres, aucune identité réelle : « Bonjour ! », foyer « Mon Foyer »,
 *  avatars réduits à une initiale. Fait le lien direct hero <-> produit. */
function SceneHome() {
  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const nav = [
    ["home", "Accueil", true], ["book", "Recettes", false], ["calendar", "Planning", false],
    ["shopping", "Courses", false], ["box", "Stock", false],
  ];
  return (
    <div className="lp-scene lp-hs" aria-hidden="true">
      <div className="lp-hs__scroll">
        <div className="lp-hs__head">
          <div>
            <div className="lp-hs__hi">Bonjour&nbsp;!</div>
            <div className="lp-hs__sub">Bienvenue sur <b>Cardam<span>o</span>me<span>·</span></b></div>
          </div>
          <span className="lp-hs__me">C</span>
        </div>

        <div className="lp-hs__foyer">
          <span className="lp-hs__foyerbar" />
          <span className="lp-hs__avs"><i>C</i><i>M</i></span>
          <span className="lp-hs__foyertxt">
            <b>Mon Foyer</b>
            <small>2 membres · partage actif</small>
          </span>
          <span className="lp-hs__chev"><Icon name="forward" size={12} color="#fff" /></span>
        </div>

        <div className="lp-hs__label">Aujourd'hui</div>
        <div className="lp-hs__row">
          <span className="lp-hs__rowic"><Icon name="shopping" size={15} color="var(--accent)" /></span>
          <span className="lp-hs__rowtxt"><b>12 articles à acheter</b><small>Ta liste de courses t'attend</small></span>
          <Icon name="forward" size={12} color="var(--text3)" />
        </div>

        <div className="lp-hs__label lp-hs__label--row">
          <span className="lp-hs__labelic"><Icon name="leaf" size={12} color="var(--accent)" /> L'ingrédient du moment</span>
          <small>chaque semaine</small>
        </div>
        <div className="lp-hs__ing">
          <span className="lp-hs__ingbar" />
          <div className="lp-hs__inghead">
            <span className="lp-hs__ingphoto"><Icon name="leaf" size={19} color="var(--accent)" /></span>
            <div>
              <div className="lp-hs__ingname">Artichaut</div>
              <div className="lp-hs__ingtags">
                <span className="lp-hs__season"><Icon name="sun" size={9} color="#fff" /> De saison</span>
                <small>Légume</small>
              </div>
            </div>
          </div>
          <div className="lp-hs__months">
            {months.map((m, i) => (
              <span key={i} className={i >= 4 && i <= 8 ? "on" : ""}>{m}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="lp-hs__nav">
        {nav.map(([ic, lb, on]) => (
          <span key={lb} className={on ? "on" : ""}>
            <Icon name={ic} size={16} weight={on ? "fill" : "regular"} color={on ? "var(--accent)" : "var(--text3)"} />
            {lb}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Une carte recette fidèle au composant réel de l'app (RecipeCard) : vignette à
 *  halo, badge « de saison » en verre, titre sur deux lignes, méta temps + ingr.,
 *  pastille Nutri-Score. Sert la pile ci-dessous. */
function RecipeCardMock({ name, time, ings, nutri, season, halo, className, style }) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  return (
    <div className={`lp-rcard${className ? " " + className : ""}`} style={style}>
      <div className={`lp-rcard__thumb lp-rcard__thumb--${halo}`}>
        <span className="lp-rcard__initial">{initial}</span>
        {season && (
          <span className="lp-rcard__season"><Icon name="sun" size={10} color="#fff" /> De saison</span>
        )}
      </div>
      <div className="lp-rcard__body">
        <div className="lp-rcard__title">{name}</div>
        <div className="lp-rcard__meta">
          <span className="lp-rcard__metaL">
            <Icon name="clock" size={11} color="var(--text3)" /> {time}
            <i className="lp-rcard__sep" /> {ings} ingr.
          </span>
          <span className="lp-rcard__nutri" data-n={nutri}>{nutri}</span>
        </div>
      </div>
    </div>
  );
}

// Pile de recettes « sauvegardées » : le trop-plein rendu visible. Doublons,
// captures, favoris jamais rouverts. Éventail volontairement en désordre.
const PILE = [
  { name: "Tarte au citron meringuée", time: "45 min", ings: 9, nutri: "B", season: true, halo: "warm", s: { left: "2%", top: "16%", rotate: "-7deg", zIndex: 1 } },
  { name: "Poulet rôti au citron", time: "1 h 10", ings: 7, nutri: "C", season: false, halo: "green", s: { left: "24%", top: "0%", rotate: "5deg", zIndex: 3 } },
  { name: "Curry de lentilles corail", time: "30 min", ings: 12, nutri: "A", season: false, halo: "warm", s: { left: "12%", top: "40%", rotate: "-2deg", zIndex: 2 } },
];

/** Pile de cartes recette : plusieurs vraies cartes en désordre, pour donner à
 *  voir « tu croules dessous » plutôt qu'une carte isolée. */
function SceneCardPile() {
  return (
    <div className="lp-cardpile" aria-hidden="true">
      {PILE.map((c) => (
        <RecipeCardMock
          key={c.name}
          {...c}
          className="lp-cardpile__card"
          style={{ left: c.s.left, top: c.s.top, transform: `rotate(${c.s.rotate})`, zIndex: c.s.zIndex }}
        />
      ))}
    </div>
  );
}

/** Étagère de livres de cuisine : ce que tu aimes déjà. Tons chauds (oak/spice),
 *  un marque-page. Illustre « Tu as 15 livres de cuisine. Tu les aimes ». */
function SceneBooks() {
  const books = [
    { t: "Le grand classique", tone: "oak", h: 148, lean: "-2deg" },
    { t: "Pâtisserie", tone: "spice", h: 168, mark: true },
    { t: "Cuisine de saison", tone: "accent", h: 138 },
    { t: "Carnet de famille", tone: "ink", h: 158, lean: "1.5deg" },
    { t: "Basiques", tone: "oak2", h: 130 },
  ];
  return (
    <div className="lp-books" aria-hidden="true">
      <div className="lp-books__row">
        {books.map((b) => (
          <span
            key={b.t}
            className={`lp-book lp-book--${b.tone}`}
            style={{ height: b.h, transform: b.lean ? `rotate(${b.lean})` : undefined }}
          >
            {b.mark && <i className="lp-book__mark" />}
            <span className="lp-book__t">{b.t}</span>
          </span>
        ))}
      </div>
      <div className="lp-books__plank" />
    </div>
  );
}

/** Recette structurée : ingrédients séparés des étapes, base reliée. */
function SceneStructured() {
  const ings = ["Citron", "Œufs", "Sucre", "Beurre"];
  return (
    <div className="lp-scene lp-scene--struct" aria-hidden="true">
      <div className="lp-scene__bar"><span className="lp-scene__title">Tarte au citron</span></div>
      <div className="lp-st__group">Ingrédients</div>
      <div className="lp-st__ings">
        {ings.map((n) => (
          <span className="lp-st__ing" key={n}><span className="lp-st__dot" />{n}</span>
        ))}
        <span className="lp-st__ing lp-st__ing--base"><span className="lp-st__dot" /><Icon name="utensils" size={11} /> Pâte sablée</span>
      </div>
      <div className="lp-st__group">Étapes</div>
      <ol className="lp-st__steps">
        <li><b>1</b><span className="lp-st__line" style={{ width: "92%" }} /></li>
        <li><b>2</b><span className="lp-st__line" style={{ width: "78%" }} /></li>
        <li><b>3</b><span className="lp-st__line" style={{ width: "85%" }} /></li>
      </ol>
    </div>
  );
}

/** Démo animée de l'import intelligent : une source (lien / photo) que Cardamome lit et
 *  transforme en recette structurée. Un faisceau balaie la source en continu ;
 *  la sortie s'assemble par petites touches. 100% CSS, coupé si mouvement réduit. */
function SceneImport() {
  return (
    <div className="lp-scene lp-scene--import" aria-hidden="true">
      <div className="lp-imp__src">
        <span className="lp-imp__tabs">
          <span className="lp-imp__tab lp-imp__tab--on"><Icon name="link" size={13} /> Lien</span>
          <span className="lp-imp__tab"><Icon name="camera" size={13} /> Photo</span>
        </span>
        <div className="lp-imp__url">
          <Icon name="link" size={13} color="var(--text3)" />
          <span>marmiton.org/tarte-citron</span>
        </div>
        <span className="lp-imp__beam" />
      </div>
      <div className="lp-imp__arrow">
        <span className="lp-imp__pill"><Icon name="sparkle" size={13} color="var(--accent)" /> Cardamome lit</span>
      </div>
      <div className="lp-imp__out">
        <div className="lp-imp__title">Tarte au citron meringuée</div>
        <div className="lp-imp__chips">
          {["Citron", "Œufs", "Sucre", "Beurre"].map((c, i) => (
            <span className="lp-imp__chip" style={{ "--i": i }} key={c}>{c}</span>
          ))}
          <span className="lp-imp__chip lp-imp__chip--base" style={{ "--i": 4 }}><Icon name="utensils" size={10} /> Pâte sablée</span>
        </div>
        <div className="lp-imp__lines">
          <span className="lp-imp__line" style={{ "--i": 5, width: "90%" }} />
          <span className="lp-imp__line" style={{ "--i": 6, width: "72%" }} />
        </div>
      </div>
    </div>
  );
}

/** Boutons « stores » : l'app native arrive (Capacitor), rien de public encore.
 *  États « à venir » NON cliquables : on n'invente aucun lien de téléchargement. */
function StoreButtons() {
  return (
    <div className="lp-store" role="group" aria-label="Applications mobiles à venir">
      <span className="lp-store__btn" aria-disabled="true">
        <Icon name="android" size={22} />
        <span className="lp-store__txt"><small>Bientôt sur</small><b>Android</b></span>
        <span className="lp-store__soon">à venir</span>
      </span>
      <span className="lp-store__btn" aria-disabled="true">
        <Icon name="apple" size={22} />
        <span className="lp-store__txt"><small>Bientôt sur</small><b>iOS</b></span>
        <span className="lp-store__soon">à venir</span>
      </span>
    </div>
  );
}

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
  const rootRef = useRef(null);

  const scrollToId = (id) => (e) => {
    e?.preventDefault?.();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const scrollTop = (e) => {
    e?.preventDefault?.();
    rootRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  // « Slide » suivante : la flèche descend d'une section à la suivante. scrollIntoView
  // cible automatiquement le bon conteneur de défilement, sans dépendre de window.
  const goNext = (e) => {
    let n = e.currentTarget.closest("section")?.nextElementSibling;
    while (n && n.tagName !== "SECTION") n = n.nextElementSibling;
    n?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const slideDown = () => (
    <button className="lp-next" onClick={goNext} aria-label="Section suivante">
      <Icon name="chevronDown" size={20} />
    </button>
  );

  // Fonctions de rendu (et non composants déclarés au render) : CTA et marque
  // apparaissent plusieurs fois. On factorise sans remonter de sous-composant qui
  // réinitialiserait un état à chaque render.
  const primaryCta = (small = false) => (
    <button className={`lp-cta${small ? " lp-cta--sm" : ""}`} onClick={() => navigate(primary.to)}>
      {primary.label}
      <Icon name="forward" size={small ? 15 : 17} color="#fff" />
    </button>
  );
  const brand = (size = 27) => (
    <a href="#top" className="lp-brandmark" onClick={scrollTop} aria-label="Cardamome, revenir en haut">
      <LogoPod size={size} />
      <span className="lp-brand">Cardam<span className="lp-brand__dot">o</span>me<span className="lp-brand__dot">·</span></span>
    </a>
  );

  return (
    <div className="lp-root" id="top" ref={rootRef}>
      {/* Barre de navigation : PRÉSENTE sur toutes les slides. Fixe en haut, le
          contenu défile dessous. Marque + ancres (#) + thème + CTA. */}
      <header className="lp-navbar">
        <div className="lp-wrap lp-navbar__inner">
          {brand(24)}
          <nav className="lp-navbar__links">
            {NAV_LINKS.map((l) => (
              <a key={l.id} href={`#${l.id}`} onClick={scrollToId(l.id)}>{l.label}</a>
            ))}
          </nav>
          <div className="lp-nav__right">
            <button className="lp-theme" onClick={toggleTheme} aria-label={isDark ? "Passer en clair" : "Passer en sombre"}>
              <Icon name={isDark ? "sun" : "moon"} size={17} />
            </button>
            {primaryCta(true)}
          </div>
        </div>
      </header>

      {/* 1. Coup de poing */}
      <section className="lp-wrap lp-hero lp-slide">
        <div className="lp-hero__grid">
          <div className="lp-hero__copy">
            <h1 className="lp-hero__title">Les apps de recettes sont devenues des poubelles.</h1>
            <p className="lp-hero__lede">
              Des milliers de recettes. Des doublons. Du contenu moyen. Et toi, toujours planté
              devant ton frigo à te demander <strong>quoi faire à manger</strong>.
            </p>
            <p className="lp-hero__note">Avec Cardamome, on a décidé de faire autrement.</p>
            <div className="lp-hero__actions lp-cta-row">
              <StoreButtons />
            </div>
          </div>
          <div className="lp-hero__art">
            <PhoneFrame label="Aperçu de Cardamome : l'écran d'accueil"><SceneHome /></PhoneFrame>
          </div>
        </div>
        {slideDown()}
      </section>

      {/* 2. Situation vécue */}
      <section id="probleme" className="lp-wrap lp-section lp-slide">
        <div className="lp-split lp-split--reverse">
          <div className="lp-split__media">
            <SceneCardPile />
          </div>
          <div>
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
          </div>
        </div>
        {slideDown()}
      </section>

      {/* 3. Tes livres */}
      <section id="lp-livres" className="lp-wrap lp-section lp-slide">
        <div className="lp-split">
          <div>
            <span className="lp-eyebrow">Tes livres</span>
            <h2 className="lp-h2 lp-h2--wide">Tu as 15 livres de cuisine. Tu les aimes.</h2>
            <p className="lp-p">
              Nous aussi. Un livre, ça se tache, ça s'annote, ça se transmet. Le livre n'a jamais
              été le problème. Ce qui l'est, c'est tout ce qu'il y a autour : recopier, convertir
              les quantités, refaire la liste, retrouver la bonne page.
            </p>
            <p className="lp-punch">
              Le livre, tu l'ouvres avec plaisir. <em>Le reste t'épuise avant l'assiette.</em>
            </p>
          </div>
          <div className="lp-split__media">
            <SceneBooks />
          </div>
        </div>
        {slideDown()}
      </section>

      {/* 4. La réponse : garde tes livres */}
      <section className="lp-wrap lp-section lp-slide">
        <div className="lp-split">
          <div>
            <span className="lp-eyebrow">Ce que fait Cardamome</span>
            <h2 className="lp-h2 lp-h2--wide">Garde tes livres. Oublie les tracas autour.</h2>
            <p className="lp-p">
              Photographie une page, ou colle un lien. Cardamome lit la recette, sépare les
              ingrédients des étapes, relie les ustensiles, et repère même les <strong>préparations
              de base</strong> avec leur rendement.
            </p>
            <p className="lp-punch">
              Tu relis, tu ranges, le livre retourne sur l'étagère. <em>Ta recette, elle, est prête.</em>
            </p>
          </div>
          <div className="lp-split__media">
            <PhoneFrame label="Une recette rangée par Cardamome : ingrédients, étapes, base reliée"><SceneStructured /></PhoneFrame>
          </div>
        </div>
        {slideDown()}
      </section>

      {/* 5. Import intelligent : la démonstration mise en avant, demo à droite */}
      <section id="import" className="lp-wrap lp-section lp-slide">
        <div className="lp-split lp-split--wide">
          <div>
            <span className="lp-eyebrow">L'import intelligent</span>
            <h2 className="lp-h2 lp-h2--wide">Les autres recopient. Cardamome comprend ta recette.</h2>
            <p className="lp-p">
              Extraire, c'est ranger des mots dans des cases. Comprendre, c'est savoir ce qu'ils
              veulent dire une fois en cuisine : les portions ajustent les quantités, la saison et
              le Nutri-Score arrivent tout seuls.
            </p>
            <p className="lp-punch">
              Un lien collé, une photo de page, une recette qui se cuisine. <em>Sans recopier une ligne.</em>
            </p>
          </div>
          <div className="lp-split__media">
            <SceneImport />
          </div>
        </div>
        {slideDown()}
      </section>

      {/* 6. Prise de position sur le catalogue */}
      <section className="lp-wrap lp-section lp-slide">
        <span className="lp-eyebrow">Notre parti pris</span>
        <h2 className="lp-h2 lp-h2--wide">On pourrait te donner 15 000 recettes. À quoi bon ?</h2>
        <p className="lp-p">
          Tu n'as pas besoin de 47 carbonara. Tu en veux une : la bonne, celle que tu réussis et que
          tu recuisines. Découvrir les recettes des autres reste possible, et se cloner d'un geste.
          Choisi, pas entassé.
        </p>
        <p className="lp-punch">
          Une bonne app ne t'occupe pas pendant que tu cherches quoi faire. <em>Elle t'aide à cuisiner.</em>
        </p>
        {slideDown()}
      </section>

      {/* 7. Manifeste : pleine largeur, prise de position assumée */}
      <section id="manifeste" className="lp-wrap lp-section lp-slide lp-manifest">
        <span className="lp-eyebrow">Le manifeste</span>
        <h2 className="lp-manifest__lead">On n'est pas pour tout le monde. <em>Et on l'assume.</em></h2>
        <p className="lp-manifest__sub">
          Cardamome est faite pour celles et ceux qui veulent <strong>vraiment cuisiner</strong> : les
          amateurs motivés, pas les collectionneurs de recettes qu'ils ne feront jamais. On préfère
          servir à fond quelques passionnés que satisfaire mollement tout le monde.
        </p>
        <div className="lp-manifest__grid">
          <p><span className="lp-manifest__n">01</span>Plus de contenu ne rend pas une app <em>meilleure.</em></p>
          <p><span className="lp-manifest__n">02</span>Une recette sauvegardée <span className="lp-mute">n'est pas</span> une recette cuisinée.</p>
          <p><span className="lp-manifest__n">03</span>Le doublon n'est pas un choix, c'est du <span className="lp-mute">remplissage.</span></p>
          <p><span className="lp-manifest__n">04</span>Ce qui compte tient dans une assiette, <em>pas dans un compteur.</em></p>
        </div>
        {slideDown()}
      </section>

      {/* 8. Preuves d'usage */}
      <section className="lp-wrap lp-section lp-slide">
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
        {slideDown()}
      </section>

      {/* 9. Cardamome et Cardamome+ */}
      <section id="offre" className="lp-wrap lp-section lp-slide">
        <span className="lp-eyebrow">L'offre</span>
        <h2 className="lp-h2 lp-h2--wide">Cardamome, et Cardamome+.</h2>
        <p className="lp-p">
          Commence sans rien débourser. Passe à Cardamome+ le jour où tu veux l'import intelligent et
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
                <li key={f}><span className="lp-plan__check"><Icon name="check" size={13} weight="bold" /></span>{f}</li>
              ))}
            </ul>
          </div>
          <div className="lp-plan lp-plan--plus">
            <span className="lp-plan__flag">Recommandé</span>
            <h3 className="lp-plan__name">Cardamome+ <span className="lp-plan__badge">+</span></h3>
            <div className="lp-plan__price">
              <span className="lp-plan__amount">3,99 €</span>
              <span className="lp-plan__per">/ mois</span>
            </div>
            <p className="lp-plan__hint lp-plan__hint--save">ou 29,99 €/an, soit 2,50 €/mois.</p>
            <ul className="lp-plan__list">
              {PLAN_PLUS.map(([f, strong]) => (
                <li key={f}><span className="lp-plan__check"><Icon name="check" size={13} weight="bold" /></span>{strong ? <strong>{f}</strong> : f}</li>
              ))}
            </ul>
          </div>
        </div>
        {slideDown()}
      </section>

      {/* 10. Conclusion */}
      <section className="lp-wrap lp-section lp-final lp-slide">
        <h2 className="lp-final__title">Pas la plus grosse app. Celle que tu ouvres vraiment.</h2>
        <div className="lp-final__actions lp-cta-row">
          {primaryCta()}
          <StoreButtons />
        </div>
        <p className="lp-sign">Fait par des gens qui cuisinent pour de vrai, pas par un algorithme qui remplit des cases.</p>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer__inner">
          <div className="lp-footer__brand">
            <div className="lp-footer__mark">
              <LogoPod size={30} />
              <span className="lp-brand">Cardam<span className="lp-brand__dot">o</span>me<span className="lp-brand__dot">·</span></span>
            </div>
            <p className="lp-footer__tag">Cuisine, chaleur, gourmandise. L'app qui t'aide à cuisiner pour de vrai, pas à collectionner des recettes.</p>
            <StoreButtons />
          </div>
          <nav className="lp-footer__col">
            <span className="lp-footer__h">L'app</span>
            <a href="#probleme" onClick={scrollToId("probleme")}>Le problème</a>
            <a href="#import" onClick={scrollToId("import")}>Import intelligent</a>
            <a href="#offre" onClick={scrollToId("offre")}>L'offre</a>
          </nav>
          <nav className="lp-footer__col">
            <span className="lp-footer__h">Légal</span>
            <a href="/legal/terms">CGU</a>
            <a href="/legal/privacy">Confidentialité</a>
            <a href="/legal">Informations légales</a>
          </nav>
        </div>
        <div className="lp-wrap lp-footer__base">
          <span className="lp-footer__meta">© 2026 Cardamome · v{__APP_VERSION__}</span>
          <span className="lp-footer__made">Fait avec soin, pas à la chaîne.</span>
        </div>
      </footer>
    </div>
  );
}
