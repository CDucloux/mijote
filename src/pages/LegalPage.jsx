import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { LEGAL_DOCS, LEGAL_BY_ID, LEGAL_UPDATED } from "../constants/legalDocs.js";

// ─── INFORMATIONS LÉGALES ───────────────────────────────────────────────────────
// Page dédiée /legal, accessible même déconnecté (les documents légaux doivent
// l'être). /legal → index des documents ; /legal/<id> → lecture d'un document.
// Le foyer canonique du RGPD ; la sidebar desktop et l'écran de connexion y
// deep-linkent. La purge de données reste, elle, dans le Profil.
export function LegalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const seg = location.pathname.replace(/^\/legal\/?/, "").replace(/\/$/, "");
  const doc = seg ? LEGAL_BY_ID[seg] : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "20px 20px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => (doc ? navigate("/legal") : navigate(-1))} aria-label="Retour"
          style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}>
          <Icon name="back" size={17} />
        </button>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>
          {doc ? doc.title : "Informations légales"}
        </h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 40px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {doc ? <Document doc={doc} /> : <Index navigate={navigate} />}
        </div>
      </div>
    </div>
  );
}

function Index({ navigate }) {
  return (
    <>
      <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55, margin: "0 0 20px" }}>
        Retrouvez ici les documents encadrant l'utilisation de Mijoté et le traitement de vos données.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {LEGAL_DOCS.map(d => (
          <button key={d.id} onClick={() => navigate(`/legal/${d.id}`)} className="legal-row"
            style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}>
            <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(232,112,58,0.14)", border: "1px solid rgba(232,112,58,0.3)" }}>
              <Icon name={d.icon} size={18} color="var(--accent)" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 600 }}>{d.title}</span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.short}</span>
            </span>
            <Icon name="forward" size={15} color="var(--text3)" />
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 22, textAlign: "center" }}>
        Dernière mise à jour : {LEGAL_UPDATED}
      </p>
    </>
  );
}

function Document({ doc }) {
  return (
    <article style={{ fontSize: 14, lineHeight: 1.62, color: "var(--text)" }}>
      {doc.intro && (
        <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 22px", paddingBottom: 18, borderBottom: "1px solid var(--border)" }}>
          {doc.intro}
        </p>
      )}
      {doc.blocks.map((b, i) => (
        <section key={i} style={{ marginBottom: 22 }}>
          <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 17, fontWeight: 600, color: "var(--accent)", margin: "0 0 8px" }}>{b.h}</h2>
          {(b.p || []).map((para, j) => (
            <p key={j} style={{ margin: "0 0 8px", color: "var(--text2)" }}>{para}</p>
          ))}
          {b.list && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "var(--text2)" }}>
              {b.list.map((li, j) => (
                <li key={j} style={{ margin: "0 0 6px" }}>{li}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 26, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        Dernière mise à jour : {LEGAL_UPDATED}
      </p>
    </article>
  );
}
