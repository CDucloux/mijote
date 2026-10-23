import { useEffect, useState } from "react";

/** Durée minimale d'affichage de l'écran de chargement à l'ouverture (ms). */
const MIN_BOOT_MS = 800;

/**
 * Tient l'écran de chargement au moins {@link MIN_BOOT_MS} après le montage.
 *
 * Sur un réseau rapide, l'auth se résout en quelques dizaines de ms : l'écran de
 * chargement ne serait qu'un flash. Ce délai laisse le temps de voir la gousse.
 * Ne s'applique pas à la coquille app (mobile installé / Capacitor), où le splash
 * d'ouverture couvre déjà le démarrage.
 *
 * @returns `true` tant que la durée minimale n'est pas écoulée.
 */
export function useBootHold(): boolean {
  const [held, setHeld] = useState(() => !document.documentElement.classList.contains("app-shell"));

  useEffect(() => {
    if (!held) return;
    const timer = setTimeout(() => setHeld(false), MIN_BOOT_MS);
    return () => clearTimeout(timer);
  }, [held]);

  return held;
}
