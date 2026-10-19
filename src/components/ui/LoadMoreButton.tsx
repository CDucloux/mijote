import { Icon } from "./Icon.jsx";
import "../../styles/load-more.css";

interface LoadMoreButtonProps {
  onClick: () => void;
  loading: boolean;
  /** Action, ex. « Voir plus de recettes ». */
  label: string;
  /** Complément discret, ex. « 80 restantes ». */
  hint: string;
}

/**
 * Pill « voir plus » sous une liste paginée à la main (recettes, étagères du
 * stock). Pendant `loading`, spinner + « Chargement… » et clics ignorés.
 */
export function LoadMoreButton({ onClick, loading, label, hint }: LoadMoreButtonProps) {
  return (
    <div className="load-more-row">
      <button type="button" onClick={onClick} disabled={loading} aria-busy={loading} className="load-more pressable ripple">
        {loading ? (
          <><span className="load-more__spin" aria-hidden="true" />Chargement…</>
        ) : (
          <><Icon name="chevronDown" size={16} color="var(--text2)" />{label}<small>· {hint}</small></>
        )}
      </button>
    </div>
  );
}
