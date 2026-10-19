import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon.jsx";
import { RecipeCard } from "./RecipeCard.jsx";
import { OverscrollRow } from "../ui/OverscrollRow.jsx";
import { OfficialAvatar } from "../user/OfficialAvatar.jsx";
import { isOfficialAuthor, type PublicDoc } from "@/lib/household/publicRecipes.js";
import type { NutriLetter } from "@/lib/recipes/nutriscore.js";
import { relativeDate } from "../../lib/format.js";

export const DISCOVER_RED = "#e0554e";
// Largeur des cartes en carrousel : moitié de la rangée visible (2 cartes),
// plafonnée à 210px sur desktop, cf. explication `cqw` conservée de l'existant.
const CARD_W = "clamp(150px, calc(50cqw - 6px), 210px)";

// Halos sombres signature pour les tuiles cuisine (mêmes teintes que RecipePlaceholder
// + ambre & sarcelle pour la variété, comme le mockup). Teinte stable dérivée du nom.
const MOSAIC_HALOS = [
  "radial-gradient(115% 78% at 50% 118%, #b5512a 0%, #4a2f22 42%, #221a16 72%, #1a1411 100%)",
  "radial-gradient(115% 78% at 50% 118%, #3f7d52 0%, #243a2a 42%, #18211a 72%, #131a15 100%)",
  "radial-gradient(115% 78% at 50% 118%, #c98a2f 0%, #4a3a22 42%, #221d16 72%, #1a1611 100%)",
  "radial-gradient(115% 78% at 50% 118%, #2f8f88 0%, #22403c 42%, #16211f 72%, #131a19 100%)",
];
function haloForName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % 997;
  return MOSAIC_HALOS[h % MOSAIC_HALOS.length];
}

interface PublicRecipeCardProps {
  p: PublicDoc;
  onOpen: () => void;
  onAdd?: () => void;
  onAuthor: () => void;
  owned: boolean;
  inSeason: boolean;
  vegan: boolean;
  nutriLetter: NutriLetter | null;
  favorite: boolean;
  onToggleFavorite: () => void;
  style?: CSSProperties;
}

/** Carte d'une recette publique : visuel (hover-lift) + crédit créateur & date dessous. */
export function PublicRecipeCard({ p, onOpen, onAdd, onAuthor, owned, inSeason, vegan, nutriLetter, favorite, onToggleFavorite, style }: PublicRecipeCardProps) {
  return (
    <div>
      <div className="discover-card"><RecipeCard recipe={p.recipe} onClick={onOpen} inSeason={inSeason} vegan={vegan} nutriLetter={nutriLetter} favorite={favorite} onToggleFavorite={onToggleFavorite} style={style} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, padding: "0 2px" }}>
        <button onClick={onAuthor} title="Filtrer par ce créateur"
          style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {isOfficialAuthor(p.authorUid)
            ? <OfficialAvatar size={16} />
            : p.authorPhoto
              ? <img src={p.authorPhoto} alt="" referrerPolicy="no-referrer" style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0 }} />
              : <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--surface3)", flexShrink: 0 }} />}
          <span style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.authorName || "Anonyme"}</span>
          {owned && <Icon name="check" size={12} color="var(--ok)" />}
        </button>
        {!owned && onAdd ? (
          <button onClick={e => { e.stopPropagation(); onAdd(); }}
            style={{ marginLeft: "auto", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>
            <Icon name="plus" size={11} color="#fff" /> Ajouter
          </button>
        ) : !!p.createdAt && (
          <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 10.5, color: "var(--text3)" }}>{relativeDate(p.createdAt)}</span>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div>
      <div className="skeleton" style={{ width: "100%", aspectRatio: "16 / 10", borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 12, width: "85%", borderRadius: 6, marginTop: 10 }} />
      <div className="skeleton" style={{ height: 10, width: "55%", borderRadius: 6, marginTop: 7 }} />
    </div>
  );
}

function SkeletonRow({ titleWidth = 130, count = 10 }: { titleWidth?: number; count?: number }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div className="skeleton" style={{ height: 15, width: titleWidth, borderRadius: 6, marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 14, overflow: "hidden", containerType: "inline-size" }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ flex: `0 0 ${CARD_W}` }}><SkeletonCard /></div>
        ))}
      </div>
    </div>
  );
}

/** Squelette du feed éditorial pendant le premier chargement. */
export function DiscoverSkeleton() {
  return (
    <div style={{ paddingTop: 14 }}>
      <SkeletonRow titleWidth={110} />
      <SkeletonRow titleWidth={160} />
      <SkeletonRow titleWidth={130} />
    </div>
  );
}

type RenderCard = (p: PublicDoc, idx: number) => ReactNode;

/** Rangée horizontale de cartes publiques (défilement avec aimantation). */
export function DiscoverRow({ items, renderItem }: { items: PublicDoc[]; renderItem: RenderCard }) {
  return (
    <OverscrollRow stretch className="discover-row" style={{ gap: 14, paddingTop: 6, paddingBottom: 6 }} outerStyle={{ scrollSnapType: "x proximity", containerType: "inline-size" }}>
      {items.map((it, i) => (
        <div key={it.pubId} id={`discover-card-${it.pubId}`} style={{ flex: `0 0 ${CARD_W}`, scrollSnapAlign: "start" }}>{renderItem(it, i)}</div>
      ))}
    </OverscrollRow>
  );
}

interface CarouselProps {
  icon?: IconName;
  iconNode?: ReactNode;
  iconColor?: string;
  title: string;
  extra?: string;
  items: PublicDoc[];
  renderItem: RenderCard;
}

/** Rangée éditoriale titrée (carrousel) ; ne s'affiche pas si vide. */
export function Carousel({ icon, iconNode, iconColor = "var(--accent)", title, extra, items, renderItem }: CarouselProps) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
        {iconNode || (icon && <Icon name={icon} size={16} color={iconColor} />)}{title}
        {extra && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)" }}>{extra}</span>}
      </h3>
      <DiscoverRow items={items} renderItem={renderItem} />
    </div>
  );
}

/** Tuile de la mosaïque « Par cuisine ». */
export interface CuisineTile {
  label: string;
  emoji: string;
  count: number;
}

/** Mosaïque des cuisines présentes, chaque tuile ouvrant la catégorie. */
export function CuisineMosaic({ tiles, onSelect }: { tiles: CuisineTile[]; onSelect: (label: string) => void }) {
  if (!tiles.length) return null;
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="globe" size={16} color="var(--accent)" /> Par cuisine
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {tiles.map(c => (
          <button key={c.label} className="cuisine-tile ripple" onClick={() => onSelect(c.label)}
            style={{ position: "relative", aspectRatio: "4/3", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", cursor: "pointer", padding: 0, background: haloForName(c.label) }}>
            <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 32%, rgba(0,0,0,.55) 100%)" }} />
            <span style={{ position: "absolute", top: 9, right: 10, fontSize: 17 }}>{c.emoji}</span>
            <span style={{ position: "absolute", left: 14, bottom: 12, textAlign: "left" }}>
              <span style={{ display: "block", fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", textShadow: "0 2px 8px rgba(0,0,0,.45)" }}>{c.label}</span>
              <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,.82)", marginTop: 2 }}>{c.count} recette{c.count > 1 ? "s" : ""}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
