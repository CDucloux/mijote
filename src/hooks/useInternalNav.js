import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { internalNavPath } from "../lib/ui/internalLink.js";

// ─── NAVIGATION DES LIENS INTERNES DE LA PROSE MARKDOWN ──────────────────────────
// Rend un handler onClick à poser sur un conteneur de prose (HTML injecté). Il
// intercepte les clics d'ancres internes (/guide/..., /legal/...) et les route via
// React Router au lieu d'un rechargement plein écran. Les liens externes, nouveaux
// onglets et clics modifiés gardent leur comportement natif (cf. internalNavPath).
export function useInternalNav() {
  const navigate = useNavigate();
  return useCallback((e) => {
    const anchor = e.target.closest("a");
    if (!anchor) return;
    const path = internalNavPath({
      href: anchor.getAttribute("href"),
      target: anchor.getAttribute("target"),
      modified: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0,
    });
    if (!path) return;
    e.preventDefault();
    navigate(path);
  }, [navigate]);
}
