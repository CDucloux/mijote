import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ElasticScroll } from "../components/ElasticScroll.jsx";
import { GUIDE_DOCS, GUIDE_BY_ID } from "../constants/guideDocs.js";

// ─── GUIDE D'UTILISATION ────────────────────────────────────────────────────────
// Page dédiée /guide : le « comment qu'on fait » de Cardamome. /guide → index des
// thèmes ; /guide/<id> → lecture d'un thème. Même patron que LegalPage (index de
// cartes + vue lecture), styles de prose réutilisés (.legal-md, .legal-row) pour
// ne pas dupliquer la mise en forme Markdown.
export function GuidePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const seg = location.pathname.replace(/^\/guide\/?/, "").replace(/\/$/, "");
  const doc = seg ? GUIDE_BY_ID[seg] : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => (doc ? navigate("/guide") : navigate("/home"))} aria-label="Retour"
          style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}>
          <Icon name="back" size={17} />
        </button>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
          {doc ? doc.title : "Guide"}
        </h1>
      </div>

      <ElasticScroll style={{ flex: 1, padding: "18px 20px var(--page-pad-b)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {doc ? <Document doc={doc} /> : <Index navigate={navigate} />}
        </div>
      </ElasticScroll>
    </div>
  );
}

function Index({ navigate }) {
  return (
    <>
      <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.55, margin: "0 0 20px" }}>
        Tout ce que Cardamome sait faire, expliqué pas à pas. Choisis un sujet.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {GUIDE_DOCS.map(d => (
          <button key={d.id} onClick={() => navigate(`/guide/${d.id}`)} className="legal-row"
            style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}>
            <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.14)", border: "1px solid rgba(var(--accent-rgb),0.3)" }}>
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
    </>
  );
}

function Document({ doc }) {
  return (
    <article className="legal-md">
      <div dangerouslySetInnerHTML={{ __html: doc.html }} />
    </article>
  );
}
