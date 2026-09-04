import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { peopleCount, isOwner, MAX_HOUSEHOLD } from "@/lib/household/household.js";
import { Row, Col, IconChip } from "./ui/primitives.jsx";

// Avatar rond : photo si disponible, sinon initiale colorée.
function Avatar({ photo, label, size = 34, dim = false }) {
  const ini = (label || "?").trim()[0]?.toUpperCase() || "?";
  return photo
    ? <img src={photo} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover", border: "1px solid var(--border)" }} />
    : <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 600, color: "#fff", background: dim ? "var(--text3)" : "var(--accent)" }}>{ini}</span>;
}

// ─── PANNEAU FOYER ────────────────────────────────────────────────────────────
// `onClose` (optionnel) : ferme la feuille parente après un quitter/dissoudre.
export function HouseholdPanel({ onClose }) {
  const { user, directory = [], loadDirectory, preferences, isPlus } = useAppShell();
  const { household, invites, loading, actions } = useHousehold();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Le panneau foyer a besoin de l'annuaire (candidats à l'invitation + avatars).
  useEffect(() => { loadDirectory?.(); }, [loadDirectory]);

  if (loading) {
    return <Row justify="center" style={{ padding: "32px 0" }}>
      <div style={{ width: 22, height: 22, border: "2.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
    </Row>;
  }

  const myEmail = (user?.email || "").toLowerCase();
  const owner = household && isOwner(household, user?.uid);
  const full = household && peopleCount(household) >= MAX_HOUSEHOLD;
  const dirByEmail = new Map(directory.map(d => [(d.email || "").toLowerCase(), d]));
  const photoFor = (email) => (email === myEmail ? user?.photoURL : dirByEmail.get(email)?.photoURL) || "";
  // Mon nom personnalisé dans l'app (préférences) prime sur le nom technique de
  // l'annuaire (Google/Firestore) ; pour les autres membres, seul l'annuaire est connu.
  const myName = (preferences?.displayName || user?.displayName || "").trim();
  const nameFor = (email) => (email === myEmail ? myName : "") || dirByEmail.get(email)?.displayName || "";

  // Candidats à l'invitation : utilisateurs déjà connus, hors moi / membres / invités.
  const taken = new Set([...(household?.memberEmails || []), ...(household?.invitedEmails || []), myEmail]);
  const candidates = directory.filter(d => d.email && !taken.has((d.email || "").toLowerCase()));

  const card = (children, style) => (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, ...style }}>{children}</div>
  );

  return (
    <Col gap={14}>
      {/* Bandeau info : tint accent plate (plus sobre que l'ancien dégradé), titre
          court puis explication du partage. */}
      <Col gap={9} style={{ background: "rgba(var(--accent-rgb),0.07)", border: "1px solid rgba(var(--accent-rgb),0.18)", borderRadius: 16, padding: 16 }}>
        <Row gap={10}>
          <IconChip size={32} radius={10} tint="rgba(var(--accent-rgb),0.15)">
            <Icon name="info" size={17} color="var(--accent)" />
          </IconChip>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Un foyer, tout en commun</span>
        </Row>
        <span style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.6 }}>
          Jusqu'à <strong style={{ color: "var(--text)" }}>{MAX_HOUSEHOLD} personnes</strong> partagent recettes, stock, listes de courses et planning. En rejoignant un foyer, tes recettes y sont <strong style={{ color: "var(--text)" }}>ajoutées</strong> ; planning, stock et courses du foyer sont adoptés (ta version perso reste sauvegardée).
        </span>
      </Col>

      {/* Invitations reçues */}
      {invites.map(inv => (
        <div key={inv.id} style={{ background: "rgba(var(--accent-rgb),0.07)", border: "1px solid rgba(var(--accent-rgb),0.35)", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Invitation à rejoindre « {inv.name} »</div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>{(inv.memberEmails || []).length} membre(s)</div>
          <Row align="stretch" gap={10}>
            <button className="btn btn-primary btn-sm" onClick={() => actions.accept(inv.id)}><Icon name="check" size={14} /> Rejoindre</button>
            <button className="btn btn-ghost btn-sm" onClick={() => actions.decline(inv.id)}>Refuser</button>
          </Row>
        </div>
      ))}

      {!household ? (
        /* ── Pas de foyer : en créer un ── */
        card(
          <>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Créer un foyer</div>
            <div style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 14 }}>Tu en seras le propriétaire et pourras inviter {MAX_HOUSEHOLD - 1} personne{MAX_HOUSEHOLD - 1 > 1 ? "s" : ""}.</div>
            <input className="field-input" placeholder="Nom du foyer (ex. Maison Dupont)" value={name} maxLength={40} onChange={e => setName(e.target.value)} style={{ marginBottom: 12 }} />
            {/* Soft-lock : en gratuit, la page de création reste visible (l'utilisateur
                se projette), mais la validation renvoie vers l'offre au lieu de créer. */}
            {isPlus ? (
              <button className="btn btn-primary" onClick={async () => { if (await actions.create(name)) setName(""); }} style={{ width: "100%" }}>
                <Icon name="plus" size={16} /> Créer le foyer
              </button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => navigate("/plan")} style={{ width: "100%" }}>
                  <Icon name="sparkle" size={16} /> Débloquer avec Cardamome+
                </button>
                <Row gap={6} justify="center" style={{ marginTop: 10 }}>
                  <Icon name="lock" size={13} color="var(--text3)" />
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>Le foyer partagé fait partie de Cardamome+.</span>
                </Row>
              </>
            )}
          </>
        )
      ) : (
        /* ── Foyer actif ── */
        <>
          {card(
            <>
              <Row justify="space-between" style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700 }}>{household.name}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)" }}>{peopleCount(household)}/{MAX_HOUSEHOLD}</span>
              </Row>
              <Col gap={10}>
                {(household.memberEmails || []).map(e => {
                  const mine = e === myEmail;
                  const nm = nameFor(e);
                  return (
                    <Row key={e} gap={11}>
                      <Avatar photo={photoFor(e)} label={nm || e} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm || e}{mine ? " (toi)" : ""}</div>
                        {nm && <div style={{ fontSize: 11.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e}</div>}
                      </div>
                      {household.ownerUid && ((mine && owner) || (!mine && nm && false)) && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.04em" }}>OWNER</span>}
                    </Row>
                  );
                })}
                {(household.invitedEmails || []).map(e => (
                  <Row key={e} gap={11} style={{ opacity: 0.75 }}>
                    <Avatar photo={photoFor(e)} label={e} dim />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e}</div>
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>en attente</span>
                    {owner && <button onClick={() => actions.cancelInvite(e)} title="Annuler l'invitation" style={{ color: "var(--text3)", display: "inline-flex" }}><Icon name="close" size={13} color="var(--text3)" /></button>}
                  </Row>
                ))}
              </Col>
            </>
          )}

          {/* Inviter, uniquement des utilisateurs déjà connus de Cardamome */}
          {owner && !full && (
            card(
              <>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Inviter une personne</div>
                <div style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 12 }}>Parmi les utilisateurs déjà connectés à Cardamome.</div>
                {candidates.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--text3)", textAlign: "center", padding: "10px 0" }}>Aucun autre utilisateur disponible pour l'instant.</div>
                ) : (
                  <Col gap={4} style={{ maxHeight: 240, overflowY: "auto", margin: "0 -6px" }}>
                    {candidates.map(d => (
                      <Row as="button" key={d.uid || d.email} gap={11} onClick={() => actions.invite(d.email)}
                        style={{ padding: "8px 6px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", textAlign: "left", width: "100%" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                        onMouseLeave={e => e.currentTarget.style.background = "none"}>
                        <Avatar photo={d.photoURL} label={d.displayName || d.email} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.displayName || d.email}</div>
                          {d.displayName && <div style={{ fontSize: 11.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.email}</div>}
                        </div>
                        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--accent)" }}><Icon name="plus" size={13} color="var(--accent)" /> Inviter</span>
                      </Row>
                    ))}
                  </Col>
                )}
              </>
            )
          )}

          {/* Quitter / dissoudre : action destructive, franchement rouge (pilule teintée). */}
          <button className="btn" style={{ width: "100%", background: "rgba(224,82,82,0.12)", color: "var(--red)", fontWeight: 600, borderRadius: 999 }} onClick={() => setConfirmLeave(true)}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(224,82,82,0.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(224,82,82,0.12)"; }}>
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
    </Col>
  );
}
