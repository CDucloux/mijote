import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { CookingHeatmap } from "../components/CookingHeatmap.jsx";
import { buildHeatmap } from "../lib/cookingActivity.js";
import { DEFAULT_PREFERENCES } from "../constants/preferences.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";

// ─── PROFIL ───────────────────────────────────────────────────────────────────
// Page dédiée (accès depuis le menu avatar) : nom d'affichage, activité cuisine
// (heatmap façon GitHub) et purge des données.
export function ProfilePage({ user, preferences = DEFAULT_PREFERENCES, setPreferences, mealPlan = {}, onPurge, onDeleteAccount }) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const prefs = preferences || DEFAULT_PREFERENCES;
  const currentName = prefs.displayName || user?.displayName || "";
  const [nameInput, setNameInput] = useState(null);
  const [purgeScope, setPurgeScope] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const editing = nameInput !== null;

  const stats = buildHeatmap(mealPlan, { weeks: 26 });
  const STAT = [
    { label: "Repas cuisinés", value: stats.total },
    { label: "Jours actifs", value: stats.activeDays },
    { label: "Série en cours", value: `${stats.streak} j` },
    { label: "7 derniers jours", value: stats.thisWeek },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "20px 20px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}><Icon name="back" size={17} /></button>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Profil</h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640, margin: "0 auto" }}>
          {/* Identité */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {user?.photoURL
              ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 62, height: 62, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)" }} />
              : <div style={{ width: 62, height: 62, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 25, fontWeight: 700 }}>{(currentName || "?")[0].toUpperCase()}</div>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName || "Sans nom"}</div>
              {user?.email && <div style={{ fontSize: 12, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>}
            </div>
          </div>

          {/* Nom d'affichage */}
          <div>
            <div className="field-label" style={{ marginBottom: 8 }}>Nom d'affichage</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="field-input" style={{ flex: 1 }} placeholder={user?.displayName || "Ton prénom"}
                value={editing ? nameInput : currentName}
                onChange={e => setNameInput(e.target.value)}
                onFocus={() => { if (!editing) setNameInput(currentName); }} />
              {editing && (
                <button className="btn btn-primary btn-sm" onClick={() => { setPreferences?.(p => ({ ...DEFAULT_PREFERENCES, ...(p || {}), displayName: nameInput.trim() })); setNameInput(null); }}>Enregistrer</button>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>C'est le nom utilisé dans l'interface (accueil, foyer).</div>
          </div>

          {/* Activité cuisine */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Icon name="fire" size={16} color="var(--accent)" />
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Ton activité cuisine</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {STAT.map(s => (
                <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{s.value}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 14px" }}>
              <CookingHeatmap mealPlan={mealPlan} weeks={26} />
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>D'après tes repas planifiés sur les 6 derniers mois.</div>
          </div>

          {/* Zone danger */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", marginBottom: 4 }}>Zone de danger</div>
            <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5, margin: "0 0 12px" }}>Efface définitivement des données de ton espace. Irréversible.</p>
            <div style={{ display: "flex", flexDirection: isDesktop ? "row" : "column", flexWrap: "wrap", gap: 8 }}>
              {[
                { scope: "planning", label: "Vider le planning" },
                { scope: "shopping", label: "Vider les courses" },
                { scope: "stock", label: "Vider le stock" },
                { scope: "all", label: "Tout effacer" },
              ].map(o => (
                <button key={o.scope} onClick={() => setPurgeScope(o)}
                  style={{ width: isDesktop ? "auto" : "100%", padding: "10px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: o.scope === "all" ? "rgba(224,82,82,0.14)" : "var(--surface2)", color: o.scope === "all" ? "var(--red)" : "var(--text2)", border: `1px solid ${o.scope === "all" ? "rgba(224,82,82,0.5)" : "var(--border)"}` }}>
                  {o.label}
                </button>
              ))}
            </div>
            {onDeleteAccount && (
              <>
                <div style={{ height: 1, background: "var(--border)", margin: "16px 0 14px" }} />
                <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5, marginBottom: 10 }}>
                  <strong style={{ color: "var(--text)" }}>Supprimer mon compte</strong> : efface ton compte et toutes tes données (recettes, carnets, planning, courses, stock, préférences). Cette action est définitive.
                </div>
                <button onClick={() => setConfirmDelete(true)}
                  style={{ width: isDesktop ? "auto" : "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", background: "var(--red)", color: "#fff", border: "none" }}>
                  <Icon name="trash" size={15} color="#fff" /> Supprimer mon compte
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {purgeScope && (
        <SwipeableSheet onClose={() => setPurgeScope(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{purgeScope.label} ?</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            {purgeScope.scope === "all"
              ? "Toutes tes recettes, carnets, planning, courses et stock seront définitivement effacés. Cette action est irréversible."
              : "Ces données seront définitivement effacées. Cette action est irréversible."}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPurgeScope(null)}>Annuler</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { onPurge?.(purgeScope.scope); setPurgeScope(null); }}>Effacer</button>
          </div>
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
