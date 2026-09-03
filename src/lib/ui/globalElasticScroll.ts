import { attachElasticScroll, type ElasticScrollOptions } from "@/lib/ui/elasticScrollCore.js";

/**
 * Délégation GLOBALE de l'overscroll « stretch » (cf. installGlobalRipple pour l'onde
 * tactile) : une page déclare son corps défilant avec l'attribut `data-elastic-scroll`
 * et l'effet s'y attache tout seul, sans câbler de hook ni de refs. La mécanique reste
 * `attachElasticScroll` (elasticScrollCore), partagée avec `useElasticScroll` pour les
 * cas spéciaux (feuilles à hauteur bornée, panneaux multiples, `armWhenUnscrollable`…).
 *
 * L'enfant transformé (scaleY) est l'enfant direct marqué `data-elastic-content`, ou à
 * défaut le premier enfant élément du conteneur (qui doit donc envelopper tout le
 * contenu défilable). Réglages optionnels par attributs : `data-elastic-max` (px) et la
 * présence de `data-elastic-arm-unscrollable` (armer même sans défilement).
 *
 * @module globalElasticScroll
 */

/** Sélecteur d'opt-in : tout conteneur défilant portant l'effet en délégation. */
export const ELASTIC_SELECTOR = "[data-elastic-scroll]";

/**
 * Enfant à transformer pour un conteneur : l'enfant direct `data-elastic-content` s'il
 * existe, sinon le premier enfant élément (censé envelopper tout le contenu).
 *
 * @param container - Le conteneur défilant marqué.
 * @returns L'élément transformé, ou `null` si le conteneur n'a aucun enfant élément.
 */
export function elasticContentOf(container: Element): HTMLElement | null {
  const marked = container.querySelector<HTMLElement>(":scope > [data-elastic-content]");
  if (marked) return marked;
  const first = container.firstElementChild;
  return first instanceof HTMLElement ? first : null;
}

/**
 * Lit les réglages de l'effet depuis les attributs `data-*` du conteneur.
 *
 * @param container - Le conteneur défilant marqué.
 * @returns Les options passées à `attachElasticScroll`.
 */
export function elasticOptionsFrom(container: Element): ElasticScrollOptions {
  const raw = container.getAttribute("data-elastic-max");
  const max = raw != null && raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
  return { max, armWhenUnscrollable: container.hasAttribute("data-elastic-arm-unscrollable") };
}

/** Collecte les conteneurs marqués dans un noeud (lui-même inclus). */
function matchesIn(node: Node): HTMLElement[] {
  if (!(node instanceof HTMLElement)) return [];
  const out = node.matches(ELASTIC_SELECTOR) ? [node] : [];
  return out.concat(Array.from(node.querySelectorAll<HTMLElement>(ELASTIC_SELECTOR)));
}

let installed = false;

/**
 * Installe la délégation globale : attache l'effet à tout conteneur `data-elastic-scroll`
 * présent ou ajouté ensuite (navigation entre pages), et le détache au démontage.
 * Réservé aux pointeurs grossiers (mobile/tactile) : sur souris fine, on ne fait rien.
 * Idempotent (une seule installation à la fois).
 *
 * @param root - Racine observée (défaut `document.body`).
 * @returns Fonction de désinstallation (détache tout, coupe l'observateur).
 */
export function installGlobalElasticScroll(root?: HTMLElement): () => void {
  if (typeof document === "undefined" || typeof window === "undefined") return () => {};
  if (window.matchMedia && !window.matchMedia("(hover: none)").matches) return () => {};
  if (installed) return () => {};
  installed = true;

  const host = root ?? document.body;
  const attached = new Map<HTMLElement, () => void>();

  const attach = (el: HTMLElement): void => {
    if (attached.has(el)) return;
    const content = elasticContentOf(el);
    if (!content) return; // rien à transformer : on n'attache pas (aucune casse de layout)
    attached.set(el, attachElasticScroll(el, content, elasticOptionsFrom(el)));
  };
  const detach = (el: HTMLElement): void => {
    const off = attached.get(el);
    if (off) { off(); attached.delete(el); }
  };

  matchesIn(host).forEach(attach);
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => matchesIn(n).forEach(attach));
      r.removedNodes.forEach((n) => matchesIn(n).forEach(detach));
    }
  });
  observer.observe(host, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    attached.forEach((off) => off());
    attached.clear();
    installed = false;
  };
}
