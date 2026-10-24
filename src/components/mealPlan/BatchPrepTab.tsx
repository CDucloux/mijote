import { Icon } from "../ui/Icon.jsx";
import { Img } from "../ui/Img.jsx";
import { fmtQtyUnit } from "@/lib/format.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { prepGain, prepKey, type PrepStage } from "@/lib/planning/batchPlan.js";
import type { PrepItem } from "@/lib/planning/batchSession.js";

interface BatchPrepTabProps {
  stages: PrepStage[];
  /** Gestes de découpe notés dans les recettes, par nom d'ingrédient normalisé. */
  decoupeByName: Map<string, Set<string>>;
  isChecked: (key: string) => boolean;
  onToggle: (key: string) => void;
}

/** Une ligne de la découpe groupée : case, vignette, quantité, geste, recettes, gain. */
function PrepRow({ item, geste, checked, onToggle }: { item: PrepItem; geste: string | null; checked: boolean; onToggle: () => void }) {
  const gain = prepGain(item);
  const qty = item.unit ? fmtQtyUnit(item.amount, item.unit) : `${item.amount}`;
  return (
    <button type="button" className={`bt-prep${checked ? " is-done" : ""}`} aria-pressed={checked} onClick={onToggle}>
      <span className="bt-check">{checked && <Icon name="check" size={12} color="#fff" />}</span>
      <span className="bt-prep__img">{item.image ? <Img src={item.image} alt="" /> : item.name.charAt(0)}</span>
      <span className="bt-prep__t">
        <b>{item.name}<em>{qty}{item.pieces ? ` · ~${item.pieces}` : ""}</em></b>
        <span>{geste && <strong>{geste}</strong>}{geste && " · "}pour {item.usedBy.join(", ")}</span>
      </span>
      {gain > 0 && !checked ? <span className="bt-gain">−{gain} min</span> : <span />}
    </button>
  );
}

/**
 * Onglet « Préparer » de la session batch : la découpe groupée de la semaine dans
 * un ordre de travail (légumes clairs, aromatiques, cru, le reste). Ce qui est
 * coché descend dans « Fait » ; le temps gagné en groupant est chiffré en bas.
 */
export function BatchPrepTab({ stages, decoupeByName, isChecked, onToggle }: BatchPrepTabProps) {
  const gesteOf = (item: PrepItem): string | null => {
    const cuts = decoupeByName.get(normalizeStr(item.name));
    return cuts?.size ? [...cuts].join(" · ") : item.prepTip ?? null;
  };
  const all = stages.flatMap(stage => stage.items);
  const done = all.filter(item => isChecked(prepKey(item)));
  const saved = all.reduce((sum, item) => sum + prepGain(item), 0);
  if (!all.length) return <p className="bt-empty">Rien à découper cette semaine : les recettes n'ont pas de légumes, d'herbes ni de viande à préparer.</p>;
  return (
    <>
      {stages.map((stage, index) => {
        const todo = stage.items.filter(item => !isChecked(prepKey(item)));
        if (!todo.length) return null;
        return (
          <section key={stage.id} className="bt-stage">
            <header className="bt-stage__h"><span className="bt-stage__n">{index + 1}</span><b>{stage.label}</b>{stage.hint && <span>{stage.hint}</span>}</header>
            {todo.map(item => <PrepRow key={item.key} item={item} geste={gesteOf(item)} checked={false} onToggle={() => onToggle(prepKey(item))} />)}
          </section>
        );
      })}
      {done.length > 0 && (
        <section className="bt-stage">
          <header className="bt-stage__h is-done">Fait · {done.length}</header>
          {done.map(item => <PrepRow key={item.key} item={item} geste={gesteOf(item)} checked onToggle={() => onToggle(prepKey(item))} />)}
        </section>
      )}
      {saved > 0 && (
        <div className="bt-saved"><span className="bt-saved__hand">−{saved} min</span><span>gagnées en groupant la découpe plutôt qu'en sortant la planche pour chaque recette (estimation).</span></div>
      )}
    </>
  );
}
