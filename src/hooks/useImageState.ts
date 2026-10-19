import { useState, useLayoutEffect, useRef } from "react";
import { imgAlreadyLoaded } from "../lib/ui/imageLoad.js";

/** État de chargement d'une image et handlers à brancher sur son `<img>`. */
export interface ImageState {
  loaded: boolean;
  err: boolean;
  imgRef: React.RefObject<HTMLImageElement | null>;
  onLoad: () => void;
  onError: () => void;
}

/**
 * État de chargement d'une image, rattaché à SA source : `loaded`/`err` valent pour
 * la `src` qui les a produits, un changement de source les invalide de lui-même.
 * Pas d'effet de remise à zéro au montage : il s'exécutait APRÈS la détection du
 * cache (useLayoutEffect) et rebasculait en « chargement » une image déjà affichée,
 * dont l'évènement `load` ne revient jamais (spinner infini après un réordonnancement).
 *
 * @param src - Source de l'image (absente : ni chargée ni en erreur).
 * @returns L'état et les handlers `ref` / `onLoad` / `onError` de l'`<img>`.
 */
export function useImageState(src: string | undefined): ImageState {
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>();
  const [errSrc, setErrSrc] = useState<string | undefined>();
  const imgRef = useRef<HTMLImageElement>(null);
  // Image servie depuis le cache : son évènement `load` a pu partir avant que le
  // handler onLoad ne soit attaché. On la révèle dès le montage si elle est déjà
  // complète (avant peinture, sans clignotement).
  useLayoutEffect(() => {
    if (imgAlreadyLoaded(imgRef.current)) setLoadedSrc(src);
  }, [src]);
  return {
    loaded: !!src && loadedSrc === src,
    err: !!src && errSrc === src,
    imgRef,
    onLoad: () => setLoadedSrc(src),
    onError: () => setErrSrc(src),
  };
}
