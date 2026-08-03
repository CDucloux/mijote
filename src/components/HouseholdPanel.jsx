import { useState, useEffect } from "react";
import { Icon } from "./Icon.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { peopleCount, isOwner, MAX_HOUSEHOLD } from "@/lib/household/household.js";

// Avatar rond : photo si disponible, sinon initiale colorée.
function Avatar({ photo, label, size = 34, dim = false }) {
  const ini = (label || "?").trim()[0]?.toUpperCase() || "?";
  return photo
    ? <img src={photo} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover", border: "1px solid var(--border)" }} />
    : <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 700, color: "#fff", background: dim ? "var(--text3)" : "var(--accent)" }}>{ini}</span>;
}

// ─── PANNEAU FOYER ────────────────────────────────────────────────────────────
// `onClose` (optionnel) : ferme la feuille parente après un quitter/dissoudre.
export function HouseholdPanel({ onClose }) {
  const { user, directory = [], loadDirectory } = useAppShell();
  const { household, invites, loading, actions } = useHousehold();
  const [name, setName] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Le panneau foyer a besoin de l'annuaire (candidats à l'invitation + avatars).
  useEffect(() => { loadDirectory?.(); }, [loadDirectory]);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
      <div style={{ width: 22, height: 22, border: "2.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
    </div>;
  }

  const myEmail = (user?.email || "").toLowerCase();
  const owner = household && isOwner(household, user?.uid);
  const full = household && peopleCount(household) >= MAX_HOUSEHOLD;
  const dirByEmail = new Map(directory.map(d => [(d.email || "").toLowerCase(), d]));
  const photoFor = (email) => (email === myEmail ? user?.photoURL : dirByEmail.get(email)?.photoURL) || "";
  const nameFor = (email) => dirByEmail.get(email)?.displayName || "";

  // Candidats à l'invitation : utilisateurs déjà connus, hors moi / membres / invités.
  const taken = new Set([...(household?.memberEmails || []), ...(household?.invitedEmails || []), myEmail]);
  const candidates = directory.filter(d => d.email && !taken.has((d.email || "").toLowerCase()));

  const card = (children, style) => (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, ...style }}>{children}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Bandeau info */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "linear-gradient(135deg, rgba(232,112,58,0.10), rgba(232,112,58,0.04))", border: "1px solid rgba(232,112,58,0.25)", borderRadius: 14, padding: "14px 16px" }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: "rgba(232,112,58,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="info" size={18} color="var(--accent)" />
        </span>
        <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55 }}>
          Jusqu'à <strong style={{ color: "var(--text)" }}>{MAX_HOUSEHOLD} personnes</strong> partagent recettes, stock, listes de courses et planning. En rejoignant un foyer, tes recettes y sont <strong style={{ color: "var(--text)" }}>ajoutées</strong> ; planning, stock et courses du foyer sont adoptés (ta version perso reste sauvegardée).
        </span>
      </div>

      {/* Invitations reçues */}
      {invites.map(inv => (
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
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(household.memberEmails || []).map(e => {
                  const mine = e === myEmail;
                  const nm = nameFor(e);
                  return (
                    <div key={e} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <Avatar photo={photoFor(e)} label={nm || e} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm || e}{mine ? " (toi)" : ""}</div>
                        {nm && <div style={{ fontSize: 11.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e}</div>}
                      </div>
                      {household.ownerUid && ((mine && owner) || (!mine && nm && false)) && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.04em" }}>OWNER</span>}
                    </div>
                  );
                })}
                {(household.invitedEmails || []).map(e => (
                  <div key={e} style={{ display: "flex", alignItems: "center", gap: 11, opacity: 0.75 }}>
                    <Avatar photo={photoFor(e)} label={e} dim />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e}</div>
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>en attente</span>
                    {owner && <button onClick={() => actions.cancelInvite(e)} title="Annuler l'invitation" style={{ color: "var(--text3)", display: "inline-flex" }}><Icon name="close" size={13} color="var(--text3)" /></button>}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Inviter — uniquement des utilisateurs déjà connus de Mijoté */}
          {owner && !full && (
            card(
              <>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Inviter une personne</div>
                <div style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 12 }}>Parmi les utilisateurs déjà connectés à Mijoté.</div>
                {candidates.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--text3)", textAlign: "center", padding: "10px 0" }}>Aucun autre utilisateur disponible pour l'instant.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto", margin: "0 -6px" }}>
                    {candidates.map(d => (
                      <button key={d.uid || d.email} onClick={() => actions.invite(d.email)}
                        style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 6px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                        onMouseLeave={e => e.currentTarget.style.background = "none"}>
                        <Avatar photo={d.photoURL} label={d.displayName || d.email} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.displayName || d.email}</div>
                          {d.displayName && <div style={{ fontSize: 11.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.email}</div>}
                        </div>
                        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}><Icon name="plus" size={13} color="var(--accent)" /> Inviter</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )
          )}

          {/* Quitter / dissoudre */}
          <button className="btn btn-ghost" style={{ color: "var(--red)", borderColor: "rgba(224,82,82,0.3)" }} onClick={() => setConfirmLeave(true)}>
            <Icon name="logout" size={15} color="var(--red)" /> {owner ? "Dissoudre le foyer" : "Quitter le foyer"}
          </button>
        </>
      )}

      {/* Feuille de confirmation quitter / dissoudre. On garde `household` dans la
          condition : dès qu'il devient null (dissolution/départ effectif), la feuille
          se démonte sans jamais lire household.name sur une valeur nulle. */}
      {confirmLeave && household && (
        <ConfirmDialog
          title={owner ? "Dissoudre le foyer ?" : "Quitter le foyer ?"}
          icon={owner ? "trash" : "logout"}
          confirmLabel={owner ? "Dissoudre" : "Quitter"}
          onCancel={() => setConfirmLeave(false)}
          onConfirm={async () => { const ok = await (owner ? actions.dissolve() : actions.leave()); setConfirmLeave(false); if (ok) onClose?.(); }}>
          {owner
            ? <>« {household.name} » sera supprimé pour <strong style={{ color: "var(--text)" }}>tous les membres</strong>. Les données partagées ne seront plus accessibles. Ta <strong style={{ color: "var(--text)" }}>bibliothèque personnelle reste intacte</strong>.</>
            : <>Tu n'auras plus accès aux données partagées de « {household.name} ». Ta <strong style={{ color: "var(--text)" }}>version personnelle reste sauvegardée</strong> et redevient active.</>}
        </ConfirmDialog>
      )}
    </div>
  );
}
