import { Icon } from "../Icon.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";

/**
 * Feuille de configuration d'une liste (création ou édition) : nom (avec
 * suggestions à la création), et bascule « Cacher Valider l'achat ». Le
 * brouillon est piloté au-dessus via `setConfigList` ; `onSave` crée ou met à jour.
 */
export function ListConfigSheet({ configList, setConfigList, focusNoScroll, onClose, onSave }) {
  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (<>
        {/* En-tête : pastille d'icône + titre + sous-titre contextuel */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <span style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
            <Icon name="shopping" size={20} color="var(--accent)" />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>{configList.isNew ? "Nouvelle liste" : "Configurer la liste"}</h3>
            <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "2px 0 0" }}>{configList.isNew ? "Une liste libre pour organiser tes courses." : "Ajuste le nom et les options."}</p>
          </div>
        </div>

        <div className="field-label" style={{ marginBottom: 8 }}>Nom de la liste</div>
        <input className="field-input" value={configList.name} maxLength={60} ref={focusNoScroll} placeholder="ex : Courses de la semaine"
          onChange={e => setConfigList(p => ({ ...p, name: e.target.value }))}
          onKeyDown={e => e.key === "Enter" && e.target.blur()} style={{ background: "var(--surface)", borderRadius: 13, height: 46 }} />

        {/* Suggestions de nom (nouvelle liste uniquement) */}
        {configList.isNew && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
            {["Courses de la semaine", "Marché", "Épicerie", "Week-end", "Apéro"].map(s => (
              <button key={s} onClick={() => setConfigList(p => ({ ...p, name: s }))} className="pressable"
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                  background: configList.name === s ? "rgba(var(--accent-rgb),0.12)" : "var(--surface2)",
                  color: configList.name === s ? "var(--accent)" : "var(--text2)",
                  border: `1px solid ${configList.name === s ? "rgba(var(--accent-rgb),0.4)" : "var(--border)"}` }}>{s}</button>
            ))}
          </div>
        )}

        <button onClick={() => setConfigList(p => ({ ...p, hideClear: !p.hideClear }))}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", padding: "13px 15px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, margin: "18px 0", cursor: "pointer", textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: "var(--surface2)", display: "grid", placeItems: "center" }}><Icon name="check" size={17} color="var(--text2)" /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>Cacher « Valider l'achat »</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, lineHeight: 1.4 }}>Évite de valider les articles par mégarde.</div>
            </div>
          </div>
          <span style={{ position: "relative", flexShrink: 0, width: 40, height: 23, borderRadius: 12, background: configList.hideClear ? "var(--accent)" : "var(--surface3)", transition: "background 0.15s" }}>
            <span style={{ position: "absolute", top: 2, left: configList.hideClear ? 19 : 2, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.18s cubic-bezier(0.4,0,0.2,1)" }} />
          </span>
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-pill" style={{ flex: 1 }} onClick={() => close()}><Icon name="back" size={15} /> Annuler</button>
          <button className="btn btn-primary btn-pill" style={{ flex: 1.4 }} disabled={!configList.name.trim()} onClick={() => close(onSave)}><Icon name={configList.isNew ? "plus" : "save"} size={15} /> {configList.isNew ? "Créer la liste" : "Enregistrer"}</button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
