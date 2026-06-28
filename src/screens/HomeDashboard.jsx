import { useMemo } from "react";
import { Icon } from "../components/Icon.jsx";
import { Img } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { DiscoverSection } from "../components/DiscoverSection.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { buildDashboardSummary } from "../lib/dashboard.js";

// ─── HOME / ACCUEIL ───────────────────────────────────────────────────────────
// Page d'atterrissage : un en-tête « Aujourd'hui » (notifications dérivées de
// l'état local) suivi directement de la découverte communautaire.

const SLOT_LABEL = { midi: "🌤 Ce midi", soir: "🌙 Ce soir" };
const SLOT_TINT = { midi: "rgba(240,192,96,0.16)", soir: "rgba(91,156,246,0.16)" };

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 18) return "Bonjour";
  return "Bonsoir";
}

// Carte de notification compacte (courses, stock) — icône colorée + libellé + chevron.
function NotifRow({ icon, color, title, subtitle, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", transition: "transform 0.12s, border-color 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: color + "22" }}>
        <Icon name={icon} size={18} color={color} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{title}</span>
        {subtitle && <span style={{ display: "block", fontSize: 12, color: "var(--text3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>}
      </span>
      <Icon name="forward" size={16} color="var(--text3)" />
    </button>
  );
}

export function HomeDashboard({ recipes = [], mealPlan = {}, shoppingLists = [], lowStock = [], ingredientDB = [], preferences, onSelectRecipe, setTab, onOpenPublic }) {
  const { user } = useAppShell();
  const firstName = (user?.displayName || "").trim().split(" ")[0] || "";

  const summary = useMemo(
    () => buildDashboardSummary({ mealPlan, recipes, shoppingLists, lowStock, ingredientDB }),
    [mealPlan, recipes, shoppingLists, lowStock, ingredientDB]
  );
  const { meals, shoppingTodo, lowStockNames, isCalm } = summary;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>{greeting()}{firstName ? "," : ""}</span>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName || "Bienvenue"}</h1>
          </div>
          <UserAvatar />
        </div>
      </div>

      {/* Corps défilant */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 24px" }}>
        {/* ── Aujourd'hui ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Aujourd'hui</h2>

          {isCalm ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "28px 20px", borderRadius: 16, background: "var(--surface)", border: "1px dashed var(--border)" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(76,175,125,0.14)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon name="check" size={24} color="var(--green)" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Rien d'urgent au menu</div>
              <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5, maxWidth: 280 }}>
                Pas de repas planifié, courses à jour et placards bien remplis. Et si tu planifiais ta semaine&nbsp;?
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 14, borderRadius: 12 }} onClick={() => setTab?.("meal-plan")}>
                <Icon name="calendar" size={15} /> Planifier la semaine
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Repas du jour */}
              {meals.map((m, i) => (
                <button key={i} onClick={() => onSelectRecipe?.(m.recipe.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: 10, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", overflow: "hidden" }}>
                  <div style={{ width: 60, height: 60, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                    <Img src={m.recipe.image} alt={m.recipe.name} style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: SLOT_TINT[m.slot] || "var(--surface2)", color: "var(--text2)", marginBottom: 5 }}>{SLOT_LABEL[m.slot] || "Au menu"}</span>
                    <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.recipe.name}</div>
                  </div>
                  <Icon name="forward" size={18} color="var(--text3)" />
                </button>
              ))}

              {/* Courses à faire */}
              {shoppingTodo > 0 && (
                <NotifRow icon="shopping" color="var(--accent)" onClick={() => setTab?.("shopping")}
                  title={`${shoppingTodo} article${shoppingTodo > 1 ? "s" : ""} à acheter`}
                  subtitle="Ta liste de courses t'attend" />
              )}

              {/* Stock bas */}
              {lowStockNames.length > 0 && (
                <NotifRow icon="warning" color="#e8920a" onClick={() => setTab?.("fridge")}
                  title={`${lowStockNames.length} ingrédient${lowStockNames.length > 1 ? "s" : ""} à racheter bientôt`}
                  subtitle={lowStockNames.slice(0, 4).join(" · ")} />
              )}
            </div>
          )}
        </section>

        {/* ── Découvrir la communauté ─────────────────────────────────────── */}
        <DiscoverSection ingredientDB={ingredientDB} preferences={preferences} recipes={recipes} onOpenPublic={onOpenPublic} />
      </div>
    </div>
  );
}
