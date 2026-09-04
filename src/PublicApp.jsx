import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage.jsx";
import { LegalPage } from "./pages/LegalPage.jsx";
import { useTheme } from "./hooks/useTheme.js";
import { useAuthUser } from "./hooks/useAuthUser.js";
import { useStatusBarSync } from "./hooks/useStatusBarSync.js";
import { toAppPath } from "./lib/ui/appZone.js";

// ─── ZONE PUBLIQUE (racine) ──────────────────────────────────────────────────
// Vitrine marketing (/), documents légaux (/legal…) et point d'entrée des liens
// partagés (/discover…), servis HORS du préfixe /app. Le rendu réel d'une recette
// partagée vit dans l'app (login + DB master), donc /discover redirige vers
// /app/discover/:id ; les anciennes URL plates (/home, /plan…) y sont aussi
// renvoyées (rétro-compat des favoris et des PWA déjà installées). La zone app,
// elle, est montée par App.jsx sous basename="/app". Cf. src/lib/ui/appZone.ts.

/** Renvoie (rechargement complet) vers l'équivalent /app du chemin courant. */
function RedirectToApp() {
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    window.location.replace(toAppPath(pathname) + search + hash);
  }, []);
  return null;
}

export function PublicApp() {
  const { isDark, toggleTheme } = useTheme();
  useStatusBarSync(isDark); // aligne la barre système sur le thème (landing sombre/clair)
  const { user } = useAuthUser();

  return (
    <Routes>
      {/* Vitrine publique : le CTA principal s'adapte à l'état d'auth et pointe vers
          l'app (résolue via la redirection ci-dessous). */}
      <Route path="/" element={<LandingPage user={user} isDark={isDark} toggleTheme={toggleTheme} />} />
      {/* Documents légaux, consultables même déconnecté (URL publique stable). */}
      <Route path="/legal/*" element={<div style={{ height: "100dvh", background: "var(--bg)", color: "var(--text)" }}><LegalPage /></div>} />
      {/* /discover/:id (liens partagés) et toute ancienne URL plate d'app → /app/… */}
      <Route path="*" element={<RedirectToApp />} />
    </Routes>
  );
}
