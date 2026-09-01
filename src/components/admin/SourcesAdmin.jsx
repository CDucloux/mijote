import { useState, useRef } from "react";
import { Icon } from "../Icon.jsx";
import { uploadImage, deleteImageByUrl } from "@/lib/firebase/storage.js";
import {
  SOURCE_TINTS, tintOf, monogramOf, prettyHost, normalizeSource, sanitizeSources,
} from "@/lib/sources/recommendedSources.js";
import "../../styles/import.css";

// ─── CONSOLE ADMIN : SOURCES RECOMMANDÉES ────────────────────────────────────
// CRUD de la collection `master/sources` : créatrices et créateurs mis en avant
// sur la page d'import « depuis un lien ». Logo uploadé (repli monogramme teinté),
// catégorie courte, badge « import net » et ordre d'affichage. Écriture admin.

/** Brouillon vierge d'une nouvelle source. */
const BLANK = { id: "", name: "", url: "", category: "", image: "", tint: "accent", mono: "", net: false, enabled: true };

/** Pastille d'aperçu (logo si présent, sinon monogramme teinté). */
function Avatar({ source, size = 42 }) {
  const tint = tintOf(source.tint);
  return (
    <span className="imp-mono" style={{ width: size, height: size, background: `rgba(${tint.rgb},0.16)`, color: tint.color, fontSize: size * 0.42 }}>
      {source.image ? <img src={source.image} alt="" /> : monogramOf(source)}
    </span>
  );
}

export function SourcesAdmin({ sources = [], setSources, isAdmin }) {
  const [editing, setEditing] = useState(null); // null = liste ; objet = édition
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const list = sanitizeSources(sources);

  // Réécrit la liste complète en réattribuant `order` = position (contigu et stable).
  const commit = (next) => setSources?.(() => next.map((s, i) => ({ ...s, order: i })));

  const move = (id, dir) => {
    const idx = list.findIndex(s => s.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  };
  const toggleEnabled = (id) => commit(list.map(s => s.id === id ? { ...s, enabled: s.enabled === false } : s));

  const pickLogo = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true); setFormError("");
    try {
      const url = await uploadImage(file, "master/sources");
      setEditing(e => { if (e.image) deleteImageByUrl(e.image); return { ...e, image: url }; });
    } catch { setFormError("L'upload du logo a échoué. Réessaie."); }
    finally { setUploading(false); }
  };
  const removeLogo = () => setEditing(e => { if (e?.image) deleteImageByUrl(e.image); return { ...e, image: "" }; });

  const save = () => {
    const draft = { ...editing, id: editing.id || `src_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
    const clean = normalizeSource(draft);
    if (!clean) { setFormError("Un nom et une URL complète (https://…) sont requis."); return; }
    // On conserve enabled explicitement (normalizeSource ne le pose que s'il vaut false).
    if (editing.enabled === false) clean.enabled = false;
    const exists = list.some(s => s.id === clean.id);
    const next = exists ? list.map(s => s.id === clean.id ? clean : s) : [...list, clean];
    commit(next);
    setEditing(null); setFormError("");
  };
  const remove = () => {
    if (editing?.image) deleteImageByUrl(editing.image);
    commit(list.filter(s => s.id !== editing.id));
    setEditing(null);
  };

  // ── Éditeur ──
  if (editing) {
    const disabled = editing.enabled === false;
    return (
      <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar source={editing} size={48} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>{editing.id ? "Modifier la source" : "Nouvelle source"}</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>Affichée sur l'import « depuis un lien ».</div>
          </div>
        </div>

        <Field label="Nom">
          <input className="field-input" value={editing.name} maxLength={80}
            onChange={e => setEditing({ ...editing, name: e.target.value })}
            placeholder="C'est ma fournée" style={inputStyle} />
        </Field>
        <Field label="Lien du site">
          <input className="field-input" value={editing.url} type="url" inputMode="url"
            onChange={e => setEditing({ ...editing, url: e.target.value })}
            placeholder="https://exemple.com" style={inputStyle} />
        </Field>
        <Field label="Spécialité" hint="Un mot ou deux (ex. Pâtisserie, Grèce, Végétal).">
          <input className="field-input" value={editing.category} maxLength={40}
            onChange={e => setEditing({ ...editing, category: e.target.value })}
            placeholder="Pâtisserie" style={inputStyle} />
        </Field>

        <Field label="Logo" hint="Optionnel. À défaut, un monogramme teinté sert d'icône.">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar source={editing} size={52} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-pill" style={pillBtn} disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Icon name="photo" size={14} /> {uploading ? "Envoi…" : editing.image ? "Remplacer" : "Ajouter un logo"}
              </button>
              {editing.image && (
                <button className="btn btn-pill" style={pillBtn} onClick={removeLogo}>
                  <Icon name="close" size={14} /> Retirer
                </button>
              )}
            </div>
          </div>
        </Field>

        <Field label="Teinte du monogramme" hint="Utilisée quand il n'y a pas de logo.">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {SOURCE_TINTS.map(t => {
              const on = (editing.tint || "accent") === t.key;
              return (
                <button key={t.key} aria-label={t.key} onClick={() => setEditing({ ...editing, tint: t.key })}
                  style={{ width: 34, height: 34, borderRadius: 10, cursor: "pointer", background: `rgba(${t.rgb},0.18)`, color: t.color,
                    border: `2px solid ${on ? t.color : "transparent"}`, display: "grid", placeItems: "center", fontFamily: "var(--ff-display)", fontWeight: 700 }}>
                  {monogramOf(editing) || "A"}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Monogramme" hint="1 à 2 caractères. Vide = déduit du nom.">
          <input className="field-input" value={editing.mono} maxLength={2}
            onChange={e => setEditing({ ...editing, mono: e.target.value })}
            placeholder={monogramOf({ name: editing.name })} style={{ ...inputStyle, width: 96, textAlign: "center" }} />
        </Field>

        <Toggle label="Import net" hint="Extraction habituellement très propre sur cette source." checked={!!editing.net}
          onChange={v => setEditing({ ...editing, net: v })} />
        <Toggle label="Affichée" hint="Décoche pour masquer sans supprimer." checked={!disabled}
          onChange={v => setEditing({ ...editing, enabled: v })} />

        {formError && <div style={{ fontSize: 12.5, color: "var(--red)", fontWeight: 600 }}>{formError}</div>}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
          <button className="btn btn-primary btn-pill" style={{ flex: 1 }} disabled={!isAdmin || uploading} onClick={save}>
            <Icon name="check" size={15} /> Enregistrer
          </button>
          <button className="btn btn-pill" style={pillBtn} onClick={() => { setEditing(null); setFormError(""); }}>Annuler</button>
          {editing.id && (
            <button className="btn btn-pill" style={{ ...pillBtn, color: "var(--red)", borderColor: "rgba(224,82,82,0.4)" }} onClick={remove}>
              <Icon name="trash" size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Liste ──
  return (
    <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, maxWidth: "46ch" }}>
          Les sources recommandées apparaissent sur l'import « depuis un lien ». Des créatrices et créateurs aux recettes soignées, dont les pages s'importent proprement.
        </p>
        {isAdmin && (
          <button className="btn btn-primary btn-pill btn-sm" style={{ flexShrink: 0, padding: "6px 12px", fontSize: 12 }} onClick={() => setEditing({ ...BLANK })}>
            <Icon name="plus" size={13} /> Ajouter
          </button>
        )}
      </div>

      {list.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "24px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 14 }}>
          Aucune source configurée. Le jeu par défaut s'affiche en attendant.
        </div>
      )}

      {list.map((s, i) => {
        const off = s.enabled === false;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, opacity: off ? 0.55 : 1 }}>
            <Avatar source={s} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                {s.net && <span className="imp-net" style={{ flexShrink: 0 }}><Icon name="check" size={11} color="currentColor" />net</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
                {s.category && <span className="imp-tag">{s.category}</span>}
                <span style={{ fontSize: 11.5, color: "var(--text3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{prettyHost(s.url)}</span>
              </div>
            </div>
            {isAdmin && (
              <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <IconBtn name="updown" title={off ? "Réafficher" : "Masquer"} onClick={() => toggleEnabled(s.id)} active={!off} />
                <IconBtn name="forward" title="Monter" rotate={-90} disabled={i === 0} onClick={() => move(s.id, -1)} />
                <IconBtn name="forward" title="Descendre" rotate={90} disabled={i === list.length - 1} onClick={() => move(s.id, 1)} />
                <IconBtn name="edit" title="Modifier" onClick={() => setEditing({ ...BLANK, ...s })} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const inputStyle = { background: "var(--surface)", padding: "11px 14px", borderRadius: 12, width: "100%" };
const pillBtn = { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)", padding: "9px 14px", fontSize: 13 };

/** Libellé + aide au-dessus d'un champ. */
function Field({ label, hint, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text2)" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

/** Interrupteur pilulé (import net / affichée). */
function Toggle({ label, hint, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.4, marginTop: 1 }}>{hint}</div>}
      </div>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", padding: 3,
          background: checked ? "var(--accent)" : "var(--surface3)", transition: "background 0.2s" }}>
        <span style={{ display: "block", width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "transform 0.2s", transform: checked ? "translateX(18px)" : "none" }} />
      </button>
    </div>
  );
}

/** Petit bouton d'action icône (réordo / masquer / éditer). */
function IconBtn({ name, title, onClick, disabled, rotate = 0, active }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "none", cursor: disabled ? "default" : "pointer",
        display: "grid", placeItems: "center", color: active ? "var(--accent)" : "var(--text3)", opacity: disabled ? 0.35 : 1 }}>
      <span style={{ display: "grid", transform: rotate ? `rotate(${rotate}deg)` : "none" }}>
        <Icon name={name} size={15} color="currentColor" />
      </span>
    </button>
  );
}
