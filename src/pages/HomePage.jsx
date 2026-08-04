import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { PlusBadge } from "../components/PlusBadge.jsx";
import { Img } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { DiscoverSection } from "../components/DiscoverSection.jsx";
import { HouseholdPanel } from "../components/HouseholdPanel.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
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

// Carte de notification compacte (courses, stock bas) – icône + libellé + chevron.
function NotifRow({ icon, color, title, subtitle, onClick, animationDelay }) {
  return (
    <button onClick={onClick} className="slide-up pressable"
      style={{
        animationDelay,
        display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
        padding: "13px 14px", borderRadius: 18,
        background: "var(--surface)", border: "1px solid var(--border)",
        cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 20px ${color}28`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}>
      <span style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}1a`, border: `1px solid ${color}30`,
      }}>
        <Icon name={icon} size={20} color={color} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{title}</span>
        {subtitle && <span style={{ display: "block", fontSize: 12, color: "var(--text3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>}
      </span>
      <Icon name="forward" size={16} color="var(--text3)" />
    </button>
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
            fontSize: 12, fontWeight: 700, position: "relative", zIndex: emails.length - i,
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
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Foyer partagé = fonctionnalité Mijoté+ : en gratuit, la carte renvoie vers l'offre.
  const openFoyer = () => isPlus ? setOpen(v => !v) : navigate("/plus");
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
      <button onClick={openFoyer} aria-label="Ouvrir le foyer" className="pressable"
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
            : <span style={{ width: 50, height: 50, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", boxShadow: "0 4px 12px rgba(224,95,44,0.28)" }}>
                <FoyerGlyph size={27} />
              </span>}
        </span>
        {/* Perforation verticale */}
        <span aria-hidden="true" style={{ flexShrink: 0, width: 0, alignSelf: "stretch", margin: "12px 0", borderLeft: "2px dashed rgba(232,112,58,0.35)" }} />
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
                  : <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em", color: "var(--accent)", background: "rgba(232,112,58,0.14)", border: "1px solid rgba(232,112,58,0.3)", borderRadius: 999, padding: "2px 7px", textTransform: "uppercase" }}>
                      {hasInvite ? "Invitation" : "Nouveau"}
                    </span>
              )}
            </span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--text2)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {summary}
            </span>
          </span>
          <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(232,112,58,0.14)", border: "1px solid rgba(232,112,58,0.32)" }}>
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

export function HomePage({ recipes = [], mealPlan = {}, shoppingLists = [], lowStock = [], ingredientDB = [], preferences, onSelectRecipe, setTab, onOpenPublic, onClonePublic, discoverSeed = "", onDiscoverSeedConsumed }) {
  const { user } = useAppShell();
  const firstName = ((preferences?.displayName || user?.displayName) || "").trim().split(" ")[0] || "";

  const summary = useMemo(
    () => buildDashboardSummary({ mealPlan, recipes, shoppingLists, lowStock, ingredientDB }),
    [mealPlan, recipes, shoppingLists, lowStock, ingredientDB]
  );
  const { meals, shoppingTodo, lowStockNames, isCalm } = summary;

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
      {/* En-tête */}
      <div style={{ padding: "20px 20px 8px", flexShrink: 0, position: "relative", zIndex: 1, background: "var(--bg)" }}>
        <div className="slide-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName ? `${greeting()}, ${firstName} !` : `${greeting()} !`}</h1>
            <span style={{ fontSize: 12.5, color: "var(--text3)", fontWeight: 500, marginTop: 3 }}>
              Bienvenue sur <span style={{ fontFamily: "var(--ff-display)", fontWeight: 600, color: "var(--text2)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span></span>
            </span>
          </div>
          <UserAvatar />
        </div>
      </div>

      {/* Corps défilant */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
        {/* ── Mon foyer (en tête d'accueil) ───────────────────────────────── */}
        <FoyerSection />

        {/* ── Aujourd'hui ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: isCalm ? 18 : 26 }}>
          {!isCalm && (
            <h2 className="slide-up" style={{ animationDelay: "0.04s", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Aujourd'hui
            </h2>
          )}

          {isCalm ? (
            <button className="slide-up pressable" onClick={() => setTab?.("meal-plan")}
              style={{ animationDelay: "0.04s", display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "11px 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: "rgba(76,175,125,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="check" size={15} color="var(--green)" />
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong style={{ fontWeight: 600 }}>Tout est à jour</strong>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: "var(--accent)", flexShrink: 0 }}>Planifier <Icon name="forward" size={13} color="var(--accent)" /></span>
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Repas du jour (un repas composé = une carte, plat en tête) */}
              {mealCards.map((card, i) => { const m = card.primary; return (
                <button key={i} onClick={() => onSelectRecipe?.(m.recipe.id)} className="slide-up pressable"
                  style={{
                    animationDelay: `${i * 0.06}s`,
                    display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
                    padding: "12px 14px", borderRadius: 18, cursor: "pointer", overflow: "hidden",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = (SLOT_BY_ID[m.slot]?.accent || "var(--accent)"); e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}>
                  <div style={{ width: 70, height: 70, borderRadius: 14, overflow: "hidden", flexShrink: 0, boxShadow: "0 3px 10px rgba(0,0,0,0.14)" }}>
                    <Img src={m.recipe.image} alt={m.recipe.name} style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                      background: (SLOT_BY_ID[m.slot]?.color || "var(--surface2)"),
                      color: (SLOT_BY_ID[m.slot]?.text || "var(--text2)"),
                      marginBottom: 6,
                    }}>
                      {SLOT_BY_ID[m.slot]?.today || "Au menu"}
                    </span>
                    <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.recipe.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 3 }}>
                      {fmtTime((m.recipe.prepTime || 0) + (m.recipe.cookTime || 0))}{m.recipe.ingredients?.length ? ` | ${m.recipe.ingredients.length} ingr.` : ""}
                    </div>
                    {card.others.length > 0 && (
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {card.others.map(o => <span key={o.recipe.id}><span style={{ color: "var(--accent)", fontWeight: 700, position: "relative", top: "-1px" }}>+</span> {o.recipe.name} </span>)}
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
                  icon="shopping" color="var(--accent)"
                  onClick={() => setTab?.("shopping")}
                  title={`${shoppingTodo} article${shoppingTodo > 1 ? "s" : ""} à acheter`}
                  subtitle="Ta liste de courses t'attend" />
              )}

              {/* Stock bas */}
              {lowStockNames.length > 0 && (
                <NotifRow
                  animationDelay={`${(meals.length + (shoppingTodo > 0 ? 1 : 0)) * 0.06 + 0.04}s`}
                  icon="warning" color="#e8920a"
                  onClick={() => setTab?.("stock")}
                  title={`${lowStockNames.length} ingrédient${lowStockNames.length > 1 ? "s" : ""} à racheter bientôt`}
                  subtitle={lowStockNames.slice(0, 4).join(" · ")} />
              )}
            </div>
          )}
        </section>

        {/* ── Découvrir la communauté ─────────────────────────────────────── */}
        <DiscoverSection ingredientDB={ingredientDB} preferences={preferences} recipes={recipes} onOpenPublic={onOpenPublic} onClonePublic={onClonePublic} initialSearch={discoverSeed} onSeedConsumed={onDiscoverSeedConsumed} />
      </div>
    </div>
  );
}
