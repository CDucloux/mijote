import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { CookingHeatmap } from "../components/CookingHeatmap.jsx";
import { PlusBadge } from "../components/PlusBadge.jsx";
import { buildHeatmap } from "@/lib/planning/cookingActivity.js";
import { recipeQuotaCount, FREE_RECIPE_LIMIT } from "@/lib/recipes/plan.js";
import { DEFAULT_PREFERENCES } from "../constants/preferences.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── PROFIL ───────────────────────────────────────────────────────────────────
// Page dédiée (accès depuis le menu avatar) : identité, plan, activité cuisine
// (heatmap façon GitHub) et zone de danger (purges + suppression de compte).

const CARD = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18 };

// En-tête de section : petite pastille d'icône teintée + titre.
function SectionTitle({ icon, children, color = "var(--accent)", tint = "rgba(232,112,58,0.12)" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
      <span style={{ width: 26, height: 26, borderRadius: 8, background: tint, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={15} color={color} />
      </span>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{children}</h3>
    </div>
  );
}

export function ProfilePage({ user, preferences = DEFAULT_PREFERENCES, setPreferences, recipes = [], onPurge, onDeleteAccount }) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { isPlus } = useAppShell();
  const recipeCount = recipeQuotaCount(recipes);
  const prefs = preferences || DEFAULT_PREFERENCES;
  const currentName = prefs.displayName || user?.displayName || "";
  const [nameInput, setNameInput] = useState(null);
  const [purgeScope, setPurgeScope] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const editing = nameInput !== null;
  const nameDirty = editing && nameInput.trim() !== currentName.trim();
  const saveName = () => { setPreferences?.(p => ({ ...DEFAULT_PREFERENCES, ...(p || {}), displayName: nameInput.trim() })); setNameInput(null); };

  // Activité cuisine = plats RÉELLEMENT cuisinés (mode pas à pas mené au bout),
  // consignés dans le journal de cuisine — et non les repas simplement planifiés.
  const cookLog = prefs.cookLog || {};
  const stats = buildHeatmap(cookLog, { weeks: 26 });
  const STAT = [
    { label: "Plats cuisinés", value: stats.total, icon: "fire" },
    { label: "Jours actifs", value: stats.activeDays, icon: "calendar" },
    { label: "Série en cours", value: `${stats.streak} j`, icon: "history" },
    { label: "7 derniers jours", value: stats.thisWeek, icon: "clock" },
  ];

  const atLimit = recipeCount >= FREE_RECIPE_LIMIT;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "18px 20px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} className="cook-close-btn" style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}><Icon name="back" size={17} /></button>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Profil</h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 32px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 620, margin: "0 auto" }}>

          {/* ── Carte identité ── */}
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <div style={{ position: "relative", flexShrink: 0, borderRadius: "50%", padding: 3, background: isPlus ? "linear-gradient(135deg, var(--accent), #f0c060)" : "var(--border)" }}>
                {user?.photoURL
                  ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block", border: "3px solid var(--surface)" }} />
                  : <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 700, border: "3px solid var(--surface)" }}>{(currentName || "?")[0].toUpperCase()}</div>}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName || "Sans nom"}</div>
                {user?.email && <div style={{ fontSize: 12.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{user.email}</div>}
                <div style={{ marginTop: 8 }}>
                  {isPlus
                    ? <PlusBadge />
                    : <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700, color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 999, padding: "3px 10px" }}>Plan gratuit</span>}
                </div>
              </div>
            </div>

            {/* Nom d'affichage (inline, sous l'identité) */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div className="field-label" style={{ marginBottom: 8 }}>Nom d'affichage</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="field-input" style={{ flex: 1, background: "var(--surface2)" }} placeholder={user?.displayName || "Ton prénom"}
                  value={editing ? nameInput : currentName}
                  onChange={e => setNameInput(e.target.value)}
                  onFocus={() => { if (!editing) setNameInput(currentName); }}
                  onKeyDown={e => { if (e.key === "Enter" && nameDirty) saveName(); }} />
                {editing && (
                  <button className="btn btn-primary btn-pill" style={{ flexShrink: 0, opacity: nameDirty ? 1 : 0.5, pointerEvents: nameDirty ? "auto" : "none" }} onClick={saveName}>Enregistrer</button>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 7 }}>Utilisé dans l'interface (accueil, foyer).</div>
            </div>
          </div>

          {/* ── Ton plan ── */}
          <div>
            <SectionTitle icon="sparkle">Ton plan</SectionTitle>
            <div style={{ ...CARD, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
              ...(isPlus ? { background: "linear-gradient(135deg, rgba(232,112,58,0.08), rgba(240,192,96,0.06))", borderColor: "rgba(232,112,58,0.3)" } : {}) }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700, color: "var(--text)" }}>{isPlus ? "Mijoté+" : "Plan gratuit"}</span>
                  {isPlus && <PlusBadge />}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 4, lineHeight: 1.4 }}>
                  {isPlus
                    ? "Recettes illimitées et toutes les fonctionnalités."
                    : <><strong style={{ color: atLimit ? "var(--red)" : "var(--text2)" }}>{recipeCount} / {FREE_RECIPE_LIMIT}</strong> recettes · fonctionnalités de base.</>}
                </div>
                {!isPlus && (
                  <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (recipeCount / FREE_RECIPE_LIMIT) * 100)}%`, background: atLimit ? "var(--red)" : "var(--accent)", borderRadius: 3, transition: "width 0.3s ease" }} />
                  </div>
                )}
              </div>
              <button className="btn btn-pill" style={{ flexShrink: 0, fontSize: 13, alignSelf: isPlus ? "center" : "flex-start", background: isPlus ? "var(--surface)" : "var(--accent)", color: isPlus ? "var(--text)" : "#fff", border: isPlus ? "1px solid var(--border)" : "none", boxShadow: isPlus ? "none" : undefined }} onClick={() => navigate("/plus")}>
                {isPlus ? "Gérer" : "Découvrir"}
              </button>
            </div>
          </div>

          {/* ── Activité cuisine ── */}
          <div>
            <SectionTitle icon="fire">Ton activité cuisine</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap: 10, marginBottom: 12 }}>
              {STAT.map(s => (
                <div key={s.label} style={{ ...CARD, borderRadius: 15, padding: "13px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Icon name={s.icon} size={13} color="var(--text3)" />
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                  </div>
                  <div style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ ...CARD, padding: "16px 14px" }}>
              <CookingHeatmap mealPlan={cookLog} weeks={26} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>D'après les plats cuisinés en mode pas à pas sur les 6 derniers mois.</div>
          </div>

          {/* ── Zone de danger ── */}
          <div style={{ borderRadius: 18, border: "1px solid rgba(224,82,82,0.28)", background: "rgba(224,82,82,0.035)", padding: 18, marginTop: 6 }}>
            <SectionTitle icon="warning" color="var(--red)" tint="rgba(224,82,82,0.12)">Zone de danger</SectionTitle>
            <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 14px" }}>Efface définitivement des données de ton espace. Ces actions sont irréversibles.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { scope: "planning", label: "Vider le planning" },
                { scope: "shopping", label: "Vider les courses" },
                { scope: "stock", label: "Vider le stock" },
                { scope: "all", label: "Tout effacer", danger: true },
              ].map(o => (
                <button key={o.scope} onClick={() => setPurgeScope(o)} className="pressable"
                  style={{ flex: isDesktop ? "0 1 auto" : "1 1 calc(50% - 4px)", padding: "9px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                    background: o.danger ? "rgba(224,82,82,0.12)" : "var(--surface)", color: o.danger ? "var(--red)" : "var(--text2)",
                    border: `1px solid ${o.danger ? "rgba(224,82,82,0.45)" : "var(--border)"}` }}>
                  {o.label}
                </button>
              ))}
            </div>
            {onDeleteAccount && (
              <>
                <div style={{ height: 1, background: "rgba(224,82,82,0.2)", margin: "16px 0 14px" }} />
                <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5, marginBottom: 12 }}>
                  <strong style={{ color: "var(--text)" }}>Supprimer mon compte</strong> : efface ton compte et toutes tes données (recettes, carnets, planning, courses, stock, préférences). Définitif.
                </div>
                <button onClick={() => setConfirmDelete(true)} className="pressable"
                  style={{ width: isDesktop ? "auto" : "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "var(--red)", color: "#fff", border: "none" }}>
                  <Icon name="trash" size={15} color="#fff" /> Supprimer mon compte
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {purgeScope && (
        <SwipeableSheet onClose={() => setPurgeScope(null)}>
          {(close) => (<>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{purgeScope.label} ?</h3>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              {purgeScope.scope === "all"
                ? "Toutes tes recettes, carnets, planning, courses et stock seront définitivement effacés. Cette action est irréversible."
                : "Ces données seront définitivement effacées. Cette action est irréversible."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}>Annuler</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => close(() => onPurge?.(purgeScope.scope))}>Effacer</button>
            </div>
          </>)}
        </SwipeableSheet>
      )}

      {confirmDelete && (
        <ConfirmDialog title="Supprimer définitivement ton compte ?" busy={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => { setDeleting(true); const ok = await onDeleteAccount?.(); if (!ok) { setDeleting(false); setConfirmDelete(false); } }}>
          Ton compte et <strong style={{ color: "var(--text)" }}>toutes tes données</strong> (recettes, carnets, planning, courses, stock, préférences) seront <strong style={{ color: "var(--text)" }}>effacés sans retour possible</strong>. Tu seras déconnecté·e.
        </ConfirmDialog>
      )}
    </div>
  );
}
