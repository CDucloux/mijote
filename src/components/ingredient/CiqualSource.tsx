import { Icon } from "../ui/Icon.jsx";
import { IngImage } from "../ui/Img.jsx";
import { ciqualUrl, CIQUAL_HOME } from "@/lib/food/ciqual.js";
import type { CiqualRef } from "@/lib/types";
import "../../styles/ciqual-source.css";

const ANSES_EMBLEM = "/brands/anses-emblem.png";

interface CiqualSourceProps {
  name: string;
  image?: string;
  ciqual?: CiqualRef;
}

/**
 * « D'où viennent ces valeurs » : la correspondance entre l'ingrédient et
 * l'aliment de la table Ciqual (Anses) dont il reprend les valeurs. Sans
 * référence, le bloc le dit au lieu de suggérer une source. La ligne légale
 * (paternité exigée par la Licence Ouverte) reste, en une ligne discrète.
 */
export function CiqualSource({ name, image, ciqual }: CiqualSourceProps) {
  const traced = !!ciqual?.code;
  return (
    <section className="ciq slide-up" style={{ animationDelay: "0.32s" }}>
      <div className="ciq-top">
        <h2 className="ciq-h">D'où viennent ces valeurs</h2>
        {traced && (
          // Logo en deux pièces : emblème en couleur, mot « anses » en masque teinté par le thème.
          <span className="ciq-anses" role="img" aria-label="Anses">
            <img src={ANSES_EMBLEM} alt="" />
            <i />
          </span>
        )}
      </div>
      <div className={`ciq-card${traced ? "" : " ciq-card--none"}`}>
        <div className="ciq-match">
          <div className="ciq-node">
            <IngImage src={image} alt="" size={40} />
            <span className="ciq-node__txt"><small>Dans Cardamome</small><b>{name}</b></span>
          </div>
          <span className="ciq-link" aria-hidden="true">
            <i /><span className="ciq-link__eq">{traced ? <Icon name="check" size={12} weight="bold" color="currentColor" /> : "?"}</span><i />
          </span>
          <div className="ciq-node ciq-node--end">
            <span className={`ciq-mark${traced ? "" : " ciq-mark--empty"}`}>{traced && <Icon name="leaf" size={16} color="#fff" />}</span>
            <span className="ciq-node__txt">
              <small>{traced ? `Table Ciqual · n° ${ciqual.code}` : "Table Ciqual"}</small>
              <b>{traced ? ciqual.name || `Aliment n° ${ciqual.code}` : "Pas d'équivalent"}</b>
            </span>
          </div>
        </div>
        <p className="ciq-lede">
          {traced
            ? <>Les valeurs nutritionnelles viennent de la <strong>table officielle de l'Anses</strong>, l'agence nationale de sécurité sanitaire de l'alimentation, mesurées pour 100 g.</>
            : <>Cet aliment ne figure pas dans la table officielle de l'Anses : ses valeurs ne sont pas rattachées à une mesure Ciqual.</>}
        </p>
        <div className="ciq-foot">
          <a className="ciq-open pressable" href={traced ? ciqualUrl(ciqual) : CIQUAL_HOME} target="_blank" rel="noopener noreferrer">
            {traced ? "Voir sur Ciqual" : "Parcourir la table"} <Icon name="externalLink" size={13} color="var(--text3)" />
          </a>
          {traced && <span className="ciq-legal">Anses, Ciqual 2025 · Licence Ouverte</span>}
        </div>
      </div>
    </section>
  );
}
