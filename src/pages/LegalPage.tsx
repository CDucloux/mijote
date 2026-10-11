import { useLocation, useNavigate } from "react-router-dom";
import type { NavigateFunction } from "react-router-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { ElasticScroll } from "../components/ui/ElasticScroll.jsx";
import { useInternalNav } from "../hooks/useInternalNav.js";
import { LEGAL_DOCS, LEGAL_BY_ID, LEGAL_UPDATED } from "../constants/legalDocs.js";

/** Document légal tel que produit par `legalDocs` (titre, icône, résumé, HTML rendu). */
interface LegalDoc {
  id: string;
  title: string;
  short: string;
  /** Ce que couvre le document, en une phrase. */
  lead: string;
  /** Temps de lecture estimé (minutes). */
  minutes: number;
  icon: string;
  html: string;
}

// ─── INFORMATIONS LÉGALES ───────────────────────────────────────────────────────
// Page dédiée /legal, accessible même déconnecté (les documents légaux doivent
// l'être). /legal → index des documents ; /legal/<id> → lecture d'un document.
// Le foyer canonique du RGPD ; la sidebar desktop et l'écran de connexion y
// deep-linkent. La purge de données reste, elle, dans le Profil.
export function LegalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const onProseClick = useInternalNav();
  const seg = location.pathname.replace(/^\/legal\/?/, "").replace(/\/$/, "");
  // `legalDocs` est en JS : `html` y est typé `string | Promise<string>` par
  // l'inférence, mais `marked.parse` est appelé en mode synchrone (string réelle).
  const doc = seg ? (LEGAL_BY_ID[seg] as LegalDoc) : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "20px 20px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => (doc ? navigate("/legal") : navigate("/home"))} aria-label="Retour" className="import-back"
          style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}>
          <Icon name="back" size={17} />
        </button>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
          {doc ? doc.title : "Informations légales"}
        </h1>
      </div>

      <ElasticScroll style={{ flex: 1, padding: "18px 20px var(--page-pad-b)" }} resetKey={seg || "index"}>
        <div key={seg || "index"} className="page-slide-in" onClick={onProseClick} style={{ maxWidth: 680, margin: "0 auto" }}>
          {doc ? <Document doc={doc} /> : <Index navigate={navigate} />}
        </div>
      </ElasticScroll>
    </div>
  );
}

// Index : une seule liste groupée (et non une carte par document), numérotée
// comme un sommaire. Chaque ligne dit ce que couvre le document et combien de
// temps il demande, pour choisir sans ouvrir. Le contact ferme la page : c'est
// la question qu'on se pose après avoir lu.
function Index({ navigate }: { navigate: NavigateFunction }) {
  return (
    <>
      <p style={{ fontSize: 14.5, color: "var(--text2)", lineHeight: 1.55, margin: "4px 0 22px", maxWidth: "56ch" }}>
        Ce qui encadre l'usage de Cardamome et le traitement de vos données, en clair.
      </p>
      <nav aria-label="Documents légaux" className="legal-list">
        {LEGAL_DOCS.map((d, i) => (
          <button key={d.id} onClick={() => navigate(`/legal/${d.id}`)} className="legal-row ripple">
            <span className="legal-row-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{d.title}</span>
              {d.lead && <span style={{ display: "block", fontSize: 12.5, color: "var(--text3)", marginTop: 3, lineHeight: 1.45 }}>{d.lead}</span>}
            </span>
            {d.minutes > 0 && <span style={{ flexShrink: 0, fontSize: 12, color: "var(--text3)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{d.minutes} min</span>}
            <span className="legal-row-chevron"><Icon name="forward" size={15} color="currentColor" /></span>
          </button>
        ))}
      </nav>
      <div style={{ marginTop: 18, padding: "0 4px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "6px 16px", fontSize: 12, color: "var(--text3)" }}>
        <span>Mis à jour le {LEGAL_UPDATED}</span>
        <span>Une question ? <a href="mailto:contact.cardamome@gmail.com" className="legal-contact">contact.cardamome@gmail.com</a></span>
      </div>
    </>
  );
}

function Document({ doc }: { doc: LegalDoc }) {
  return (
    <article className="legal-md">
      <div dangerouslySetInnerHTML={{ __html: doc.html }} />
      <p className="legal-md-updated">Dernière mise à jour : {LEGAL_UPDATED}</p>
    </article>
  );
}
