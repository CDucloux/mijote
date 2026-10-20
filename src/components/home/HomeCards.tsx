import { useState } from "react";
import { Icon, type IconName } from "../ui/Icon.jsx";
import { Img } from "../ui/Img.jsx";
import { NewRecipeSheet } from "../recipe/NewRecipeButton.jsx";
import { SLOT_BY_ID } from "../../constants/mealSlots.js";
import { fmtTime } from "@/lib/format.js";
import type { TodayMealCard } from "@/lib/planning/dashboard.js";

/** Carte de notification compacte (courses, stock bas) : icône, libellé, chevron. */
interface NotifRowProps {
  icon: IconName;
  color: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
  animationDelay: string;
}

export function NotifRow({ icon, color, title, subtitle, onClick, animationDelay }: NotifRowProps) {
  return (
    <button onClick={onClick} className="slide-up pressable ripple hover-card"
      style={{
        "--tint": color,
        animationDelay,
        display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
        padding: "13px 14px", borderRadius: 18,
        background: "var(--surface)", border: "1px solid var(--border)",
        cursor: "pointer",
      }}>
      <span style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
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
export function OnboardingCard({ onNewRecipe, onExplore }: { onNewRecipe: () => void; onExplore: () => void }) {
  // Le CTA d'entrée ouvre la feuille de choix (import intelligent en tête) plutôt
  // que d'aller droit à la saisie manuelle : le nouvel utilisateur découvre dès le
  // premier geste qu'il peut importer un lien / une photo / un texte / un PDF.
  const [newOpen, setNewOpen] = useState(false);
  const steps: { icon: IconName; label: string; desc: string; on: boolean }[] = [
    { icon: "book", label: "Recette", desc: "Ta première fiche", on: true },
    { icon: "calendar", label: "Planning", desc: "La semaine s'organise", on: false },
    { icon: "shopping", label: "Courses", desc: "La liste se remplit", on: false },
  ];
  return (
    <div className="slide-up onboard-card" style={{ animationDelay: "0.04s",
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20,
      padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
      <div className="onboard-grid">
        {/* Colonne principale : titre (icône intégrée en ligne), accroche large, actions */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(var(--accent-rgb),0.12)" }}>
              <Icon name="book" size={20} color="var(--accent)" />
            </span>
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0 }}>
              Ta cuisine démarre ici
            </h3>
          </div>
          <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 18px", maxWidth: "62ch" }}>
            Ajoute une première recette et tout s'enchaîne : le planning de la semaine, la liste de courses et le suivi du stock se remplissent ensuite pour toi.
          </p>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <button onClick={() => setNewOpen(true)} className="btn btn-primary btn-pill pressable ripple" style={{ width: "auto" }}>
              <Icon name="plus" size={16} color="#fff" /> Ajouter une recette
            </button>
            <button onClick={onExplore} className="pressable hover-tint" style={{ background: "none", border: "none", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 4, padding: "10px 16px", borderRadius: 999,
              fontFamily: "var(--ff-body)", fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>
              Explorer la communauté <Icon name="forward" size={14} color="var(--accent)" />
            </button>
          </div>
        </div>
        {/* Rail « parcours » : le geste suivant se débloque une fois la recette ajoutée.
            Vertical à droite sur desktop (le contenu remplit la largeur), en pied
            horizontal sur mobile. Séparé par un simple filet, jamais une carte imbriquée. */}
        <div className="onboard-rail">
          {steps.map(s => (
            <div key={s.label} className="onboard-step" style={{ opacity: s.on ? 1 : 0.5 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: s.on ? "rgba(var(--accent-rgb),0.12)" : "var(--surface2)" }}>
                <Icon name={s.icon} size={15} color={s.on ? "var(--accent)" : "var(--text3)"} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: s.on ? "var(--text)" : "var(--text3)", whiteSpace: "nowrap" }}>{s.label}</span>
                <span style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>{s.desc}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      {newOpen && <NewRecipeSheet onClose={() => setNewOpen(false)} onManual={onNewRecipe} />}
    </div>
  );
}

// ─── JOURNÉE LIBRE ────────────────────────────────────────────────────────────
// L'utilisateur a déjà des recettes mais rien de planifié aujourd'hui : plutôt
// qu'une barre vide « Rien de prévu », on l'invite à prendre de l'avance. Un
// en-tête rassurant (la journée est libre, ce n'est pas un manque), puis une
// grille d'actions concrètes. Hiérarchie assumée : « Planifier la semaine » domine
// (pastille pleine accent), les autres sont des tuiles neutres. Une seule carte,
// pas de cartes imbriquées : les actions sont groupées par proximité.
interface CalmDayCardProps {
  onPlan: () => void;
  onNewRecipe: () => void;
  onStock: () => void;
  onShopping: () => void;
}

export function CalmDayCard({ onPlan, onNewRecipe, onStock, onShopping }: CalmDayCardProps) {
  const [newOpen, setNewOpen] = useState(false);
  const tiles: { icon: IconName; label: string; desc: string; on: () => void }[] = [
    { icon: "plus", label: "Ajouter une recette", desc: "Enrichis ta bibliothèque", on: () => setNewOpen(true) },
    { icon: "box", label: "Gérer le stock", desc: "Fais le point sur tes réserves", on: onStock },
    { icon: "shopping", label: "Faire les courses", desc: "Prépare ta prochaine liste", on: onShopping },
  ];
  return (
    <div className="slide-up" style={{ animationDelay: "0.04s",
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20,
      padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(var(--ok-rgb),0.16)" }}>
          <Icon name="check" size={18} color="var(--ok)" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.15 }}>Rien de prévu aujourd'hui</div>
          <div style={{ fontSize: 12.5, color: "var(--text3)" }}>Ta journée est libre. Prends un peu d'avance.</div>
        </div>
      </div>

      {/* Action qui domine : planifier la semaine, en pastille pleine. */}
      <button onClick={onPlan} className="btn btn-primary btn-pill pressable ripple" style={{ width: "100%", padding: "12px 0", fontSize: 14.5, margin: "16px 0 12px" }}>
        <Icon name="calendar" size={16} color="#fff" /> Planifier la semaine
      </button>

      {/* Tuiles secondaires, groupées par un simple filet, jamais des cartes imbriquées. */}
      <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--border)" }}>
        {tiles.map(t => (
          <button key={t.label} onClick={t.on} className="pressable ripple hh-calm-tile"
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 10px", background: "none", border: "none", borderRadius: 12, cursor: "pointer" }}>
            <span className="hh-calm-ico" style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(var(--accent-rgb),0.12)", transition: "background-color 0.16s ease" }}>
              <Icon name={t.icon} size={16} color="var(--accent)" />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{t.label}</span>
              <span style={{ fontSize: 11.5, color: "var(--text3)" }}>{t.desc}</span>
            </span>
            <span className="hh-calm-arrow" style={{ display: "inline-flex", flexShrink: 0, transition: "transform 0.16s ease, color 0.16s ease", color: "var(--text3)" }}>
              <Icon name="forward" size={15} color="currentColor" />
            </span>
          </button>
        ))}
      </div>
      {newOpen && <NewRecipeSheet onClose={() => setNewOpen(false)} onManual={onNewRecipe} />}
    </div>
  );
}

interface TodayMealRowProps {
  card: TodayMealCard;
  /** Rang de la carte (décalage de l'animation d'entrée). */
  index: number;
  onOpen: (recipeId: string) => void;
}

/** Repas du jour : vignette, créneau, nom, temps, et autres services du repas composé. */
export function TodayMealRow({ card, index, onOpen }: TodayMealRowProps) {
  const m = card.primary;
  const slot = m.slot ? SLOT_BY_ID[m.slot] : undefined;
  return (

    <button onClick={() => { if (m.recipe.id) onOpen(m.recipe.id); }} className="slide-up pressable ripple hover-card"
      style={{
        "--tint": slot?.accent || "var(--accent)",
        animationDelay: `${index * 0.06}s`,
        display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
        padding: "12px 14px", borderRadius: 18, cursor: "pointer", overflow: "hidden",
        background: "var(--surface)", border: "1px solid var(--border)",
      }}>
      <div style={{ width: 70, height: 70, borderRadius: 14, overflow: "hidden", flexShrink: 0, boxShadow: "0 3px 10px rgba(0,0,0,0.14)" }}>
        <Img src={m.recipe.image} alt={m.recipe.name} style={{ width: "100%", height: "100%" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 10.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
          background: slot?.color || "var(--surface2)",
          color: slot?.text || "var(--text2)",
          marginBottom: 6,
        }}>
          {slot?.today || "Au menu"}
        </span>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.recipe.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 3 }}>
          {fmtTime((Number(m.recipe.prepTime) || 0) + (Number(m.recipe.cookTime) || 0))}{m.recipe.ingredients?.length ? ` | ${m.recipe.ingredients.length} ingr.` : ""}
        </div>
        {card.others.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.others.map(o => <span key={o.recipe.id}><span style={{ color: "var(--accent)", fontWeight: 600, position: "relative", top: "-1px" }}>+</span> {o.recipe.name} </span>)}
          </div>
        )}
      </div>
      <Icon name="forward" size={16} color="var(--text3)" />
    </button>
  );
}
