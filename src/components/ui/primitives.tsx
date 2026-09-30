import type { CSSProperties, ElementType, ReactNode } from "react";

/**
 * Primitives de mise en page & typographie, une fine couche pour dégraisser les
 * `style={{ … }}` répétés dans les écrans. Elles s'appuient sur les tokens CSS
 * existants (`var(--surface)`, `var(--text)`, `var(--accent)`…), acceptent
 * toujours un `style` qui SURCHARGE les défauts, et transmettent le reste des
 * props (onClick, ref via `as`, aria-*, …).
 *
 * @module ui/primitives
 */

// Props transmises telles quelles à la balise sous-jacente (onClick, aria-*, …).
type PassthroughProps = Record<string, unknown>;

interface BoxProps extends PassthroughProps {
  as?: ElementType;
  style?: CSSProperties;
  children?: ReactNode;
}

interface RowProps extends BoxProps {
  gap?: number | string;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  wrap?: boolean;
}

/**
 * Rangée flex (horizontale). `align` = alignItems (défaut « center »), `justify` =
 * justifyContent, `gap`, `wrap`. `as` change la balise (ex. « button »).
 */
export function Row({ gap, align = "center", justify, wrap, as: Tag = "div", style, ...rest }: RowProps) {
  return (
    <Tag
      style={{
        display: "flex",
        alignItems: align,
        ...(justify && { justifyContent: justify }),
        ...(gap != null && { gap }),
        ...(wrap && { flexWrap: "wrap" }),
        ...style,
      }}
      {...rest}
    />
  );
}

/** Colonne flex (verticale). Mêmes options que {@link Row}. */
export function Col({ gap, align, justify, as: Tag = "div", style, ...rest }: RowProps) {
  return (
    <Tag
      style={{
        display: "flex",
        flexDirection: "column",
        ...(align && { alignItems: align }),
        ...(justify && { justifyContent: justify }),
        ...(gap != null && { gap }),
        ...style,
      }}
      {...rest}
    />
  );
}

interface CardProps extends BoxProps {
  pad?: number | string;
  radius?: number | string;
}

/** Carte « surface » : fond, bordure, rayon et padding par défaut, tous surchargeables. */
export function Card({ pad = 16, radius = 16, as: Tag = "div", style, ...rest }: CardProps) {
  return (
    <Tag
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: radius,
        padding: pad,
        ...style,
      }}
      {...rest}
    />
  );
}

interface PillProps extends BoxProps {
  gap?: number | string;
}

/** Conteneur « pill » (inline-flex arrondi). `as="button"` pour un bouton pilule. */
export function Pill({ gap = 6, as: Tag = "span", style, ...rest }: PillProps) {
  return (
    <Tag
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        borderRadius: 999,
        ...style,
      }}
      {...rest}
    />
  );
}

/** Libellé de section en petites capitales espacées (au-dessus d'un champ / groupe). */
export function SectionLabel({ style, ...rest }: BoxProps) {
  return (
    <span
      style={{
        display: "block",
        fontSize: 11.5,
        fontWeight: 600,
        color: "var(--text2)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        ...style,
      }}
      {...rest}
    />
  );
}

interface IconChipProps extends BoxProps {
  size?: number;
  radius?: number | string;
  tint?: string;
}

/**
 * Pastille d'icône : carré arrondi centré, teinté accent par défaut. Reçoit
 * l'icône en `children`. `tint` change le fond, `size`/`radius` la géométrie.
 */
export function IconChip({ size = 46, radius = 14, tint = "rgba(var(--accent-rgb),0.12)", as: Tag = "span", style, children, ...rest }: IconChipProps) {
  return (
    <Tag
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: tint,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
