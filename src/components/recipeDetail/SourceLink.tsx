import type { CSSProperties, ReactNode, Ref } from "react";
import { Icon } from "../ui/Icon.jsx";
import { outboundSourceHref, sourceHost } from "@/lib/sources/outboundLink.js";
import { recordSourceClick } from "@/lib/firebase/sourceClicks.js";

interface SourceLinkProps {
  source: string;
  style?: CSSProperties;
  iconSize?: number;
  iconColor?: string;
  /** Texte avant le domaine (ex. « d'après »). */
  prefix?: ReactNode;
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * Lien vers la source d'origine d'une recette : domaine affiché, URL marquée
 * `ref=cardamome` et clic compté pour le bilan des créatrices. Une source non
 * web (« Livre de mamie ») s'affiche en texte simple, sans lien.
 */
export function SourceLink({ source, style, iconSize = 10, iconColor = "rgba(255,255,255,0.65)", prefix, ref }: SourceLinkProps) {
  const href = outboundSourceHref(source);
  const label = <>{prefix ? <>{prefix} </> : null}{sourceHost(source)}</>;
  const base: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: iconColor, textDecoration: "none", ...style };
  // Source non web : un <a> sans href (lien inactif) garde le même élément, donc le
  // même type de ref pour l'animation du hero, sans faux lien cliquable.
  if (!href) return <a ref={ref} style={base}>{label}</a>;
  return (
    <a ref={ref} href={href} target="_blank" rel="noopener noreferrer" style={base}
      onClick={() => { void recordSourceClick(source); }}>
      {label}
      <Icon name="externalLink" size={iconSize} color={iconColor} />
    </a>
  );
}
