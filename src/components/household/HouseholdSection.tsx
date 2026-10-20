import { useState, useEffect } from "react";
import { Icon } from "../ui/Icon.jsx";
import { PlusBadge } from "../badges/PlusBadge.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { HouseholdPanel } from "./HouseholdPanel.jsx";
import { HouseholdGlyph } from "./HouseholdGlyph.jsx";
import { useAppShell } from "../../context/AppShellContext.jsx";
import { useHousehold } from "../../hooks/useHousehold.js";
import { peopleCount, MAX_HOUSEHOLD } from "@/lib/household/household.js";

/** Champ texte d'une fiche d'annuaire (données Firestore non typées). */
const text = (value: unknown): string => (typeof value === "string" ? value : "");

interface MemberStackProps {
  emails: string[];
  photoFor: (email: string) => string;
  nameFor: (email: string) => string;
}

function MemberStack({ emails, photoFor, nameFor }: MemberStackProps) {
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
export function HouseholdSection() {
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
  const dirByEmail = new Map(directory.map(d => [text(d.email).toLowerCase(), d]));
  const photoFor = (e: string) => (e === myEmail ? user?.photoURL || "" : text(dirByEmail.get(e)?.photoURL));
  const nameFor = (e: string) => text(dirByEmail.get(e)?.displayName);

  const hasInvite = invites.length > 0;
  const count = household ? peopleCount(household) : 0;
  const summary = household
    ? `${count} ${count > 1 ? "membres" : "membre"} · partage actif`
    : hasInvite ? "Une invitation t'attend" : "Recettes, courses & planning partagés";

  return (
    <section style={{ marginBottom: 26 }}>
      {/* Carte foyer : carte flottante + liseré accent à gauche (ombre interne, épouse
          les coins) + perforation pointillée comme séparateur distinctif. */}
      <button onClick={openFoyer} aria-label="Ouvrir le foyer" className="pressable ripple float-card foyer-card"
        style={{
          "--float-inset": "inset 4px 0 0 var(--accent)",
          position: "relative", width: "100%", textAlign: "left", cursor: "pointer",
          display: "flex", alignItems: "stretch", gap: 0, padding: 0,
          borderRadius: 18, overflow: "hidden",
        }}>
        {/* Souche gauche : pictogramme (sans foyer) ou pile d'avatars (foyer actif) */}
        <span style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 18px 16px 22px" }}>
          {household
            ? <MemberStack emails={household.memberEmails || []} photoFor={photoFor} nameFor={nameFor} />
            : <span style={{ width: 50, height: 50, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent)" }}>
                <HouseholdGlyph size={27} color="#fff" />
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
          <span className="foyer-affordance" style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none" }}>
            <Icon name={household ? "forward" : hasInvite ? "forward" : "plus"} size={16} color="var(--accent)" />
          </span>
        </span>
      </button>
      {open && (
        <SwipeableSheet onClose={() => setOpen(false)} style={{ maxHeight: "88dvh" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, margin: "0 0 16px" }}>
            <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent)" }}>
              <HouseholdGlyph size={20} color="#fff" />
            </span>
            Foyer
          </h2>
          <HouseholdPanel onClose={() => setOpen(false)} />
        </SwipeableSheet>
      )}
    </section>
  );
}
