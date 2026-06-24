import { useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { IngImage } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { ShoppingItemRow } from "../components/ShoppingItemRow.jsx";
import { findIngredientMatch } from "../lib/nameMatcher.js";
import { parseIngredientInput } from "../lib/parseIngredient.js";
import { DEFAULT_CATEGORIES, sortedCategoryEntries, STOCK_CATEGORIES } from "../constants/categories.js";
import { useAppShell } from "../context/AppShellContext.jsx";

// Bornes pour limiter les écritures Firestore.
const MAX_LIST_ITEMS = 50;                   // nb max d'articles ajoutés en une fois (collage)
const MAX_ITEM_CHARS = 200;                  // longueur max du nom d'un article (saisie unique)
const MAX_LIST_CHARS = MAX_LIST_ITEMS * 50;  // ≈ 50 articles de ~50 caractères en moyenne

// Ligne d'article de course. Gère le swipe-droite mobile (= « j'achète ») et
// l'animation de passage dans « Acheté » (l'article glisse vers le bas en
// s'estompant avant de rejoindre la section).

export function ShoppingTab({ shoppingLists, setShoppingLists, ingredientDB, directory = [], categories = DEFAULT_CATEGORIES, stock = [], setStock, lowStock = [], setLowStock }) {
  const { user, notify } = useAppShell();
  const [activeListId, setActiveListId] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmClearId, setConfirmClearId] = useState(null);
  const [editItem, setEditItem] = useState(null);      // article en cours d'édition
  const [pending, setPending] = useState(() => new Set()); // articles en cours d'animation → « Acheté »
  const [listMode, setListMode] = useState(false);     // false = article par article ; true = coller une liste
  const [pasteText, setPasteText] = useState("");       // contenu de la zone de collage
  const [configList, setConfigList] = useState(null);  // brouillon d'édition des réglages de liste
  const [shareEmail, setShareEmail] = useState("");    // saisie e-mail dans la section partage
  const [showAllSuggestions, setShowAllSuggestions] = useState(false); // déplier toutes les suggestions de partage
  const [showAddModal, setShowAddModal] = useState(false);

  const activeList = shoppingLists.find(l => l.id === activeListId) || shoppingLists[0] || null;

  const updateList = (id, fn) => setShoppingLists(prev => prev.map(l => l.id === id ? fn(l) : l));
  const deleteList = id => {
    setShoppingLists(prev => prev.filter(l => l.id !== id));
    if (activeListId === id) setActiveListId(null);
  };
  const toggleItem = (listId, itemId) => updateList(listId, l => ({ ...l, items: l.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i) }));
  // Confirme l'achat : les articles cochés non-périssables (placard) rejoignent le
  // stock, puis la liste est purgée de tout ce qui est coché.
  const clearChecked = listId => {
    const list = shoppingLists.find(l => l.id === listId);
    if (list && setStock) {
      const toStock = (list.items || [])
        .filter(i => i.checked)
        .map(i => findIngredientMatch(i.name, ingredientDB))
        .filter(m => m && STOCK_CATEGORIES.has(m.category))
        .map(m => m.id);
      if (toStock.length) {
        setStock(prev => Array.from(new Set([...prev, ...toStock])));
        // Un réachat remet les articles à "en stock" (retire du lowStock).
        if (setLowStock) setLowStock(prev => prev.filter(id => !toStock.includes(id)));
      }
    }
    updateList(listId, l => ({ ...l, items: l.items.filter(i => !i.checked) }));
  };

  const addManualItem = () => {
    if (!newItemName.trim() || !activeList) return;
    const parsed = parseIngredientInput(newItemName);
    const name = (parsed.name || newItemName.trim()).slice(0, MAX_ITEM_CHARS);
    const dbMatch = findIngredientMatch(name, ingredientDB);
    const item = { id: "si" + Date.now(), name, amount: parsed.amount || "", unit: parsed.unit || "", image: dbMatch?.image || "", checked: false };
    updateList(activeList.id, l => ({ ...l, items: [...l.items, item] }));
    setNewItemName(""); setNewItemAmount(""); setNewItemUnit("");
  };

  // Catégorie d'un article : résolue depuis la Master DB via le nom (sinon "other").
  const catOf = name => (findIngredientMatch(name, ingredientDB)?.category) || "other";
  const updateItem = (listId, itemId, patch) =>
    updateList(listId, l => ({ ...l, items: l.items.map(i => i.id === itemId ? { ...i, ...patch } : i) }));
  const deleteItem = (listId, itemId) =>
    updateList(listId, l => ({ ...l, items: l.items.filter(i => i.id !== itemId) }));

  // Collage d'une liste : une ligne = un article, tiret/puce/numéro de tête ignorés.
  const stripBullet = s => s.replace(/^\s*[-*\u2022\u00b7\u2013\u2014]+\s*/, "").replace(/^\s*\d+[.)]\s*/, "").trim();
  const addManyFromText = text => {
    if (!activeList) return;
    const lines = text.split(/\r?\n/).map(stripBullet).filter(Boolean).slice(0, MAX_LIST_ITEMS);
    if (!lines.length) return;
    const items = lines.map((line, idx) => {
      const p = parseIngredientInput(line);
      const name = (p.name || line).slice(0, MAX_ITEM_CHARS);
      const m = findIngredientMatch(name, ingredientDB);
      return { id: "si" + Date.now() + "_" + idx, name, amount: p.amount || "", unit: p.unit || "", image: m?.image || "", checked: false };
    });
    updateList(activeList.id, l => ({ ...l, items: [...l.items, ...items] }));
    setNewItemName("");
  };

  // En-tête de groupe (catégorie ou « Acheté »).
  const groupHeader = (label, icon, count) => (
    <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "14px 2px 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      <span>{label}</span>
      {count != null && <span style={{ fontSize: 10, background: "var(--surface3)", borderRadius: 10, padding: "1px 7px", color: "var(--text2)" }}>{count}</span>}
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );

  // Achat d'un article : barre sur place + glisse vers le bas, puis bascule dans « Acheté ».
  // Décocher un article déjà acheté est immédiat.
  const buyItem = item => {
    if (!activeList) return;
    if (item.checked) { toggleItem(activeList.id, item.id); return; }
    if (pending.has(item.id)) return;
    setPending(prev => { const n = new Set(prev); n.add(item.id); return n; });
    setTimeout(() => {
      toggleItem(activeList.id, item.id);
      setPending(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }, 300);
  };

  // Ligne d'article : zone principale = achat ; swipe droite mobile = achat ; modifier / supprimer à droite.
  const renderItem = item => (
    <ShoppingItemRow key={item.id} item={item} striking={pending.has(item.id)}
      imageSrc={item.image || findIngredientMatch(item.name, ingredientDB)?.image || ""}
      onBuy={buyItem} onEdit={setEditItem} onDelete={it => deleteItem(activeList.id, it.id)} />
  );


  const checked = activeList ? activeList.items.filter(i => i.checked).length : 0;
  const total = activeList ? activeList.items.length : 0;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Courses</h1>
            <span className="app-brand" style={{ fontSize: 11, fontWeight: 500, color: "var(--text3)", letterSpacing: "0.04em", fontFamily: "var(--ff-body)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span> <span style={{ opacity: 0.5 }}>{`v${__APP_VERSION__}`}</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-primary" style={{ padding: "8px 14px", borderRadius: 12 }} onClick={() => { setConfigList({ isNew: true, name: "", type: "free", hideClear: false, sharedWith: [] }); setShareEmail(""); }}><Icon name="plus" size={16} /> Nouvelle liste</button>
            <UserAvatar />
          </div>
        </div>

        {/* List selector tabs */}
        {shoppingLists.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
            {shoppingLists.map((l, idx) => {
              const isActive = (activeListId === l.id) || (!activeListId && shoppingLists[0] === l);
              const lChecked = l.items.filter(i => i.checked).length;
              return (
                <button key={l.id} onClick={() => setActiveListId(l.id)} className="slide-up"
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: isActive ? "var(--accent)" : "var(--surface2)", animationDelay: `${idx * 0.05}s`,
                    color: isActive ? "#fff" : "var(--text2)",
                    border: `1px solid ${isActive ? "transparent" : "var(--border)"}`
                  }}>
                  <Icon name={l.type === "recipe" ? "book" : "shopping"} size={12} color={isActive ? "#fff" : "var(--text3)"} />
                  {l._shared && <Icon name="share" size={11} color={isActive ? "#fff" : "var(--text3)"} />}
                  {l.name}
                  {l.items.length > 0 && (
                    <span style={{ fontSize: 10, background: isActive ? "rgba(255,255,255,0.25)" : "var(--surface3)", borderRadius: 10, padding: "1px 6px" }}>
                      {lChecked}/{l.items.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty state */}
      {shoppingLists.length === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text3)", gap: 12, padding: "0 40px", textAlign: "center" }}>
          <Icon name="shopping" size={44} />
          <p style={{ fontSize: 15, fontWeight: 500 }}>Aucune liste de courses</p>
          <p style={{ fontSize: 13 }}>Crée une liste libre ou ajoute une recette depuis sa fiche.</p>
        </div>
      )}

      {/* Active list content */}
      {activeList && (
        <div key={activeList.id} className="slide-up" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {/* List header */}
          <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{activeList.name}</span>
              {activeList.type === "recipe" && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text3)" }}>Recette</span>}
              {activeList._shared && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Icon name="share" size={11} color="var(--text3)" />
                  {(activeList.ownerEmail || "").toLowerCase() === (user?.email || "").toLowerCase()
                    ? `Partagée · ${(activeList.sharedWith || []).length} invité(s)`
                    : `Partagée par ${activeList.ownerEmail}`}
                </span>
              )}
              {total > 0 && (
                <div style={{ height: 3, background: "var(--surface2)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--green)", borderRadius: 2, width: `${(checked / total) * 100}%`, transition: "width 0.3s" }} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-sm" title="Configurer la liste" onClick={() => { setConfigList({ ...activeList, sharedWith: activeList.sharedWith || [] }); setShareEmail(""); }}><Icon name="settings" size={14} /></button>
              <button className="btn btn-danger btn-sm" onClick={() => activeList.type === "free" ? setConfirmDeleteId(activeList.id) : deleteList(activeList.id)}><Icon name="trash" size={13} /></button>
            </div>
          </div>

          {/* FAB — absolute inside the list container */}
          {activeList.type === "free" && (
            <button onClick={() => { setShowAddModal(true); setListMode(false); setNewItemName(""); setPasteText(""); }}
              style={{ position: "absolute", bottom: 16, right: 16, width: 52, height: 52, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(232,112,58,0.45)", zIndex: 50, border: "none", cursor: "pointer" }}>
              <Icon name="plus" size={22} color="#fff" />
            </button>
          )}

          {/* Liste — pleine largeur, défilante */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 80px" }}>

            {activeList.items.length === 0 && activeList.type !== "free" && (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "20px 0", fontSize: 13 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="shopping" size={14} color="var(--text3)" /> Aucun article dans cette liste.</span>
              </div>
            )}

            {activeList.items.length === 0 && activeList.type === "free" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "60px 32px", textAlign: "center" }}>
                <Icon name="shopping" size={48} color="var(--text3)" />
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text2)" }}>Liste vide</div>
                <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5, maxWidth: 240 }}>
                  Appuie sur le bouton <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", verticalAlign: "middle" }}><Icon name="plus" size={11} color="#fff" /></span> en bas à droite pour ajouter des articles.
                </div>
              </div>
            )}

            {/* Tri par défaut : groupé par catégorie, alphabétique dans chaque groupe ; « Acheté » en bas */}
            {(() => {
              const items = activeList.items;
              const todo = items.filter(i => !i.checked);
              const done = items.filter(i => i.checked);
              const byName = (a, b) => a.name.localeCompare(b.name, "fr");
              const groups = {};
              for (const it of todo) { const c = catOf(it.name); (groups[c] = groups[c] || []).push(it); }
              const sections = sortedCategoryEntries(categories)
                .filter(([k]) => groups[k] && groups[k].length)
                .map(([k, c]) => ({ key: k, label: c.label, icon: c.icon, items: groups[k].slice().sort(byName) }));
              return (
                <>
                  {sections.map(sec => (
                    <div key={sec.key}>
                      {groupHeader(sec.label, sec.icon, sec.items.length)}
                      {sec.items.map(renderItem)}
                    </div>
                  ))}
                  {done.length > 0 && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "14px 2px 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>
                        <span style={{ fontSize: 13 }}>✓</span>
                        <span>Acheté</span>
                        <span style={{ fontSize: 10, background: "var(--surface3)", borderRadius: 10, padding: "1px 7px", color: "var(--text2)" }}>{done.length}</span>
                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        {!activeList.hideClear && (
                          <button className="btn btn-sm" style={{ padding: "4px 12px", fontSize: 11, flexShrink: 0, background: "rgba(76,175,125,0.14)", color: "var(--green)", border: "1px solid rgba(76,175,125,0.3)" }} onClick={() => setConfirmClearId(activeList.id)} title="Confirme l'achat — les produits de placard rejoignent ton stock">
                            <Icon name="shopping" size={12} color="var(--green)" /> Valider l'achat
                          </button>
                        )}
                      </div>
                      {done.slice().sort(byName).map(renderItem)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
      {/* Confirm delete modal — only for free lists */}
      {confirmDeleteId && (
        <SwipeableSheet onClose={() => setConfirmDeleteId(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Supprimer la liste ?</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            "{shoppingLists.find(l => l.id === confirmDeleteId)?.name}" sera supprimée définitivement avec tous ses articles.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDeleteId(null)}>Annuler</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { deleteList(confirmDeleteId); setConfirmDeleteId(null); }}>Supprimer</button>
          </div>
        </SwipeableSheet>
      )}
      {/* Confirmation : valider l'achat (déversement dans le stock) */}
      {confirmClearId && (() => {
        const list = shoppingLists.find(l => l.id === confirmClearId);
        const checked = (list?.items || []).filter(i => i.checked);
        const toStock = checked
          .map(i => findIngredientMatch(i.name, ingredientDB))
          .filter(m => m && STOCK_CATEGORIES.has(m.category));
        return (
          <SwipeableSheet onClose={() => setConfirmClearId(null)}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(76,175,125,0.14)", border: "1px solid rgba(76,175,125,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="shopping" size={20} color="var(--green)" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>Valider l'achat ?</h3>
            </div>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.55 }}>
              Les articles achetés vont être retirés de la liste.
              {toStock.length > 0
                ? <> Parmi eux, <strong>{toStock.length}</strong> produit{toStock.length > 1 ? "s" : ""} de placard rejoindront ton stock (les produits frais sont exclus).</>
                : <> Aucun produit de placard à ajouter au stock (uniquement des produits frais).</>}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmClearId(null)}>Annuler</button>
              <button className="btn btn-primary" style={{ flex: 1, background: "var(--green)", borderColor: "var(--green)" }} onClick={() => {
                clearChecked(confirmClearId);
                setConfirmClearId(null);
                // Un toast de succès par produit ajouté au stock, en cascade.
                toStock.forEach((m, idx) => setTimeout(() => notify?.(`${m.name} ajouté à ton stock`), idx * 900));
              }}>
                <Icon name="check" size={15} color="#fff" /> Valider
              </button>
            </div>
          </SwipeableSheet>
        );
      })()}
      {/* Édition d'un article */}
      {editItem && activeList && (
        <SwipeableSheet onClose={() => setEditItem(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Modifier l'article</h3>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Nom</div>
          <input className="field-input" value={editItem.name} onChange={e => setEditItem(p => ({ ...p, name: e.target.value }))} autoFocus style={{ marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Quantité</div>
              <input className="field-input" value={editItem.amount} onChange={e => setEditItem(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Unité</div>
              <input className="field-input" value={editItem.unit} onChange={e => setEditItem(p => ({ ...p, unit: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditItem(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
              const name = (editItem.name || "").trim();
              if (!name) return;
              const m = findIngredientMatch(name, ingredientDB);
              updateItem(activeList.id, editItem.id, { name, amount: editItem.amount, unit: editItem.unit, image: m?.image || editItem.image || "" });
              setEditItem(null);
            }}>Enregistrer</button>
          </div>
        </SwipeableSheet>
      )}
      {/* Modal ajout d'article / liste */}
      {showAddModal && activeList?.type === "free" && (
        <SwipeableSheet onClose={() => { setShowAddModal(false); setListMode(false); setNewItemName(""); setPasteText(""); }}>
          {/* En-tête avec icône presse-papiers */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,rgba(232,112,58,0.18),rgba(232,112,58,0.06))", border: "1px solid rgba(232,112,58,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <line x1="9" y1="12" x2="15" y2="12" />
                <line x1="9" y1="16" x2="13" y2="16" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 1 }}>{listMode ? "Coller une liste" : "Ajouter un article"}</h3>
              <p style={{ fontSize: 12, color: "var(--text3)" }}>{activeList.name}</p>
            </div>
          </div>

          {/* Toggle article / liste */}
          <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 10, padding: 3, marginBottom: 16, gap: 3 }}>
            {[{ label: "Article", val: false }, { label: "Coller une liste", val: true }].map(({ label, val }) => (
              <button key={label} onClick={() => setListMode(val)}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: listMode === val ? "var(--surface)" : "transparent", color: listMode === val ? "var(--accent)" : "var(--text3)", boxShadow: listMode === val ? "0 1px 4px rgba(0,0,0,0.12)" : "none", transition: "all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>

          {listMode ? (() => {
            const count = pasteText.split(/\r?\n/).map(stripBullet).filter(Boolean).length;
            const over = count > MAX_LIST_ITEMS;
            return (
              <>
                <textarea className="field-input" value={pasteText} maxLength={MAX_LIST_CHARS}
                  onChange={e => setPasteText(e.target.value.slice(0, MAX_LIST_CHARS))}
                  placeholder={"Un article par ligne :\n500g farine\n2 oeufs\n1 sachet de levure"}
                  style={{ minHeight: 140, resize: "vertical", lineHeight: 1.5, fontFamily: "inherit", marginBottom: 8 }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.3 }}>Une ligne = un article (tirets, puces et numéros acceptés).</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: over ? "var(--red)" : "var(--text3)", flexShrink: 0 }}>{count}/{MAX_LIST_ITEMS}</span>
                </div>
                {over && <div style={{ fontSize: 11, color: "var(--red)", marginBottom: 8 }}>Maximum {MAX_LIST_ITEMS} articles à la fois — retire {count - MAX_LIST_ITEMS} ligne(s).</div>}
                <button className="btn btn-primary" style={{ width: "100%" }} disabled={count === 0 || over}
                  onClick={() => { addManyFromText(pasteText); setPasteText(""); setShowAddModal(false); setListMode(false); }}>
                  <Icon name="plus" size={15} /> Ajouter {count > 0 ? `${count} article${count > 1 ? "s" : ""}` : "la liste"}
                </button>
              </>
            );
          })() : (
            <>
              <input className="field-input" placeholder="ex: 500g farine, 2 oeufs…" maxLength={MAX_ITEM_CHARS}
                value={newItemName} onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { addManualItem(); setShowAddModal(false); } }}
                onPaste={e => {
                  const t = (e.clipboardData || window.clipboardData)?.getData("text") || "";
                  if (/\r?\n/.test(t)) { e.preventDefault(); setPasteText(p => (p ? p + "\n" : "") + t); setListMode(true); }
                }}
                style={{ marginBottom: 10 }} />
              {newItemName.trim() && (() => {
                const p = parseIngredientInput(newItemName);
                const name = p.name || newItemName.trim();
                const match = findIngredientMatch(name, ingredientDB);
                return (
                  <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                    {match?.image && <IngImage src={match.image} alt={match.name} size={34} />}
                    {p.amount && <span style={{ fontSize: 11, background: "rgba(240,192,96,0.15)", color: "var(--yellow)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Quantité : {p.amount}</span>}
                    {p.unit && <span style={{ fontSize: 11, background: "rgba(91,156,246,0.15)", color: "var(--blue)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Unité : {p.unit}</span>}
                    {p.name && <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--text2)", borderRadius: 8, padding: "2px 8px" }}>{p.name}</span>}
                    {match ? <span style={{ fontSize: 11, background: "rgba(76,175,125,0.15)", color: "var(--green)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>✓ Reconnu</span>
                      : p.name ? <span style={{ fontSize: 11, background: "rgba(224,82,82,0.12)", color: "#c04040", borderRadius: 8, padding: "2px 8px" }}>Non référencé</span> : null}
                  </div>
                );
              })()}
              <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => { addManualItem(); setShowAddModal(false); }} disabled={!newItemName.trim()}>
                <Icon name="plus" size={15} /> Ajouter
              </button>
            </>
          )}
        </SwipeableSheet>
      )}

      {/* Configuration de la liste */}
      {configList && (() => {
        const myEmail = (user?.email || "").toLowerCase();
        const isOwner = !configList._shared || (configList.ownerEmail || "").toLowerCase() === myEmail;
        const email = shareEmail.trim().toLowerCase();
        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const alreadyShared = configList.sharedWith.includes(email);
        const maxReached = configList.sharedWith.length >= 3;
        const addEmail = (e) => {
          const v = (e || email).trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || configList.sharedWith.includes(v) || v === myEmail || configList.sharedWith.length >= 3) return;
          setConfigList(p => ({ ...p, sharedWith: [...p.sharedWith, v] }));
          setShareEmail("");
        };
        // Avatars proposés : utilisateurs connus, hors moi et hors déjà-partagés.
        // On en montre 3 par défaut, le reste derrière un chip « … ».
        const allSuggestions = directory
          .map(d => ({ ...d, email: (d.email || "").toLowerCase() }))
          .filter(d => d.email && d.email !== myEmail && !configList.sharedWith.includes(d.email));
        const suggestions = showAllSuggestions ? allSuggestions : allSuggestions.slice(0, 3);
        const extraSuggestions = allSuggestions.length - suggestions.length;
        const dirByEmail = Object.fromEntries(directory.map(d => [(d.email || "").toLowerCase(), d]));
        const Avatar = ({ d, size = 28 }) => d?.photoURL
          ? <img src={d.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover" }} />
          : <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 700 }}>{((d?.displayName || d?.email || "?")[0] || "?").toUpperCase()}</span>;
        return (
          <SwipeableSheet onClose={() => setConfigList(null)}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{configList.isNew ? "Nouvelle liste" : "Configurer la liste"}</h3>

            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Nom de la liste</div>
            <input className="field-input" value={configList.name} maxLength={60} autoFocus
              onChange={e => setConfigList(p => ({ ...p, name: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && e.target.blur()} style={{ marginBottom: 18 }} />

            <button onClick={() => setConfigList(p => ({ ...p, hideClear: !p.hideClear }))}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", padding: "12px 14px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 18, cursor: "pointer", textAlign: "left" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>Cacher le bouton « Valider l'achat »</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Évite de valider les articles achetés par mégarde.</div>
              </div>
              <span style={{ position: "relative", flexShrink: 0, width: 38, height: 22, borderRadius: 12, background: configList.hideClear ? "var(--accent)" : "var(--surface3)", transition: "background 0.15s" }}>
                <span style={{ position: "absolute", top: 2, left: configList.hideClear ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
              </span>
            </button>

            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="share" size={12} color="var(--text3)" /> Partage (lecture &amp; écriture)
            </div>

            {!isOwner ? (
              <>
                <p style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.4, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar d={dirByEmail[(configList.ownerEmail || "").toLowerCase()]} /> Liste partagée par <strong>{configList.ownerEmail}</strong>. Tu peux la voir et la modifier.
                </p>
                <button className="btn btn-danger" style={{ width: "100%", marginBottom: 18 }}
                  onClick={() => { setShoppingLists(prev => prev.filter(l => l.id !== configList.id)); setConfigList(null); }}>
                  Quitter le partage
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.4, marginBottom: 10 }}>
                  Ajoute les personnes qui pourront voir et modifier cette liste.{" "}
                  <span style={{ color: maxReached ? "var(--accent)" : "inherit" }}>({configList.sharedWith.length}/3 invité{configList.sharedWith.length > 1 ? "s" : ""})</span>
                </p>
                {!maxReached && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <input className="field-input" type="email" inputMode="email" placeholder="email@exemple.com"
                      value={shareEmail} onChange={e => setShareEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addEmail()} style={{ flex: 1 }} />
                    <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => addEmail()} disabled={!emailValid || alreadyShared}>
                      <Icon name="plus" size={15} /> Ajouter
                    </button>
                  </div>
                )}

                {!maxReached && suggestions.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 6 }}>Suggestions</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {suggestions.map(d => (
                        <button key={d.email} onClick={() => addEmail(d.email)}
                          style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px 4px 4px", borderRadius: 20, background: "var(--surface2)", border: "1px solid var(--border)", cursor: "pointer", maxWidth: "100%" }}>
                          <Avatar d={d} />
                          <span style={{ fontSize: 12, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.displayName || d.email}</span>
                        </button>
                      ))}
                      {extraSuggestions > 0 && (
                        <button onClick={() => setShowAllSuggestions(true)} title={`Voir ${extraSuggestions} suggestion${extraSuggestions > 1 ? "s" : ""} de plus`}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 20, background: "var(--surface2)", border: "1px dashed var(--border)", cursor: "pointer", color: "var(--text2)", fontSize: 12, fontWeight: 600 }}>
                          +{extraSuggestions}
                        </button>
                      )}
                      {showAllSuggestions && allSuggestions.length > 3 && (
                        <button onClick={() => setShowAllSuggestions(false)} title="Réduire"
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 20, background: "var(--surface2)", border: "1px dashed var(--border)", cursor: "pointer", color: "var(--text3)", fontSize: 12, fontWeight: 600 }}>
                          −
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {configList.sharedWith.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                    {configList.sharedWith.map(e => (
                      <div key={e} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 10px" }}>
                        <Avatar d={dirByEmail[e]} />
                        <span style={{ flex: 1, fontSize: 13, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dirByEmail[e]?.displayName ? `${dirByEmail[e].displayName} · ${e}` : e}</span>
                        <button onClick={() => setConfigList(p => ({ ...p, sharedWith: p.sharedWith.filter(x => x !== e) }))}
                          style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: "transparent", border: "none", color: "var(--text3)", cursor: "pointer", transition: "background 0.15s, color 0.15s" }}
                          onMouseEnter={ev => { ev.currentTarget.style.background = "rgba(224,82,82,0.12)"; ev.currentTarget.style.color = "var(--red)"; }}
                          onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; ev.currentTarget.style.color = "var(--text3)"; }}
                          title="Retirer"><Icon name="close" size={15} color="currentColor" /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text3)", lineHeight: 1.4, background: "rgba(91,156,246,0.10)", border: "1px solid rgba(91,156,246,0.28)", borderRadius: 10, padding: "9px 12px", marginBottom: 18 }}>
                  <span style={{ flexShrink: 0 }}>☁️</span>
                  <span>Les personnes ajoutées verront la liste dès leur prochaine connexion et pourront l'éditer en temps réel.</span>
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfigList(null)}>Annuler</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={!configList.name.trim()} onClick={() => {
                const name = configList.name.trim();
                if (configList.isNew) {
                  const l = { id: "sl" + Date.now(), name, type: "free", items: [], hideClear: !!configList.hideClear, sharedWith: configList.sharedWith };
                  setShoppingLists(prev => [...prev, l]);
                  setActiveListId(l.id);
                } else {
                  updateList(configList.id, l => ({ ...l, name, hideClear: !!configList.hideClear, sharedWith: configList.sharedWith }));
                }
                setConfigList(null);
              }}>{configList.isNew ? "Créer" : "Enregistrer"}</button>
            </div>
          </SwipeableSheet>
        );
      })()}
    </div>
  );
}
