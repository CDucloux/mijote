import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { BaseIcon } from "./BaseIcon.jsx";

const INTRO = "En cuisine professionnelle, une préparation de base est un élément élaboré à l'avance, indépendamment d'un plat précis, qui sert de brique de construction pour plusieurs recettes.";

const FAMILIES = [
  { label: "Fonds", desc: "Fond brun, fond blanc, fumet de poisson, fond de volaille — la colonne vertébrale des sauces. Ils se préparent à l'avance et se congèlent." },
  { label: "Sauces mères", desc: "Béchamel, velouté, espagnole, hollandaise, tomate. Toute la sauce-cuisine classique en découle." },
  { label: "Appareils", desc: "Mélanges prêts à l'emploi : appareil à crème brûlée, à quiche, à financier… On les prépare la veille pour gagner du temps service." },
  { label: "Liaisons", desc: "Roux, beurre manié, liaison à la crème ou aux jaunes — des texturants qu'on intègre dans d'autres préparations." },
  { label: "Farces & duxelles", desc: "Prêtes à garnir, farcir ou incorporer dans une autre recette." },
];

export function BaseInfoModal({ onClose }) {
  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "90dvh" }}>
      {/* Header — bandeau dégradé */}
      <div style={{
        margin: "-20px -20px 4px", padding: "26px 22px 22px",
        background: "linear-gradient(135deg, rgba(232,112,58,0.16), rgba(232,112,58,0.04))",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <span style={{
            width: 48, height: 48, borderRadius: 16, flexShrink: 0,
            background: "linear-gradient(135deg, var(--accent), #d4622e)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 20px -6px rgba(232,112,58,0.6)",
          }}>
            <BaseIcon size={24} color="#fff" />
          </span>
          <div>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text)" }}>Préparation de base</div>
            <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 2 }}>Principes de composition</div>
          </div>
        </div>
      </div>

      <div style={{ overflowY: "auto", maxHeight: "64vh", padding: "18px 2px 4px" }}>
        {/* Intro — lead paragraph */}
        <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.65, margin: "0 0 26px" }}>{INTRO}</p>

        {/* Les grandes familles — liste épurée numérotée */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Les grandes familles</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {FAMILIES.map((it, j) => (
            <div key={j} style={{
              display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0",
              borderTop: j === 0 ? "none" : "1px solid var(--border)",
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: 9, flexShrink: 0, marginTop: 1,
                background: "rgba(232,112,58,0.1)", color: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              }}>{j + 1}</span>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", marginBottom: 3 }}>{it.label}</div>
                <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55, margin: 0 }}>{it.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dans Mijoté — carte accent */}
        <div style={{
          marginTop: 24, padding: "16px 18px", borderRadius: 16,
          background: "linear-gradient(135deg, rgba(232,112,58,0.13), rgba(232,112,58,0.05))",
          border: "1px solid rgba(232,112,58,0.25)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
            <BaseIcon size={15} color="var(--accent)" />
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.01em" }}>Dans Mijoté</span>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>
            Une recette marquée « Base » peut être liée à une autre recette en tant qu'ingrédient. Quand tu cuisines la recette parente, Mijoté te propose de réaliser d'abord toutes ses bases avant de passer aux étapes principales.
          </p>
        </div>
      </div>

      <button className="btn btn-ghost" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>Fermer</button>
    </SwipeableSheet>
  );
}
