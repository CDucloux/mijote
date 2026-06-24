import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { BaseIcon } from "./BaseIcon.jsx";

const SECTIONS = [
  {
    title: "C'est quoi une préparation de base ?",
    body: "En cuisine professionnelle, une préparation de base (ou « fond ») est un élément élaboré à l'avance, indépendamment d'un plat précis, et qui va servir de brique de construction pour plusieurs recettes. On parle aussi d'appareils, de liaisons ou de compositions.",
  },
  {
    title: "Les grandes familles",
    items: [
      { label: "Fonds", desc: "Fond brun, fond blanc, fumet de poisson, fond de volaille — la colonne vertébrale des sauces. Ils se préparent à l'avance et se congèlent." },
      { label: "Sauces mères", desc: "Béchamel, velouté, espagnole, hollandaise, tomate. Toute la sauce-cuisine classique en découle." },
      { label: "Appareils", desc: "Mélanges prêts à l'emploi : appareil à crème brûlée, à quiche, à financier… On les prépare la veille pour gagner du temps service." },
      { label: "Liaisons", desc: "Roux, beurre manié, liaison à la crème ou aux jaunes — des texturants qu'on intègre dans d'autres préparations." },
      { label: "Farces & duxelles", desc: "Prêtes à garnir, farcir ou incorporer dans une autre recette." },
    ],
  },
  {
    title: "Pourquoi en haute cuisine ?",
    body: "Les grands chefs travaillent en brigades : un cuisinier se consacre aux fonds toute la journée pendant qu'un autre monte les plats. Chaque base est calibrée une fois (qualité, concentration, assaisonnement) et réutilisée à l'infini — c'est ce qui garantit la régularité du restaurant.",
  },
  {
    title: "Dans Mijoté",
    body: "Une recette marquée « Base » peut être liée à une autre recette en tant qu'ingrédient. Quand tu cuisines la recette parente, Mijoté te propose de réaliser d'abord toutes ses bases avant de passer aux étapes principales.",
  },
];

export function BaseInfoModal({ onClose }) {
  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "88dvh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(232,112,58,0.12)", border: "1px solid rgba(232,112,58,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BaseIcon size={18} color="var(--accent)" />
        </span>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>Préparation de base</div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 1 }}>La cuisine professionnelle expliquée</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, overflowY: "auto", maxHeight: "66vh", paddingBottom: 4 }}>
        {SECTIONS.map((s, i) => (
          <div key={i} style={{ background: "var(--surface2)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 8, letterSpacing: "-0.01em" }}>{s.title}</div>
            {s.body && <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{s.body}</p>}
            {s.items && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {s.items.map((it, j) => (
                  <div key={j} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", background: "rgba(232,112,58,0.1)", borderRadius: 6, padding: "2px 7px", marginTop: 1, flexShrink: 0, whiteSpace: "nowrap" }}>{it.label}</span>
                    <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, margin: 0 }}>{it.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="btn btn-ghost" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>Fermer</button>
    </SwipeableSheet>
  );
}
