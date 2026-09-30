import { useState, useMemo } from "react";
import { Icon } from "../ui/Icon.jsx";
import { Img } from "../ui/Img.jsx";
import { SearchField } from "../ui/SearchField.jsx";
import { NutriScoreBadge } from "../badges/NutriScoreBadge.jsx";
import { EmptyArt } from "../ui/EmptyArt.jsx";
import { ElasticScroll } from "../ui/ElasticScroll.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { MEAL_SLOTS, SLOT_BY_ID } from "../../constants/mealSlots.js";
import { fmtTime } from "@/lib/format.js";

/**
 * Feuille « Ajouter une recette » à un créneau donné : sélecteur de créneau (masqué
 * quand ouvert depuis un créneau précis), recherche et liste de la bibliothèque avec
 * confirmation animée (+ → ✓). L'ajout réel (composition du repas) est délégué au
 * parent via onConfirm(recipe, slot). L'état de recherche et d'animation est LOCAL.
 */
export function AddRecipeSheet({ date, initialSlot, lockSlot, recipes, liveNutri, onConfirm, onClose }) {
  const [slot, setSlot] = useState(initialSlot);
  const [q, setQ] = useState("");
  const [addedId, setAddedId] = useState(null);
  const activeIdx = Math.max(0, MEAL_SLOTS.findIndex(s => s.id === slot));
  const activeMeta = SLOT_BY_ID[slot];
  const filtered = useMemo(
    () => recipes.filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase())),
    [recipes, q],
  );

  // Clic sur (+) : le rond passe en ✓ vert (animation), puis la feuille se ferme avec
  // sa sortie animée et le repas est ajouté au planning.
  const confirm = (r, close) => {
    if (addedId) return; // une confirmation à la fois
    setAddedId(r.id);
    setTimeout(() => close(() => onConfirm(r, slot)), 500);
  };

  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "86dvh" }}>
      {(close) => (<>
        {/* En-tête : puce calendrier + titre + date */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
            <Icon name="calendar" size={21} color="var(--accent)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Ajouter une recette</h3>
            <div style={{ fontSize: 12.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {lockSlot && activeMeta ? `${activeMeta.meal} · ` : ""}{new Date(date + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
        </div>

        {/* Créneau : contrôle segmenté avec pastille glissante (transition douce).
            Masqué quand la feuille est ouverte depuis un créneau précis (slot figé). */}
        {!lockSlot && (
        <div style={{ position: "relative", display: "flex", padding: 4, background: "var(--surface2)", borderRadius: 14, marginBottom: 14 }}>
          {/* Pastille active : glisse d'un créneau à l'autre (translateX) */}
          <div aria-hidden="true" style={{
            position: "absolute", top: 4, bottom: 4, left: 4, width: `calc((100% - 8px) / ${MEAL_SLOTS.length})`,
            background: "var(--surface)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            transform: `translateX(calc(${activeIdx} * 100%))`,
            transition: "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
          }} />
          {MEAL_SLOTS.map(s => {
            const active = slot === s.id;
            return (
              <button key={s.id} onClick={() => setSlot(s.id)}
                style={{ position: "relative", zIndex: 1, flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer",
                  background: "transparent", color: active ? s.text : "var(--text3)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  transition: "color 0.3s ease" }}>
                <Icon name={s.icon} size={15} weight="duotone" color={active ? s.text : "var(--text3)"} />{s.label}
              </button>
            );
          })}
        </div>
        )}

        {/* Recherche standard (loupe clavier mobile, effacement) */}
        <SearchField value={q} onChange={setQ} placeholder="Rechercher une recette…" style={{ marginBottom: 16 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Icon name={q.trim() ? "search" : "book"} size={13} color="var(--accent)" />
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{q.trim() ? "Résultats" : "Ta bibliothèque"}</span>
          {filtered.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text3)" }}>{filtered.length}</span>}
        </div>

        <ElasticScroll max={64} style={{ maxHeight: "46vh", margin: "0 -2px", padding: "2px 2px 4px" }} contentStyle={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {filtered.map(r => {
            const total = (r.prepTime || 0) + (r.cookTime || 0);
            const nIng = r.ingredients?.length || 0;
            const nutri = liveNutri(r);
            const added = addedId === r.id;
            return (
              <button key={r.id} onClick={() => confirm(r, close)} disabled={!!addedId} className="complete-row ripple"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--surface)", borderRadius: 16, border: `1px solid ${added ? "rgba(var(--ok-rgb),0.5)" : "var(--border)"}`, textAlign: "left", cursor: addedId ? "default" : "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", transition: "border-color 0.25s ease, box-shadow 0.2s ease", opacity: addedId && !added ? 0.55 : 1 }}>
                <div style={{ width: 54, height: 54, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>{r.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {r.cuisine && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text2)", background: "var(--surface2)", borderRadius: 6, padding: "2px 7px" }}>{r.cuisine}</span>}
                    {total > 0 && <span style={{ fontSize: 11, color: "var(--text3)", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="clock" size={11} color="var(--text3)" /> {fmtTime(total)}</span>}
                    {nIng > 0 && <span style={{ fontSize: 11, color: "var(--text3)" }}>{nIng} ingr.</span>}
                    {nutri && <NutriScoreBadge letter={nutri} compact />}
                  </div>
                </div>
                {/* (+) → ✓ vert : le + sort en pivotant, le ✓ surgit (keyframes,
                    pour un jeu fiable même juste avant la fermeture de la feuille). */}
                <span className="complete-add" style={{ position: "relative", width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", overflow: "hidden",
                  background: added ? "var(--ok)" : "rgba(var(--accent-rgb),0.12)", color: added ? "#fff" : "var(--accent)",
                  transition: "background-color 0.3s ease",
                  animation: added ? "confirmBadgePop 0.34s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none" }}>
                  <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                    opacity: added ? 0 : 1,
                    animation: added ? "confirmPlusOut 0.26s ease forwards" : "none" }}>
                    <Icon name="plus" size={17} color="currentColor" />
                  </span>
                  <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                    opacity: added ? 1 : 0,
                    animation: added ? "confirmCheckIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none" }}>
                    <Icon name="check" size={17} color="currentColor" />
                  </span>
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "28px 20px", color: "var(--text3)" }}>
              <EmptyArt name="loupe" size={78} style={{ margin: "0 auto 8px" }} />
              <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>Aucune recette {q.trim() ? "ne correspond à ta recherche" : "dans ta bibliothèque"}.</p>
            </div>
          )}
        </ElasticScroll>
      </>)}
    </SwipeableSheet>
  );
}
