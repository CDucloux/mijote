import { useEffect, useRef } from "react";
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

/** Scène du hero : un frigo ouvert, presque vide, et un « ? » qui flotte. Écho
 *  direct au visiteur « planté devant son frigo à se demander quoi faire à
 *  manger » : ce n'est pas l'app, c'est le PROBLÈME que l'app résout. 100% CSS
 *  (formes + tokens), aucun asset, theme-aware, le « ? » respire (coupé si
 *  mouvement réduit). */
function SceneFridge() {
  return (
    <div className="lp-fridge" aria-hidden="true">
      <div className="lp-fridge__body">
        <span className="lp-fridge__light" />
        <div className="lp-fridge__inside">
          <div className="lp-fridge__shelf">
            <span className="lp-fr lp-fr--milk" />
            <span className="lp-fr lp-fr--jar" />
            <span className="lp-fr lp-fr--bottle lp-fr--push" />
          </div>
          <div className="lp-fridge__shelf">
            <span className="lp-fr lp-fr--eggbox" />
            <span className="lp-fr lp-fr--butter" />
            <span className="lp-fr lp-fr--lemon lp-fr--push" />
            <span className="lp-fr lp-fr--tomato" />
          </div>
          <div className="lp-fridge__shelf">
            <span className="lp-fr lp-fr--cheese" />
            <span className="lp-fr lp-fr--bowl lp-fr--push" />
            <span className="lp-fr lp-fr--bottle2" />
          </div>
          <div className="lp-fridge__crisper">
            <span className="lp-veg lp-veg--carrot" />
            <span className="lp-veg lp-veg--greens" />
            <span className="lp-fridge__cripanel" />
          </div>
        </div>
      </div>
      <span className="lp-fridge__handle" />
      <span className="lp-fridge__q">?</span>
    </div>
  );
}

/** Scène de la slide « Notre parti pris » : une nuée de vignettes de recettes
 *  ternes (le catalogue pléthorique) et UNE SEULE mise en avant. Illustre « on
 *  pourrait t'en donner 15 000, mais tu en veux une, la bonne ». Pas un
 *  téléphone : une composition abstraite, en tokens. */
function SceneChosen() {
  const total = 24;
  const pick = 9;
  return (
    <div className="lp-chosen" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`lp-chosen__t${i === pick ? " lp-chosen__t--on" : ""}`}>
          {i === pick && <Icon name="check" size={15} weight="bold" color="#fff" />}
        </span>
      ))}
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

/** Éditeur de nouvelle recette : reproduit l'écran réel de création (onglets
 *  Infos / Ingrédients / Ustensiles / Étapes, sélecteur de photo, champs). Les
 *  champs se remplissent en cascade (nom tapé au clavier puis portions, temps,
 *  catégorie), pour montrer une recette qui prend forme. 100% CSS, coupé si
 *  mouvement réduit. Illustre « ta recette devient un objet structuré ». */
function SceneEditor() {
  const tabs = [["info", "Infos", true], ["leaf", "Ingrédients", false], ["utensils", "Ustensiles", false], ["list2", "Étapes", false]];
  return (
    <div className="lp-scene lp-ed" aria-hidden="true">
      <div className="lp-ed__top">
        <span className="lp-ed__x"><Icon name="close" size={11} color="var(--text2)" /></span>
        <div className="lp-ed__titles">
          <span className="lp-ed__kicker">Nouvelle recette</span>
          <span className="lp-ed__name">
            <span className="lp-ed__name-ph">Sans titre</span>
            <span className="lp-ed__name-real">Tarte Tatin</span>
          </span>
        </div>
        <span className="lp-ed__save"><Icon name="save" size={11} color="#fff" /></span>
      </div>
      <div className="lp-ed__tabs">
        {tabs.map(([ic, lb, on]) => (
          <span key={lb} className={`lp-ed__tab${on ? " lp-ed__tab--on" : ""}`}>
            <Icon name={ic} size={13} weight={on ? "fill" : "regular"} color={on ? "var(--accent)" : "var(--text3)"} />
            {lb}
          </span>
        ))}
      </div>
      <div className="lp-ed__body">
        <div className="lp-ed__photo">
          <Icon name="photo" size={19} color="var(--text3)" />
          <span>Choisir une photo</span>
          <small>Galerie ou appareil photo</small>
        </div>
        <div className="lp-ed__field">
          <label>Nom</label>
          <div className="lp-ed__input">
            <span className="lp-ed__typed">Tarte Tatin</span>
            <i className="lp-ed__caret" />
          </div>
        </div>
        <div className="lp-ed__row2">
          <div className="lp-ed__field lp-ed__fill lp-ed__fill--a">
            <label>Portions</label>
            <div className="lp-ed__input lp-ed__input--sm"><Icon name="portions" size={11} color="var(--text3)" /> 4 pers.</div>
          </div>
          <div className="lp-ed__field lp-ed__fill lp-ed__fill--b">
            <label>Temps</label>
            <div className="lp-ed__input lp-ed__input--sm"><Icon name="clock" size={11} color="var(--text3)" /> 45 min</div>
          </div>
        </div>
        <div className="lp-ed__chips lp-ed__fill lp-ed__fill--c">
          <span className="lp-ed__chip">Dessert</span>
          <span className="lp-ed__chip">De saison</span>
        </div>
      </div>
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
  // Chevron « suivant » : un SEUL bouton flottant (position fixe), toujours au même
  // endroit à l'écran (les slides n'ont pas exactement la même hauteur, un bouton
  // par slide tombait donc à des positions légèrement différentes). Il descend vers
  // la première section dont le haut est encore sous le haut du viewport.
  const nextRef = useRef(null);
  const goNext = () => {
    const secs = rootRef.current?.querySelectorAll("section.lp-slide");
    if (!secs) return;
    for (const s of secs) {
      if (s.getBoundingClientRect().top > 8) {
        s.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
  };
  // Masque le chevron une fois la dernière slide atteinte (getBoundingClientRect
  // suffit : indépendant du conteneur de défilement, window ou .lp-root).
  useEffect(() => {
    const secs = rootRef.current?.querySelectorAll("section.lp-slide");
    const last = secs && secs[secs.length - 1];
    const btn = nextRef.current;
    if (!last || !btn) return;
    const io = new IntersectionObserver(
      ([entry]) => btn.classList.toggle("lp-next--hidden", entry.isIntersecting),
      { threshold: 0.4 },
    );
    io.observe(last);
    return () => io.disconnect();
  }, []);

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

      {/* Chevron « suivant » unique et flottant : position fixe, donc toujours au
          même endroit à l'écran quelle que soit la hauteur de la slide courante. */}
      <button ref={nextRef} className="lp-next" onClick={goNext} aria-label="Section suivante">
        <Icon name="chevronDown" size={20} />
      </button>

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
            <SceneFridge />
          </div>
        </div>
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
      </section>

      {/* 4. Ce que fait Cardamome : la recette devient un objet structuré et vivant */}
      <section className="lp-wrap lp-section lp-slide">
        <div className="lp-split lp-split--reverse">
          <div>
            <span className="lp-eyebrow">Ce que fait Cardamome</span>
            <h2 className="lp-h2 lp-h2--wide">Une recette n'est pas juste du texte. Cardamome le sait.</h2>
            <p className="lp-p">
              Chaque recette est <strong>structurée</strong> : ingrédients, ustensiles, étapes. Et le
              mode pas à pas t'accompagne sur les <strong>gestes techniques</strong>, saisir,
              émulsionner, monter, pile au moment où tu les réalises.
            </p>
            <p className="lp-punch">
              Tu n'exécutes pas naïvement. <em>Tu apprends quelque chose de nouveau à chaque recette.</em>
            </p>
          </div>
          <div className="lp-split__media">
            <div className="lp-dock">
              <PhoneFrame label="L'éditeur de recette de Cardamome : les champs se remplissent"><SceneEditor /></PhoneFrame>
              <span className="lp-dock__bar" aria-hidden="true" />
            </div>
          </div>
        </div>
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
      </section>

      {/* 6. Prise de position sur le catalogue */}
      <section className="lp-wrap lp-section lp-slide">
        <div className="lp-split lp-split--reverse">
          <div className="lp-split__media">
            <SceneChosen />
          </div>
          <div>
            <span className="lp-eyebrow">Notre parti pris</span>
            <h2 className="lp-h2 lp-h2--wide">On pourrait te donner des milliers de recettes. À quoi bon ?</h2>
            <p className="lp-p">
              Tu n'as pas besoin de 47 carbonara. Tu en veux une : la bonne, celle que tu réussis et
              que tu recuisines. Découvrir les recettes des autres reste possible, et se cloner d'un
              geste. Choisi, pas entassé.
            </p>
            <p className="lp-punch">
              Une bonne app ne t'occupe pas pendant que tu cherches quoi faire. <em>Elle t'aide à cuisiner.</em>
            </p>
          </div>
        </div>
      </section>

      {/* 7. Manifeste : pleine largeur, prise de position assumée */}
      <section id="manifeste" className="lp-wrap lp-section lp-slide lp-manifest">
        <span className="lp-eyebrow">Le manifeste</span>
        <div className="lp-manifest__head">
          <h2 className="lp-manifest__lead">On n'est pas pour tout le monde. <em>Et on l'assume.</em></h2>
          <p className="lp-manifest__sub">
            Cardamome est faite pour celles et ceux qui veulent <strong>vraiment cuisiner</strong> : les
            amateurs motivés, pas les collectionneurs de recettes qu'ils ne feront jamais. On préfère
            servir à fond quelques passionnés que satisfaire mollement tout le monde.
          </p>
        </div>
        <div className="lp-manifest__grid">
          <p><span className="lp-manifest__n">01</span>Plus de contenu ne rend pas une app <em>meilleure.</em></p>
          <p><span className="lp-manifest__n">02</span>Une recette n'existe vraiment qu'une fois <em>cuisinée.</em></p>
          <p><span className="lp-manifest__n">03</span>Le temps passé ici, c'est du temps <span className="lp-mute">volé à ta cuisine.</span></p>
          <p><span className="lp-manifest__n">04</span>On te veut meilleur cuisinier, <span className="lp-mute">pas meilleur client.</span></p>
        </div>
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
