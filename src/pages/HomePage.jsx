import { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { Icon } from "../components/Icon.jsx";
import { PlusBadge } from "../components/PlusBadge.jsx";
import { Img } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { DiscoverSection } from "../components/DiscoverSection.jsx";
import { SpotlightIngredient } from "../components/SpotlightIngredient.jsx";
import { pickSpotlightIngredient } from "@/lib/planning/spotlight.js";
import { HouseholdPanel } from "../components/HouseholdPanel.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { ElasticScroll } from "../components/ElasticScroll.jsx";
import { useNavigate } from "react-router-dom";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { useCanHover } from "../hooks/useCanHover.js";
import { peopleCount, MAX_HOUSEHOLD } from "@/lib/household/household.js";
import { buildDashboardSummary } from "@/lib/planning/dashboard.js";
import { SLOT_BY_ID } from "../constants/mealSlots.js";
import { itemRole, roleOrder } from "@/lib/planning/composedMeal.js";
import { fmtTime } from "../lib/format.js";

// ─── HOME / ACCUEIL ───────────────────────────────────────────────────────────

function greeting(date = new Date()) {
  const h = date.getHours();
  return h >= 6 && h < 18 ? "Bonjour" : "Bonsoir";
}

// Titre d'onglet, identique au standard des autres pages (Recettes, Planning…) :
// même fonte, taille et graisse, pour une hiérarchie de titres homogène.
const HOME_TITLE_STYLE = { fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

// Carte de notification compacte (courses, stock bas) – icône + libellé + chevron.
// La surbrillance de survol n'est câblée que sur pointeur fin (souris) : sur tactile,
// un mouseenter synthétisé au tap/appui long resterait collé (pas de mouseleave).
function NotifRow({ icon, color, title, subtitle, onClick, animationDelay, canHover }) {
  return (
    <button onClick={onClick} className="slide-up pressable ripple"
      style={{
        animationDelay,
        display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
        padding: "13px 14px", borderRadius: 18,
        background: "var(--surface)", border: "1px solid var(--border)",
        cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      }}
      onMouseEnter={canHover ? (e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 20px ${color}28`; }) : undefined}
      onMouseLeave={canHover ? (e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }) : undefined}>
      <span style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}1a`, border: `1px solid ${color}30`,
      }}>
        <Icon name={icon} size={20} color={color} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>{title}</span>
        {subtitle && <span style={{ display: "block", fontSize: 12, color: "var(--text3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>}
      </span>
      <Icon name="forward" size={16} color="var(--text3)" />
    </button>
  );
}

// État « compte encore vierge » : plutôt que « Tout est à jour » (rassurant à tort
// quand il n'y a RIEN à faire faute de contenu), on invite à démarrer. Le parcours
// Recette → Planning → Courses en pied dit POURQUOI l'accueil est vide et ce que la
// première recette débloque : la boucle propre à Cardamome, pas un vide générique.
function OnboardingCard({ onNewRecipe, onOpenPublic }) {
  const steps = [
    { icon: "book", label: "Recette", on: true },
    { icon: "calendar", label: "Planning", on: false },
    { icon: "shopping", label: "Courses", on: false },
  ];
  return (
    <div className="slide-up" style={{ animationDelay: "0.04s",
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20,
      padding: "22px 20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
      <span style={{ width: 48, height: 48, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(var(--accent-rgb),0.12)", border: "1px solid rgba(var(--accent-rgb),0.28)" }}>
        <Icon name="book" size={24} color="var(--accent)" />
      </span>
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, margin: "16px 0 6px" }}>
        Ta cuisine démarre ici
      </h3>
      <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55, margin: 0, maxWidth: "44ch" }}>
        Ajoute une première recette et tout s'enchaîne : le planning de la semaine, la liste de courses et le suivi du stock se remplissent ensuite pour toi.
      </p>

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
        <button onClick={onNewRecipe} className="btn btn-primary btn-pill pressable ripple" style={{ width: "auto" }}>
          <Icon name="plus" size={16} color="#fff" /> Ajouter une recette
        </button>
        <button onClick={onOpenPublic} className="pressable" style={{ background: "none", border: "none", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 4px",
          fontFamily: "var(--ff-body)", fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
          Explorer la communauté <Icon name="forward" size={14} color="var(--accent)" />
        </button>
      </div>

      {/* Parcours : le geste suivant se débloque une fois la recette ajoutée. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        {steps.map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, opacity: s.on ? 1 : 0.5 }}>
              <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: s.on ? "rgba(var(--accent-rgb),0.12)" : "var(--surface2)" }}>
                <Icon name={s.icon} size={14} color={s.on ? "var(--accent)" : "var(--text3)"} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.on ? "var(--text)" : "var(--text3)", whiteSpace: "nowrap" }}>{s.label}</span>
            </span>
            {i < steps.length - 1 && <span aria-hidden="true" style={{ flex: 1, minWidth: 12, height: 1, background: "var(--border)" }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Pictogramme « foyer » : un toit qui abrite deux personnes. Inline pour pouvoir
// le teinter en blanc sur le badge dégradé (aucune icône « groupe » dispo sinon).
function FoyerGlyph({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.2 10.4 12 3.5l8.8 6.9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.2" cy="12.4" r="1.9" fill="#fff" />
      <circle cx="14.8" cy="12.4" r="1.9" fill="#fff" />
      <path d="M5.7 19.2c.4-2 1.8-3 3.5-3s3.1 1 3.5 3M11.3 19.2c.4-2 1.8-3 3.5-3 1.6 0 3 1 3.5 3" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Pile d'avatars des membres (chevauchement), repli sur l'initiale colorée.
function MemberStack({ emails, photoFor, nameFor }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {emails.slice(0, MAX_HOUSEHOLD).map((e, i) => {
        const photo = photoFor(e);
        const ini = (nameFor(e) || e || "?").trim()[0]?.toUpperCase() || "?";
        return (
          <span key={e} style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            marginLeft: i === 0 ? 0 : -10, border: "2px solid var(--bg)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", background: "var(--accent)", color: "#fff",
            fontSize: 12, fontWeight: 600, position: "relative", zIndex: emails.length - i,
          }}>
            {photo ? <img src={photo} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ini}
          </span>
        );
      })}
    </span>
  );
}

// Section « Foyer » dans l'Accueil : carte « feature » dégradée, volontairement
// différente des bandes de notification au-dessus. Elle s'ouvre sur le panneau
// de gestion complet. Évite d'aller fouiller dans la Configuration.
function FoyerSection() {
  const { user, directory = [], loadDirectory, isPlus } = useAppShell();
  const { household, invites, loading } = useHousehold();
  const [open, setOpen] = useState(false);
  // La carte ouvre toujours le panneau foyer, y compris en gratuit : l'utilisateur
  // découvre d'abord la page de création, où le soft-lock Cardamome+ prend le relais
  // (cf. HouseholdPanel), plutôt que d'être renvoyé sèchement vers l'offre.
  const openFoyer = () => setOpen(v => !v);
  // Annuaire chargé à la demande, seulement s'il y a un foyer (avatars des membres).
  useEffect(() => { if (household || invites.length) loadDirectory?.(); }, [household, invites.length, loadDirectory]);
  // Pendant le chargement : on réserve l'espace avec un skeleton de même hauteur
  // pour éviter le « pop » / décalage de layout au (re)chargement de l'Accueil.
  if (loading) return (
    <section style={{ marginBottom: 26 }}>
      <div className="skeleton" style={{ height: 84, borderRadius: 18 }} />
    </section>
  );

  const myEmail = (user?.email || "").toLowerCase();
  const dirByEmail = new Map(directory.map(d => [(d.email || "").toLowerCase(), d]));
  const photoFor = (e) => (e === myEmail ? user?.photoURL : dirByEmail.get(e)?.photoURL) || "";
  const nameFor = (e) => dirByEmail.get(e)?.displayName || "";

  const hasInvite = invites.length > 0;
  const count = household ? peopleCount(household) : 0;
  const summary = household
    ? `${count} ${count > 1 ? "membres" : "membre"} · partage actif`
    : hasInvite ? "Une invitation t'attend" : "Recettes, courses & planning partagés";

  return (
    <section style={{ marginBottom: 26 }}>
      {/* Carte foyer : surface neutre + liseré accent à gauche (inset box-shadow,
          épouse les coins) + perforation pointillée comme séparateur distinctif. */}
      <button onClick={openFoyer} aria-label="Ouvrir le foyer" className="pressable ripple"
        style={{
          position: "relative", width: "100%", textAlign: "left", cursor: "pointer",
          display: "flex", alignItems: "stretch", gap: 0, padding: 0,
          borderRadius: 18, border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: "inset 4px 0 0 var(--accent), 0 4px 16px rgba(0,0,0,0.06)", overflow: "hidden",
        }}>
        {/* Souche gauche : pictogramme (sans foyer) ou pile d'avatars (foyer actif) */}
        <span style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 18px 16px 22px" }}>
          {household
            ? <MemberStack emails={household.memberEmails || []} photoFor={photoFor} nameFor={nameFor} />
            : <span style={{ width: 50, height: 50, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent)" }}>
                <FoyerGlyph size={27} />
              </span>}
        </span>
        {/* Perforation verticale */}
        <span aria-hidden="true" style={{ flexShrink: 0, width: 0, alignSelf: "stretch", margin: "12px 0", borderLeft: "2px dashed rgba(var(--accent-rgb),0.35)" }} />
        {/* Talon droit : titre + statut + action */}
        <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "16px 18px" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {household ? household.name : "Mon foyer"}
              </span>
              {!household && (
                !isPlus
                  ? <PlusBadge />
                  : <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em", color: "var(--accent)", background: "rgba(var(--accent-rgb),0.14)", border: "1px solid rgba(var(--accent-rgb),0.3)", borderRadius: 999, padding: "2px 7px", textTransform: "uppercase" }}>
                      {hasInvite ? "Invitation" : "Nouveau"}
                    </span>
              )}
            </span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--text2)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {summary}
            </span>
          </span>
          <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(var(--accent-rgb),0.14)", border: "1px solid rgba(var(--accent-rgb),0.32)" }}>
            <Icon name={household ? "forward" : hasInvite ? "forward" : "plus"} size={16} color="var(--accent)" />
          </span>
        </span>
      </button>
      {open && (
        <SwipeableSheet onClose={() => setOpen(false)} style={{ maxHeight: "88dvh" }}>
          <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, margin: "0 0 16px" }}>Foyer</h2>
          <HouseholdPanel onClose={() => setOpen(false)} />
        </SwipeableSheet>
      )}
    </section>
  );
}

// Sélecteur de sous-vue de l'Accueil : « À suivre » (tableau de bord perso) vs
// « Découvrir » (recettes de la communauté). Chaque segment porte sa propre route
// (/home ↔ /discover) ; l'onglet reste unique dans la barre de navigation.
// Le fond actif est porté par UN seul « thumb » qui GLISSE d'un segment à l'autre
// (au lieu d'un fond qui apparaît/disparaît par segment). On mesure le segment actif
// et on positionne le thumb par-dessus. La glisse ne doit répondre qu'à l'action de
// l'utilisateur : au montage, au resize et après le chargement des polices (largeur
// dépendante de la fonte), on repositionne SANS transition.
function SubviewPill({ mode, onNavigate }) {
  const homeRef = useRef(null);
  const discoverRef = useRef(null);
  const thumbRef = useRef(null);
  const animatedRef = useRef(false);

  const placeThumb = useCallback((animate) => {
    const active = mode === "discover" ? discoverRef.current : homeRef.current;
    const thumb = thumbRef.current;
    if (!active || !thumb) return;
    const reduce = animate && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduce) thumb.style.transition = "none";
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
    if (!animate || reduce) requestAnimationFrame(() => { thumb.style.transition = ""; });
  }, [mode]);

  // Positionne au changement de mode : la première passe (montage) ne glisse pas.
  useLayoutEffect(() => {
    placeThumb(animatedRef.current);
    animatedRef.current = true;
  }, [mode, placeThumb]);

  // Recalage sans glisse au resize et après chargement des polices.
  useEffect(() => {
    const replace = () => placeThumb(false);
    window.addEventListener("resize", replace);
    if (document.fonts?.ready) document.fonts.ready.then(replace);
    return () => window.removeEventListener("resize", replace);
  }, [placeThumb]);

  const seg = (id, label, ref) => {
    const active = mode === id;
    return (
      <button ref={ref}
        role="tab" aria-selected={active} onClick={() => onNavigate?.(id)}
        className="pressable"
        style={{
          position: "relative", zIndex: 1, flex: "0 0 auto", padding: "7px 16px", borderRadius: 999,
          border: "none", cursor: "pointer", background: "transparent",
          fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
          color: active ? "var(--text)" : "var(--text3)",
          transition: "color 0.22s ease",
        }}>
        {label}
      </button>
    );
  };
  return (
    <div role="tablist" aria-label="Vue de l'accueil" style={{ position: "relative", display: "inline-flex", gap: 3, padding: 3, borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--border)" }}>
      <span ref={thumbRef} aria-hidden="true" style={{
        position: "absolute", top: 3, left: 0, zIndex: 0, height: "calc(100% - 6px)", borderRadius: 999,
        background: "var(--bg)", boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
        transition: "transform 0.28s cubic-bezier(0.4,0.08,0.16,1), width 0.28s cubic-bezier(0.4,0.08,0.16,1)",
      }} />
      {seg("home", "À suivre", homeRef)}
      {seg("discover", "Découvrir", discoverRef)}
    </div>
  );
}

export function HomePage({ recipes = [], mealPlan = {}, shoppingLists = [], lowStock = [], ingredientDB = [], unreadCount = 0, preferences, loading = false, mode = "home", onNavigateSubview, onSelectRecipe, setTab, onOpenPublic, onClonePublic, onNewRecipe, onOpenIngredient, onExploreSeason, discoverSeed = "", onDiscoverSeedConsumed }) {
  const { user } = useAppShell();
  const canHover = useCanHover();
  const navigate = useNavigate();
  const firstName = ((preferences?.displayName || user?.displayName) || "").trim().split(" ")[0] || "";
  const spotlight = useMemo(() => pickSpotlightIngredient(ingredientDB), [ingredientDB]);

  const summary = useMemo(
    () => buildDashboardSummary({ mealPlan, recipes, shoppingLists, lowStock, ingredientDB }),
    [mealPlan, recipes, shoppingLists, lowStock, ingredientDB]
  );
  const { meals, shoppingTodo, lowStockNames, isCalm, isEmpty } = summary;

  // Regroupe les items d'un repas composé (même créneau + groupId) en UNE carte :
  // le plat en tête, les autres services résumés. Un item solo reste une carte.
  const mealCards = useMemo(() => {
    const map = new Map(), order = [];
    meals.forEach((m, i) => {
      const key = m.slot + "|" + (m.groupId || `solo-${i}`);
      let c = map.get(key);
      if (!c) { c = { slot: m.slot, items: [] }; map.set(key, c); order.push(c); }
      c.items.push(m);
    });
    order.forEach(c => {
      c.items.sort((a, b) => roleOrder(itemRole(a, a.recipe)) - roleOrder(itemRole(b, b.recipe)));
      c.primary = c.items.find(m => itemRole(m, m.recipe) === "plat") || c.items[0];
      c.others = c.items.filter(m => m !== c.primary);
    });
    return order;
  }, [meals]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête aligné sur le standard des autres onglets : titre serif 26/600 en
          tête à padding 20/20/0 (+ sous-titre discret), avatar à droite. Le
          sélecteur de sous-vue reste un contrôle SECONDAIRE, SOUS le titre : il ne
          remplace plus le titre en tête d'onglet (cohérence de hiérarchie). */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0, position: "relative", zIndex: 1, background: "var(--bg)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            {mode === "discover" ? (
              <h1 style={HOME_TITLE_STYLE}>Découvrir</h1>
            ) : (
              <>
                <h1 style={HOME_TITLE_STYLE}>{firstName ? `${greeting()}, ${firstName} !` : `${greeting()} !`}</h1>
                <span style={{ fontSize: 12.5, color: "var(--text3)", fontWeight: 500, marginTop: 3 }}>
                  Bienvenue sur <span style={{ fontFamily: "var(--ff-display)", fontWeight: 700, color: "var(--text2)" }}>Cardam<span style={{ color: "var(--accent)" }}>o</span>me<span style={{ color: "var(--accent)" }}>·</span></span>
                </span>
              </>
            )}
          </div>
          <UserAvatar />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, marginBottom: 12 }}>
          <SubviewPill mode={mode} onNavigate={onNavigateSubview} />
          <button
            type="button" className="pressable" onClick={() => navigate("/guide")}
            aria-label="Guide d'utilisation" title="Guide d'utilisation"
            style={{ marginLeft: "auto", flexShrink: 0, width: 40, height: 40, borderRadius: 999,
              display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              background: "none", border: "none", padding: 0 }}>
            <Icon name="help" size={22} color="var(--text2)" />
          </button>
          <button
            type="button" className="pressable" onClick={() => navigate("/notifications")}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Notifications"}
            title="Notifications"
            style={{ position: "relative", flexShrink: 0, width: 40, height: 40, borderRadius: 999,
              display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              background: "none", border: "none", padding: 0 }}>
            <Icon name="bell" size={22} color="var(--text2)" />
            {unreadCount > 0 && (
              <span style={{ position: "absolute", top: 2, right: 2, minWidth: 17, height: 17, padding: "0 4px",
                display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999,
                background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700, lineHeight: 1,
                fontVariantNumeric: "tabular-nums", border: "2px solid var(--bg)", boxSizing: "content-box" }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {mode === "discover" ? (
        /* ── Découvrir : recettes de la communauté (route /discover) ──────── */
        <ElasticScroll style={{ flex: 1, padding: "4px 20px var(--page-pad-b)" }}>
          <DiscoverSection ingredientDB={ingredientDB} preferences={preferences} recipes={recipes} onOpenPublic={onOpenPublic} onClonePublic={onClonePublic} onNewRecipe={onNewRecipe} initialSearch={discoverSeed} onSeedConsumed={onDiscoverSeedConsumed} />
        </ElasticScroll>
      ) : (
      /* ── À suivre : tableau de bord perso (route /home) ─────────────────── */
      <ElasticScroll style={{ flex: 1, padding: "4px 20px var(--page-pad-b)" }}>
        {/* ── Mon foyer (en tête d'accueil) ───────────────────────────────── */}
        <FoyerSection />

        {/* ── Aujourd'hui ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: isCalm ? 18 : 26 }}>
          {!isCalm && (
            <h2 className="slide-up" style={{ animationDelay: "0.04s", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Aujourd'hui
            </h2>
          )}

          {loading ? (
            // Données partagées pas encore hydratées (bootstrap / cache temps réel) :
            // squelette plutôt que « Tout est à jour » (qui flasherait avant l'arrivée
            // du planning, des courses et du stock).
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="skeleton" style={{ height: 74, borderRadius: 18 }} />
              <div className="skeleton" style={{ height: 62, borderRadius: 14 }} />
              <div className="skeleton" style={{ height: 62, borderRadius: 14 }} />
            </div>
          ) : isEmpty ? (
            <OnboardingCard onNewRecipe={onNewRecipe} onOpenPublic={onOpenPublic} />
          ) : isCalm ? (
            <button className="slide-up pressable ripple" onClick={() => setTab?.("meal-plan")}
              style={{ animationDelay: "0.04s", display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "11px 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: "rgba(var(--ok-rgb),0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="check" size={15} color="var(--ok)" />
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong style={{ fontWeight: 600 }}>Rien de prévu aujourd'hui</strong>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: "var(--accent)", flexShrink: 0 }}>Planifier <Icon name="forward" size={13} color="var(--accent)" /></span>
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Repas du jour (un repas composé = une carte, plat en tête) */}
              {mealCards.map((card, i) => { const m = card.primary; return (
                <button key={i} onClick={() => onSelectRecipe?.(m.recipe.id)} className="slide-up pressable ripple"
                  style={{
                    animationDelay: `${i * 0.06}s`,
                    display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
                    padding: "12px 14px", borderRadius: 18, cursor: "pointer", overflow: "hidden",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={canHover ? (e => { e.currentTarget.style.borderColor = (SLOT_BY_ID[m.slot]?.accent || "var(--accent)"); e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)"; }) : undefined}
                  onMouseLeave={canHover ? (e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }) : undefined}>
                  <div style={{ width: 70, height: 70, borderRadius: 14, overflow: "hidden", flexShrink: 0, boxShadow: "0 3px 10px rgba(0,0,0,0.14)" }}>
                    <Img src={m.recipe.image} alt={m.recipe.name} style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 10.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                      background: (SLOT_BY_ID[m.slot]?.color || "var(--surface2)"),
                      color: (SLOT_BY_ID[m.slot]?.text || "var(--text2)"),
                      marginBottom: 6,
                    }}>
                      {SLOT_BY_ID[m.slot]?.today || "Au menu"}
                    </span>
                    <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.recipe.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 3 }}>
                      {fmtTime((m.recipe.prepTime || 0) + (m.recipe.cookTime || 0))}{m.recipe.ingredients?.length ? ` | ${m.recipe.ingredients.length} ingr.` : ""}
                    </div>
                    {card.others.length > 0 && (
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {card.others.map(o => <span key={o.recipe.id}><span style={{ color: "var(--accent)", fontWeight: 600, position: "relative", top: "-1px" }}>+</span> {o.recipe.name} </span>)}
                      </div>
                    )}
                  </div>
                  <Icon name="forward" size={16} color="var(--text3)" />
                </button>
              ); })}

              {/* Courses à faire */}
              {shoppingTodo > 0 && (
                <NotifRow
                  animationDelay={`${meals.length * 0.06 + 0.04}s`}
                  icon="shopping" color="var(--accent)" canHover={canHover}
                  onClick={() => setTab?.("shopping")}
                  title={`${shoppingTodo} article${shoppingTodo > 1 ? "s" : ""} à acheter`}
                  subtitle="Ta liste de courses t'attend" />
              )}

              {/* Stock bas */}
              {lowStockNames.length > 0 && (
                <NotifRow
                  animationDelay={`${(meals.length + (shoppingTodo > 0 ? 1 : 0)) * 0.06 + 0.04}s`}
                  icon="warning" color="#e8920a" canHover={canHover}
                  onClick={() => setTab?.("stock")}
                  title={`${lowStockNames.length} ingrédient${lowStockNames.length > 1 ? "s" : ""} à racheter bientôt`}
                  subtitle={lowStockNames.slice(0, 4).join(" · ")} />
              )}
            </div>
          )}
        </section>

        {/* ── L'ingrédient du moment (engagement de saison) ────────────────── */}
        {spotlight && (
          <SpotlightIngredient
            ingredient={spotlight}
            onOpenIngredient={onOpenIngredient}
            onExplore={onExploreSeason}
          />
        )}
      </ElasticScroll>
      )}
    </div>
  );
}
