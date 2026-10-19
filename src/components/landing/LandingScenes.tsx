import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon.jsx";

// ─── Maquettes vivantes (tokens + composants de l'app, aucun asset) ───────────

/** Châssis « téléphone » qui encadre une scène d'app. Purement décoratif. */
export function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="lp-device" role="img" aria-label={label}>
      <span className="lp-device__notch" aria-hidden="true" />
      <div className="lp-device__screen">{children}</div>
    </div>
  );
}

/** Scène de la slide « Notre parti pris » : une nuée de vignettes de recettes
 *  ternes (le catalogue pléthorique) et UNE SEULE mise en avant. Illustre « on
 *  pourrait t'en donner 15 000, mais tu en veux une, la bonne ». Pas un
 *  téléphone : une composition abstraite, en tokens. */
export function SceneChosen() {
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
interface RecipeCardMockProps {
  name: string;
  time: string;
  ings: number;
  nutri: string;
  season: boolean;
  halo: string;
  className?: string;
  style?: CSSProperties;
}

function RecipeCardMock({ name, time, ings, nutri, season, halo, className, style }: RecipeCardMockProps) {
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
export function SceneCardPile() {
  return (
    <div className="lp-cardpile" aria-hidden="true">
      {PILE.map(({ s: pos, ...c }) => (
        <RecipeCardMock
          key={c.name}
          {...c}
          className="lp-cardpile__card"
          style={{ left: pos.left, top: pos.top, transform: `rotate(${pos.rotate})`, zIndex: pos.zIndex }}
        />
      ))}
    </div>
  );
}

/** Étagère de livres de cuisine : ce que tu aimes déjà. Tons chauds (oak/spice),
 *  un marque-page. Illustre « Tu as 15 livres de cuisine. Tu les aimes ». */
export function SceneBooks() {
  // Vrais grands livres de cuisine, chefs reconnus (les plus longs titres sur les
  // dos les plus hauts) : Escoffier, Bocuse, Saint-Ange, Gouffé, Fernand Point.
  const books: { t: string; tone: string; h: number; lean?: string; mark?: boolean }[] = [
    { t: "Le Guide Culinaire", tone: "oak", h: 148, lean: "-2deg" },
    { t: "La Cuisine du marché", tone: "spice", h: 168, mark: true },
    { t: "La Bonne Cuisine", tone: "accent", h: 138 },
    { t: "Le Livre de Cuisine", tone: "ink", h: 158, lean: "1.5deg" },
    { t: "Ma Gastronomie", tone: "oak2", h: 130 },
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
export function SceneEditor() {
  const tabs: [icon: IconName, label: string, on: boolean][] = [["info", "Infos", true], ["leaf", "Ingrédients", false], ["utensils", "Ustensiles", false], ["list2", "Étapes", false]];
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
