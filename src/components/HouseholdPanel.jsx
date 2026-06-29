import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { peopleCount, isOwner, MAX_HOUSEHOLD } from "../lib/household.js";

// ─── PANNEAU FOYER (Config › Foyer) ───────────────────────────────────────────
// Phase 1 : gestion de l'appartenance (créer, inviter, rejoindre, quitter).
// Le partage effectif des données (stock/recettes/listes/planning) arrive en
// Phase 2 ; un bandeau l'indique pour ne pas créer d'attente trompeuse.
export function HouseholdPanel() {
  const { user } = useAppShell();
  const { household, invites, loading, actions } = useHousehold();
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
      <div style={{ width: 22, height: 22, border: "2.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
    </div>;
  }

  const owner = household && isOwner(household, user?.uid);
  const full = household && peopleCount(household) >= MAX_HOUSEHOLD;

  const card = (children, style) => (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, ...style }}>{children}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
      {/* Bandeau d'étape : le partage des données n'est pas encore actif */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(91,156,246,0.10)", border: "1px solid rgba(91,156,246,0.3)", borderRadius: 12, padding: "10px 12px" }}>
        <Icon name="info" size={16} color="var(--blue)" />
        <span style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5 }}>
          Jusqu'à {MAX_HOUSEHOLD} personnes partagent <strong>recettes, stock, listes de courses et planning</strong>. En rejoignant un foyer, tes recettes y sont <strong>ajoutées</strong> ; planning, stock et courses du foyer sont adoptés (ta version perso reste sauvegardée).
        </span>
      </div>

      {/* Invitations reçues */}
      {invites.length > 0 && invites.map(inv => (
        <div key={inv.id} style={{ background: "rgba(232,112,58,0.07)", border: "1px solid rgba(232,112,58,0.35)", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Invitation à rejoindre « {inv.name} »</div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>{(inv.memberEmails || []).length} membre(s)</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => actions.accept(inv.id)}><Icon name="check" size={14} /> Rejoindre</button>
            <button className="btn btn-ghost btn-sm" onClick={() => actions.decline(inv.id)}>Refuser</button>
          </div>
        </div>
      ))}

      {!household ? (
        /* ── Pas de foyer : en créer un ── */
        card(
          <>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Créer un foyer</div>
            <div style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 14 }}>Tu en seras le propriétaire et pourras inviter {MAX_HOUSEHOLD - 1} personne{MAX_HOUSEHOLD - 1 > 1 ? "s" : ""}.</div>
            <input className="field-input" placeholder="Nom du foyer (ex. Maison Ducloux)" value={name} maxLength={40} onChange={e => setName(e.target.value)} style={{ marginBottom: 12 }} />
            <button className="btn btn-primary" onClick={async () => { if (await actions.create(name)) setName(""); }} style={{ width: "100%" }}>
              <Icon name="plus" size={16} /> Créer le foyer
            </button>
          </>
        )
      ) : (
        /* ── Foyer actif ── */
        <>
          {card(
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600 }}>{household.name}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)" }}>{peopleCount(household)}/{MAX_HOUSEHOLD}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(household.memberEmails || []).map(e => {
                  const mine = e === (user?.email || "").toLowerCase();
                  return (
                  <div key={e} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                    <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{e[0].toUpperCase()}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e}{mine ? " (toi)" : ""}</span>
                    {mine && owner && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.04em" }}>OWNER</span>}
                  </div>
                  );
                })}
                {(household.invitedEmails || []).map(e => (
                  <div key={e} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, opacity: 0.7 }}>
                    <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface3)", color: "var(--text3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="clock" size={14} color="var(--text3)" /></span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e}</span>
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>en attente</span>
                    {owner && <button onClick={() => actions.cancelInvite(e)} title="Annuler l'invitation" style={{ color: "var(--text3)", display: "inline-flex" }}><Icon name="close" size={13} color="var(--text3)" /></button>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Inviter */}
          {!full && (
            card(
              <>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Inviter par email</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="field-input" type="email" placeholder="email@exemple.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn btn-primary btn-sm" onClick={async () => { if (await actions.invite(inviteEmail)) setInviteEmail(""); }}>Inviter</button>
                </div>
              </>
            )
          )}

          {/* Quitter / dissoudre */}
          {!confirmLeave ? (
            <button className="btn btn-ghost" style={{ color: "var(--red)", borderColor: "rgba(224,82,82,0.3)" }} onClick={() => setConfirmLeave(true)}>
              <Icon name="logout" size={15} color="var(--red)" /> {owner ? "Dissoudre le foyer" : "Quitter le foyer"}
            </button>
          ) : (
            card(
              <>
                <div style={{ fontSize: 13.5, color: "var(--text2)", marginBottom: 12, lineHeight: 1.5 }}>
                  {owner
                    ? "Dissoudre le foyer le supprime pour tous les membres. Tes données personnelles ne sont pas effacées."
                    : "Quitter le foyer : tu n'auras plus accès à ses données partagées."}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmLeave(false)}>Annuler</button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { (owner ? actions.dissolve() : actions.leave()); setConfirmLeave(false); }}>
                    {owner ? "Dissoudre" : "Quitter"}
                  </button>
                </div>
              </>
            )
          )}
        </>
      )}
    </div>
  );
}
