import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { BaseIcon } from "./BaseIcon.jsx";
import { Row, Col, IconChip } from "./ui/primitives.jsx";

const INTRO = "Une préparation de base est un élément élaboré à l'avance, indépendamment d'un plat précis, qui sert de brique de construction pour plusieurs recettes.";

const FAMILIES = [
  { label: "Fonds", desc: "Fond brun, fond blanc, fumet de poisson, fond de volaille – la colonne vertébrale des sauces. Ils se préparent à l'avance et se congèlent." },
  { label: "Sauces mères", desc: "Béchamel, velouté, espagnole, hollandaise, tomate. Toute la sauce-cuisine classique en découle." },
  { label: "Appareils", desc: "Mélanges prêts à l'emploi : appareil à crème brûlée, à quiche, à financier… On les prépare la veille pour gagner du temps service." },
  { label: "Liaisons", desc: "Roux, beurre manié, liaison à la crème ou aux jaunes – des texturants qu'on intègre dans d'autres préparations." },
];

export function BaseInfoModal({ onClose }) {
  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "90dvh" }}>
      {/* Header – bandeau dégradé */}
      <div style={{
        margin: "-20px -20px 4px", padding: "26px 22px 22px",
        background: "linear-gradient(135deg, rgba(var(--accent-rgb),0.16), rgba(var(--accent-rgb),0.04))",
        borderBottom: "1px solid var(--border)",
      }}>
        <Row gap={13}>
          <IconChip size={48} radius={16} tint="linear-gradient(135deg, var(--accent), var(--accent-strong))" style={{ boxShadow: "0 8px 20px -6px rgba(var(--accent-rgb),0.6)" }}>
            <BaseIcon size={24} color="#fff" />
          </IconChip>
          <div>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}>Préparation de base</div>
            <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 2 }}>Principes de composition</div>
          </div>
        </Row>
      </div>

      <div style={{ overflowY: "auto", maxHeight: "64vh", padding: "18px 2px 4px" }}>
        {/* Intro – lead paragraph */}
        <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.65, margin: "0 0 26px" }}>{INTRO}</p>

        {/* Les grandes familles – liste épurée numérotée */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Les grandes familles</div>
        <Col gap={2}>
          {FAMILIES.map((it, j) => (
            <Row key={j} align="flex-start" gap={14} style={{ padding: "14px 0", borderTop: j === 0 ? "none" : "1px solid var(--border)" }}>
              <IconChip size={28} radius={9} tint="rgba(var(--accent-rgb),0.1)" style={{ marginTop: 1, color: "var(--accent)", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{j + 1}</IconChip>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", marginBottom: 3 }}>{it.label}</div>
                <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55, margin: 0 }}>{it.desc}</p>
              </div>
            </Row>
          ))}
        </Col>

        {/* Dans Cardamome – carte accent */}
        <div style={{
          marginTop: 24, padding: "16px 18px", borderRadius: 16,
          background: "linear-gradient(135deg, rgba(var(--accent-rgb),0.13), rgba(var(--accent-rgb),0.05))",
          border: "1px solid rgba(var(--accent-rgb),0.25)",
        }}>
          <Row gap={7} style={{ marginBottom: 7 }}>
            <BaseIcon size={15} color="var(--accent)" />
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.01em" }}>Dans Cardamome</span>
          </Row>
          <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>
            Une recette marquée « Base » peut être liée à une autre recette en tant qu'ingrédient. Quand tu cuisines la recette parente, Cardamome te propose de réaliser d'abord toutes ses bases avant de passer aux étapes principales.
          </p>
        </div>
      </div>
    </SwipeableSheet>
  );
}
