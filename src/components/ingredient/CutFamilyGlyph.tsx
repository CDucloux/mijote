import type { ReactNode } from "react";
import type { CutFamily } from "@/lib/recipes/cutGuide.js";

// ─── PICTOGRAMMES DE DÉCOUPE ──────────────────────────────────────────────────
// Un pictogramme par famille, dessinant le RÉSULTAT sur la planche (tranches, cubes,
// éclats, bâtons, quartiers) plutôt que le geste. Tracé au trait 1.5 dans un repère
// 24 pour s'accorder au poids « regular » de Phosphor. Les morceaux sont posés de
// travers, comme sortis du couteau : jamais une grille parfaite.

interface CutFamilyGlyphProps {
  family: CutFamily;
  size?: number;
  color?: string;
}

const SHAPES: Record<CutFamily, ReactNode> = {
  tranches: (
    <>
      <ellipse cx="6.5" cy="12.5" rx="2.2" ry="6" transform="rotate(-10 6.5 12.5)" />
      <ellipse cx="12" cy="12" rx="2.2" ry="6" transform="rotate(-4 12 12)" />
      <ellipse cx="17.5" cy="11.5" rx="2.2" ry="6" transform="rotate(5 17.5 11.5)" />
    </>
  ),
  cubes: (
    <>
      <rect x="8.5" y="3.5" width="6" height="6" rx="1.3" transform="rotate(-6 11.5 6.5)" />
      <rect x="3.5" y="12.5" width="7" height="7" rx="1.5" transform="rotate(-9 7 16)" />
      <rect x="13.5" y="13" width="6.5" height="6.5" rx="1.4" transform="rotate(11 16.75 16.25)" />
    </>
  ),
  fin: (
    <path d="M5 9.5l2-1M10.5 5.5l1.5 1.3M16 7.5l2 .5M6.5 14.5l1.8.9M12.5 11.5l-1.4 1.5M17.5 13.5l1.1-1.7M8.5 19l2 .1M14.5 18l1.5 1.3" />
  ),
  batons: (
    <>
      <rect x="4.5" y="4.5" width="3" height="15" rx="1.2" transform="rotate(24 6 12)" />
      <rect x="10.5" y="4" width="3" height="15.5" rx="1.2" transform="rotate(20 12 11.75)" />
      <rect x="16.5" y="5" width="3" height="14.5" rx="1.2" transform="rotate(27 18 12.25)" />
    </>
  ),
  // Une orange en quartiers, le dernier quartier légèrement écarté des autres.
  morceaux: (
    <>
      <path d="M12 12V4.5A7.5 7.5 0 0 1 19.5 12Z" transform="translate(.9 -.9)" />
      <path d="M12 12H4.5A7.5 7.5 0 0 1 12 4.5Z" transform="translate(-.9 -.9)" />
      <path d="M12 12V19.5A7.5 7.5 0 0 1 4.5 12Z" transform="translate(-.9 .9)" />
      <path d="M12 12H19.5A7.5 7.5 0 0 1 12 19.5Z" transform="translate(1.9 1.9)" />
    </>
  ),
};

/** Pictogramme d'une famille de découpe (contour, couleur héritée par défaut). */
export function CutFamilyGlyph({ family, size = 20, color = "currentColor" }: CutFamilyGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {SHAPES[family]}
    </svg>
  );
}
