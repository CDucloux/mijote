import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ElasticScroll } from "../components/ElasticScroll.jsx";
import { GUIDE_DOCS, GUIDE_BY_ID } from "../constants/guideDocs.js";

// ─── GUIDE D'UTILISATION ────────────────────────────────────────────────────────
// Page dédiée /guide : le « comment qu'on fait » de Cardamome. /guide → index des
// thèmes ; /guide/<id> → lecture d'un thème. Chaque thème porte sa couleur (voir
// front-matter) reprise sur la carte d'index, le hero et la prose (.guide-md), à la
// manière des slides d'onboarding : la page respire au lieu d'aligner du Markdown brut.
const softTile = (color) => color.startsWith("#") ? `color-mix(in srgb, ${color} 14%, transparent)` : "rgba(var(--accent-rgb),0.14)";
const borderTile = (color) => color.startsWith("#") ? `color-mix(in srgb, ${color} 34%, transparent)` : "rgba(var(--accent-rgb),0.3)";

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
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {doc ? doc.title : "Guide"}
        </h1>
      </div>

      <ElasticScroll style={{ flex: 1, padding: "18px 20px var(--page-pad-b)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {doc ? <Document doc={doc} navigate={navigate} /> : <Index navigate={navigate} />}
        </div>
      </ElasticScroll>
    </div>
  );
}

function Index({ navigate }) {
  return (
    <>
      <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55, margin: "0 0 20px" }}>
        Tout ce que Cardamome sait faire, expliqué pas à pas. Choisis un sujet pour commencer.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {GUIDE_DOCS.map(d => (
          <button key={d.id} onClick={() => navigate(`/guide/${d.id}`)} className="legal-row"
            style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}>
            <span style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: softTile(d.color), border: `1px solid ${borderTile(d.color)}` }}>
              <Icon name={d.icon} size={19} color={d.color} />
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

function Document({ doc, navigate }) {
  const idx = GUIDE_DOCS.findIndex(d => d.id === doc.id);
  const next = idx >= 0 ? GUIDE_DOCS[idx + 1] : null;
  return (
    <div className="guide-doc" style={{ "--guide-accent": doc.color }}>
      {doc.lead && (
        <div className="guide-hero">
          <span className="guide-hero-icon"><Icon name={doc.icon} size={26} color="#fff" /></span>
          <p className="guide-hero-lead">{doc.lead}</p>
        </div>
      )}
      <article className="guide-md">
        <div dangerouslySetInnerHTML={{ __html: doc.html }} />
      </article>
      {next && (
        <button className="guide-next" onClick={() => navigate(`/guide/${next.id}`)}
          style={{ "--guide-accent": next.color }}>
          <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", background: softTile(next.color), border: `1px solid ${borderTile(next.color)}` }}>
            <Icon name={next.icon} size={17} color={next.color} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Sujet suivant</span>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{next.title}</span>
          </span>
          <Icon name="forward" size={15} color="var(--text3)" />
        </button>
      )}
    </div>
  );
}
