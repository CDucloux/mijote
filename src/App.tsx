import { useEffect } from "react";
import { useLocation, Navigate, Routes, Route } from "react-router-dom";
import type { User } from "firebase/auth";
import { signInWithGoogle } from "@/lib/firebase/auth.js";
import { useTheme } from "./hooks/useTheme.js";
import { useOverlayThemeColor } from "./hooks/useOverlayThemeColor.js";
import { useStatusBarSync } from "./hooks/useStatusBarSync.js";
import { useAuthUser } from "./hooks/useAuthUser.js";
import { AppInner } from "./AppInner.jsx";
import { LegalPage } from "./pages/LegalPage.jsx";
import { LoadingPage } from "./pages/LoadingPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";

const fromPathOf = (state: unknown): string | null =>
  state && typeof state === "object" && "from" in state && typeof state.from === "string" ? state.from : null;

// Une fois connecté sur /login, on revient à la page d'origine (mémorisée dans
// l'état de navigation lors de la redirection), sinon à l'accueil.
function RedirectFromLogin() {
  const location = useLocation();
  return <Navigate to={fromPathOf(location.state) || "/home"} replace />;
}

interface ProtectedRoutesProps {
  /** `undefined` tant que l'auth se résout, `null` déconnecté. */
  user: User | null | undefined;
  isDark: boolean;
  toggleTheme: () => void;
}

// Garde d'auth au niveau du routeur : écran de chargement tant que l'auth se résout,
// documents légaux publics, redirection vers /login sinon, et l'app complète (avec
// toute sa machinerie) UNIQUEMENT une fois connecté.
function ProtectedRoutes({ user, isDark, toggleTheme }: ProtectedRoutesProps) {
  const location = useLocation();
  if (user === undefined) return <LoadingPage isDark={isDark} />;
  if (!user && location.pathname.startsWith("/legal")) {
    return <div style={{ height: "100dvh", background: "var(--bg)", color: "var(--text)" }}><LegalPage /></div>;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <AppInner user={user} isDark={isDark} toggleTheme={toggleTheme} />;
}

/** Racine de la zone app : thème et auth partagés par l'écran de connexion et l'app protégée. */
export default function App() {
  const { isDark, toggleTheme } = useTheme();
  useOverlayThemeColor(); // voile la barre système PWA tant qu'une modale est ouverte
  useStatusBarSync(isDark); // aligne la barre système sur le thème (boot, bascule, reprise)
  const { user, postLogin } = useAuthUser();

  // Relâche le splash d'ouverture dès que l'auth est connue : il couvre TOUT le
  // chargement à froid puis cède la place au premier écran réel, sans saut du relais.
  useEffect(() => {
    if (user !== undefined) window.__releaseBootSplash?.();
  }, [user]);

  return (
    <Routes>
      {/* Connexion : route publique. Déjà connecté → retour à l'origine, après une brève
          transition « Connexion en cours… » (postLogin) même quand le login est instantané. */}
      <Route path="/login" element={user === undefined || postLogin ? <LoadingPage isDark={isDark} /> : user ? <RedirectFromLogin /> : <LoginPage isDark={isDark} onToggleTheme={toggleTheme} onSignIn={signInWithGoogle} />} />
      {/* Sous basename="/app", on entre par l'accueil (la vitrine publique vit hors /app). */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      {/* Une seule instance d'AppInner pour toutes les routes : aucun remontage (ni flicker
          de l'écran de chargement) lors de la navigation. */}
      <Route path="*" element={<ProtectedRoutes user={user} isDark={isDark} toggleTheme={toggleTheme} />} />
    </Routes>
  );
}
