import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { IngImage } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { ConfirmDialog } from "../components/ConfirmDialog.jsx";
import { ShoppingItemRow } from "../components/ShoppingItemRow.jsx";
import { useLongPress } from "../hooks/useLongPress.js";
import { findIngredientMatch } from "@/lib/food/nameMatcher.js";
import { spawnRipple } from "@/lib/ui/ripple.js";
import { parseIngredientInput } from "@/lib/food/parseIngredient.js";
import { aggregateShopping } from "@/lib/food/shoppingAggregate.js";
import { OverscrollRow } from "../components/OverscrollRow.jsx";
import { DEFAULT_CATEGORIES, sortedCategoryEntries, STOCK_CATEGORIES } from "../constants/categories.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useElasticScroll } from "../hooks/useElasticScroll.js";

// Onglet virtuel « Toutes les courses » (agrégat de toutes les listes actives).
const ALL_ID = "__all__";

// Bornes pour limiter les écritures Firestore.
const MAX_LIST_ITEMS = 50;                   // nb max d'articles ajoutés en une fois (collage)
const MAX_ITEM_CHARS = 200;                  // longueur max du nom d'un article (saisie unique)
const MAX_LIST_CHARS = MAX_LIST_ITEMS * 50;  // ≈ 50 articles de ~50 caractères en moyenne

// Ligne d'article de course. Gère le swipe-droite mobile (= « j'achète ») et
// l'animation de passage dans « Acheté » (l'article glisse vers le bas en
// s'estompant avant de rejoindre la section).

export function ShoppingPage({ shoppingLists, setShoppingLists, ingredientDB, categories = DEFAULT_CATEGORIES, loading = false, setStock, setLowStock }) {
  const navigate = useNavigate();
  const { notify } = useAppShell();
  // Focus sans scroll : empêche la page de « sauter » à l'ouverture des bottom-sheets.
  const focusNoScroll = useCallback(el => { if (el && typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) el.focus({ preventScroll: true }); }, []);
  const [activeListId, setActiveListId] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmClearId, setConfirmClearId] = useState(null);
  const [pending, setPending] = useState(() => new Set()); // articles en cours d'animation → « Acheté »
  const [unchecking, setUnchecking] = useState(() => new Set()); // articles décochés en cours d'animation → « À acheter »
  const [listMode, setListMode] = useState(false);     // false = article par article ; true = coller une liste
  const [pasteText, setPasteText] = useState("");       // contenu de la zone de collage
  const [configList, setConfigList] = useState(null);  // brouillon d'édition des réglages de liste
  const [showAddModal, setShowAddModal] = useState(false);
  const [listMenu, setListMenu] = useState(null);      // liste dont le menu (⋯ / appui long) est ouvert
  const { startLongPress, cancelLongPress, moveLongPress, wasLongPress } = useLongPress();
  // Overscroll « stretch » horizontal de la rangée de listes (comme WhatsApp/Maps).

  // L'agrégat n'a de sens qu'à partir de 2 listes. Il devient la vue par défaut
  // (la « vraie » sortie supermarché), les onglets par recette restant accessibles.
  const hasAgg = shoppingLists.length >= 2;
  const effectiveId = activeListId ?? (hasAgg ? ALL_ID : (shoppingLists[0]?.id ?? null));
  const allMode = hasAgg && effectiveId === ALL_ID;
  const activeList = allMode ? null : (shoppingLists.find(l => l.id === effectiveId) || shoppingLists[0] || null);
  const aggregated = useMemo(() => (hasAgg ? aggregateShopping(shoppingLists, ingredientDB) : []), [hasAgg, shoppingLists, ingredientDB]);

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

  // ── Agrégat « Toutes les courses » ──
  // Cocher un article agrégé propage l'état à tous ses contributeurs (chaque
  // vraie liste), avec la même animation d'achat que les listes normales.
  const buyAggregate = (agg) => {
    const target = !agg.checked;
    const byList = new Map();
    for (const c of agg.contributors) { const s = byList.get(c.listId) || new Set(); s.add(c.itemId); byList.set(c.listId, s); }
    const apply = () => setShoppingLists(prev => prev.map(l => byList.has(l.id)
      ? { ...l, items: l.items.map(it => byList.get(l.id).has(it.id) ? { ...it, checked: target } : it) }
      : l));
    // Décocher est immédiat ; l'achat rejoue l'animation « strike + glisse » (comme
    // une liste normale), l'article étant identifié par sa clé d'agrégat.
    if (!target) {
      if (unchecking.has(agg.key)) return;
      setUnchecking(prev => { const n = new Set(prev); n.add(agg.key); return n; });
      setTimeout(() => {
        apply();
        setUnchecking(prev => { const n = new Set(prev); n.delete(agg.key); return n; });
      }, 330);
      return;
    }
    if (pending.has(agg.key)) return;
    setPending(prev => { const n = new Set(prev); n.add(agg.key); return n; });
    setTimeout(() => {
      apply();
      setPending(prev => { const n = new Set(prev); n.delete(agg.key); return n; });
    }, 560);
  };
  // Valider l'achat sur l'agrégat : déverse les produits de placard cochés (toutes
  // listes) dans le stock, puis purge les articles cochés partout.
  const clearAllChecked = () => {
    if (setStock) {
      const toStock = shoppingLists
        .flatMap(l => (l.items || []).filter(i => i.checked))
        .map(i => findIngredientMatch(i.name, ingredientDB))
        .filter(m => m && STOCK_CATEGORIES.has(m.category))
        .map(m => m.id);
      if (toStock.length) {
        setStock(prev => Array.from(new Set([...prev, ...toStock])));
        if (setLowStock) setLowStock(prev => prev.filter(id => !toStock.includes(id)));
      }
    }
    setShoppingLists(prev => prev.map(l => ({ ...l, items: l.items.filter(i => !i.checked) })));
  };

  const addManualItem = () => {
    if (!newItemName.trim() || !activeList) return;
    const parsed = parseIngredientInput(newItemName);
    const name = (parsed.name || newItemName.trim()).slice(0, MAX_ITEM_CHARS);
    const dbMatch = findIngredientMatch(name, ingredientDB);
    const item = { id: "si" + Date.now(), name, amount: parsed.amount || "", unit: parsed.unit || "", image: dbMatch?.image || "", checked: false };
    updateList(activeList.id, l => ({ ...l, items: [...l.items, item] }));
    setNewItemName("");
  };

  // Catégorie d'un article : résolue depuis la Master DB via le nom (sinon "other").
  const catOf = name => (findIngredientMatch(name, ingredientDB)?.category) || "other";
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
    if (item.checked) {
      if (unchecking.has(item.id)) return;
      setUnchecking(prev => { const n = new Set(prev); n.add(item.id); return n; });
      setTimeout(() => {
        toggleItem(activeList.id, item.id);
        setUnchecking(prev => { const n = new Set(prev); n.delete(item.id); return n; });
      }, 330);
      return;
    }
    if (pending.has(item.id)) return;
    setPending(prev => { const n = new Set(prev); n.add(item.id); return n; });
    setTimeout(() => {
      toggleItem(activeList.id, item.id);
      setPending(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }, 560);
  };

  // Ligne d'article : zone principale = achat ; swipe droite = achat, swipe gauche = supprime
  // (mobile) ; sur desktop la suppression passe par le bouton corbeille.
  const renderItem = item => (
    <ShoppingItemRow key={item.id} item={item} striking={pending.has(item.id)} unstriking={unchecking.has(item.id)}
      imageSrc={item.image || findIngredientMatch(item.name, ingredientDB)?.image || ""}
      onBuy={buyItem} onDelete={it => deleteItem(activeList.id, it.id)} />
  );

  const { scrollRef: aggScrollRef, contentRef: aggContentRef } = useElasticScroll();   // vue « Toutes les courses »
  const { scrollRef: listScrollRef, contentRef: listContentRef } = useElasticScroll(); // vue d'une liste

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0, position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Courses</h1>
            
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-primary btn-pill" onClick={() => setConfigList({ isNew: true, name: "", type: "free", hideClear: false })}><Icon name="plus" size={16} /> Nouvelle liste</button>
            <UserAvatar />
          </div>
        </div>

        {/* List selector tabs + menu ⋯ */}
        {shoppingLists.length > 0 && (
          <OverscrollRow stretch max={64} outerStyle={{ paddingBottom: 8 }} style={{ gap: 6, alignItems: "center" }}>
            {/* Onglet agrégé « Toutes les courses » (≥ 2 listes) */}
            {hasAgg && (() => {
              const aggChecked = aggregated.filter(a => a.checked).length;
              return (
                <button onClick={() => setActiveListId(ALL_ID)} className="slide-up"
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 6, height: 34, boxSizing: "border-box", padding: "0 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: allMode ? "var(--accent)" : "var(--surface)",
                    color: allMode ? "#fff" : "var(--accent)",
                    border: `1px solid ${allMode ? "transparent" : "rgba(232,112,58,0.5)"}`
                  }}>
                  <Icon name="grid" size={12} color={allMode ? "#fff" : "var(--accent)"} />
                  Toutes les courses
                  {aggregated.length > 0 && (
                    <span style={{ fontSize: 10, background: allMode ? "rgba(255,255,255,0.25)" : "rgba(232,112,58,0.14)", borderRadius: 10, padding: "1px 6px" }}>
                      {aggChecked}/{aggregated.length}
                    </span>
                  )}
                </button>
              );
            })()}
            {shoppingLists.map((l, idx) => {
              const isActive = !allMode && effectiveId === l.id;
              const lChecked = l.items.filter(i => i.checked).length;
              return (
                <div key={l.id} role="button" tabIndex={0} className="slide-up"
                  onClick={() => { if (wasLongPress()) return; setActiveListId(l.id); }}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveListId(l.id); } }}
                  onPointerDown={e => startLongPress(e, () => setListMenu(l))} onPointerMove={moveLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
                  onContextMenu={e => { e.preventDefault(); setListMenu(l); }}
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 6, height: 34, boxSizing: "border-box", padding: isActive ? "0 6px 0 12px" : "0 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", userSelect: "none",
                    background: isActive ? "var(--accent)" : "var(--surface)", animationDelay: `${idx * 0.05}s`,
                    color: isActive ? "#fff" : "var(--text2)",
                    border: `1px solid ${isActive ? "transparent" : "var(--border)"}`
                  }}>
                  <Icon name={l.type === "recipe" ? "book" : "shopping"} size={12} color={isActive ? "#fff" : "var(--text3)"} />
                  {l.name}
                  {l.items.length > 0 && (
                    <span style={{ fontSize: 10, background: isActive ? "rgba(255,255,255,0.25)" : "var(--surface3)", borderRadius: 10, padding: "1px 6px" }}>
                      {lChecked}/{l.items.length}
                    </span>
                  )}
                  {/* Options : uniquement sur la liste active. La hauteur fixe de la
                      pastille empêche le bouton (22px) de la faire grandir. */}
                  {isActive && (
                    <button onClick={e => { e.stopPropagation(); setListMenu(l); }} aria-label="Options de la liste"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: "none", background: "rgba(255,255,255,0.22)", cursor: "pointer", padding: 0 }}>
                      <Icon name="ellipsis" size={14} color="#fff" />
                    </button>
                  )}
                </div>
              );
            })}
          </OverscrollRow>
        )}
      </div>

      {/* Hydratation des données partagées : squelette plutôt que l'empty state,
          qui flasherait avant l'arrivée des listes (bootstrap / cache temps réel). */}
      {shoppingLists.length === 0 && loading && (
        <div style={{ flex: 1, padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="skeleton" style={{ height: 48, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 72, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 72, borderRadius: 16 }} />
        </div>
      )}

      {/* Empty state (première visite) — même base que « Aucune recette trouvée » */}
      {shoppingLists.length === 0 && !loading && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px", maxWidth: 380, margin: "0 auto" }}>
          <div style={{ width: 76, height: 76, borderRadius: 22, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: "0 8px 24px -16px rgba(0,0,0,0.35)" }}>
            <Icon name="shopping" size={30} color="var(--accent)" />
          </div>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 7 }}>Aucune liste de courses</h3>
          <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 22 }}>
            Crée une liste libre pour noter tes achats,<br />ou envoie une recette aux courses depuis sa fiche.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={() => setConfigList({ isNew: true, name: "", type: "free", hideClear: false })}>
              <Icon name="plus" size={16} color="#fff" /> Créer une liste
            </button>
            <button className="btn btn-pill" style={{ fontSize: 14, background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", transition: "border-color 0.15s ease" }} onClick={() => navigate("/recipes")}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--text3)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
              <Icon name="book" size={16} color="currentColor" /> Partir d'une recette
            </button>
          </div>
        </div>
      )}

      {/* Vue agrégée « Toutes les courses » */}
      {allMode && (
        <div key="__all__" className="slide-up" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div ref={aggScrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 20px 32px" }}>
            <div ref={aggContentRef} style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
            {aggregated.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, textAlign: "center" }}>
                <Icon name="grid" size={48} color="var(--text3)" />
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text2)" }}>Rien à acheter</div>
                <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5, maxWidth: 260 }}>
                  Tes listes sont vides. Ajoute des articles ou envoie une recette aux courses, et tout se regroupe ici.
                </div>
              </div>
            ) : (() => {
              const byName = (a, b) => a.name.localeCompare(b.name, "fr");
              const todo = aggregated.filter(a => !a.checked);
              const done = aggregated.filter(a => a.checked);
              const groups = {};
              for (const a of todo) { (groups[a.category] = groups[a.category] || []).push(a); }
              const sections = sortedCategoryEntries(categories)
                .filter(([k]) => groups[k] && groups[k].length)
                .map(([k, c]) => ({ key: k, label: c.label, icon: c.icon, items: groups[k].slice().sort(byName) }));
              const renderAgg = (agg) => (
                <ShoppingItemRow key={agg.key} disableDelete striking={pending.has(agg.key)} unstriking={unchecking.has(agg.key)}
                  item={{ id: agg.key, name: agg.name, amount: agg.qtyDisplay, unit: "", checked: agg.checked }}
                  imageSrc={agg.image} onBuy={() => buyAggregate(agg)} onDelete={() => {}}
                  subtitle={agg.sources.length ? `Pour ${agg.sources.join(" + ")}${agg.partial ? " · en partie acheté" : ""}` : (agg.partial ? "En partie acheté" : undefined)} />
              );
              return (
                <>
                  {sections.map(sec => (
                    <div key={sec.key}>
                      {groupHeader(sec.label, sec.icon, sec.items.length)}
                      {sec.items.map(renderAgg)}
                    </div>
                  ))}
                  {done.length > 0 && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "14px 2px 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>
                        <span style={{ fontSize: 13 }}>✓</span>
                        <span>Acheté</span>
                        <span style={{ fontSize: 10, background: "var(--surface3)", borderRadius: 10, padding: "1px 7px", color: "var(--text2)" }}>{done.length}</span>
                        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "6px 14px", fontSize: 11.5, fontWeight: 600, borderRadius: 999, background: "rgba(76,175,125,0.14)", color: "var(--green)", border: "1px solid rgba(76,175,125,0.35)", cursor: "pointer" }} onClick={() => setConfirmClearId(ALL_ID)} title="Confirme l'achat sur toutes les listes – les produits de placard rejoignent ton stock">
                          <Icon name="shopping" size={12} color="var(--green)" /> Valider l'achat
                        </button>
                      </div>
                      {done.slice().sort(byName).map(renderAgg)}
                    </div>
                  )}
                </>
              );
            })()}
            </div>
          </div>
        </div>
      )}

      {/* Active list content */}
      {activeList && (
        <div key={activeList.id} className="slide-up" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {/* FAB – absolute inside the list container */}
          {activeList.type === "free" && (
            <button onClick={() => { setShowAddModal(true); setListMode(false); setNewItemName(""); setPasteText(""); }}
              style={{ position: "absolute", bottom: 16, right: 16, width: 52, height: 52, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(232,112,58,0.45)", zIndex: 50, border: "none", cursor: "pointer" }}>
              <Icon name="plus" size={22} color="#fff" />
            </button>
          )}

          {/* Liste – pleine largeur, défilante */}
          <div ref={listScrollRef} style={{ flex: 1, overflowY: "auto", padding: `12px 20px ${activeList.type === "free" ? 76 : 20}px` }}>
            <div ref={listContentRef} style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>

            {activeList.items.length === 0 && activeList.type !== "free" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, maxWidth: 380, margin: "0 auto" }}>
                <div style={{ width: 76, height: 76, borderRadius: 22, background: "rgba(76,175,125,0.14)", border: "1px solid rgba(76,175,125,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: "0 8px 24px -16px rgba(0,0,0,0.35)" }}>
                  <Icon name="check" size={32} color="var(--green)" />
                </div>
                <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 7 }}>Tout est acheté&nbsp;!</h3>
                <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 22 }}>
                  Tous les ingrédients de « <strong style={{ color: "var(--text)", fontWeight: 600 }}>{activeList.name}</strong> » ont été cochés. Tu peux supprimer cette liste, elle a fait son travail.
                </p>
                <button style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", fontSize: 14, fontWeight: 600, borderRadius: 999, cursor: "pointer", background: "rgba(224,82,82,0.10)", color: "var(--red)", border: "1px solid rgba(224,82,82,0.28)", boxShadow: "none" }} onClick={() => deleteList(activeList.id)}>
                  <Icon name="trash" size={15} color="var(--red)" /> Supprimer la liste
                </button>
              </div>
            )}

            {activeList.items.length === 0 && activeList.type === "free" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, textAlign: "center" }}>
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
                          <button style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "6px 14px", fontSize: 11.5, fontWeight: 600, borderRadius: 999, background: "rgba(76,175,125,0.14)", color: "var(--green)", border: "1px solid rgba(76,175,125,0.35)", cursor: "pointer" }} onClick={() => setConfirmClearId(activeList.id)} title="Confirme l'achat – les produits de placard rejoignent ton stock">
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
        </div>
      )}
      {/* Confirm delete modal – only for free lists */}
      {/* Menu d'une liste (⋯ de la pastille active / appui long) */}
      {listMenu && (() => {
        const lm = listMenu;
        const close = () => setListMenu(null);
        return (
        <SwipeableSheet onClose={close}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: "rgba(232,112,58,0.14)", display: "grid", placeItems: "center" }}>
              <Icon name={lm.type === "recipe" ? "book" : "shopping"} size={24} color="var(--accent)" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lm.name}</div>
              <div style={{ fontSize: 13, color: "var(--text3)" }}>{lm.type === "recipe" ? "Depuis une recette" : "Liste libre"} · {lm.items.length} article{lm.items.length > 1 ? "s" : ""}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <button className="menu-row" onPointerDown={spawnRipple} onClick={() => { setConfigList({ ...lm }); close(); }}>
              <Icon name="settings" size={19} color="var(--text2)" /> Paramètres de la liste
            </button>
            <button className="menu-row menu-row-danger" style={{ borderTop: "1px solid var(--border)", marginTop: 6 }}
              onPointerDown={spawnRipple}
              onClick={() => { close(); lm.type === "free" ? setConfirmDeleteId(lm.id) : deleteList(lm.id); }}>
              <Icon name="trash" size={19} color="var(--red)" /> Supprimer la liste
            </button>
          </div>
        </SwipeableSheet>
        );
      })()}

      {confirmDeleteId && (
        <ConfirmDialog title="Supprimer la liste ?"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => { deleteList(confirmDeleteId); setConfirmDeleteId(null); }}>
          <strong style={{ color: "var(--text)" }}>« {shoppingLists.find(l => l.id === confirmDeleteId)?.name} »</strong> sera supprimée définitivement avec tous ses articles.
        </ConfirmDialog>
      )}
      {/* Confirmation : valider l'achat (déversement dans le stock) */}
      {confirmClearId && (() => {
        const isAll = confirmClearId === ALL_ID;
        const checked = isAll
          ? shoppingLists.flatMap(l => (l.items || []).filter(i => i.checked))
          : (shoppingLists.find(l => l.id === confirmClearId)?.items || []).filter(i => i.checked);
        const toStock = checked
          .map(i => findIngredientMatch(i.name, ingredientDB))
          .filter(m => m && STOCK_CATEGORIES.has(m.category));
        return (
          <SwipeableSheet onClose={() => setConfirmClearId(null)}>
            {(close) => (<>
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
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close()}>Annuler</button>
              <button className="btn btn-primary" style={{ flex: 1, background: "var(--green)", borderColor: "var(--green)" }} onClick={() => close(() => {
                setConfirmClearId(null); // sinon le sheet reste monté (close(cb) shunte onClose)
                if (isAll) clearAllChecked(); else clearChecked(confirmClearId);
                // Un toast de succès par produit ajouté au stock, en cascade (dédupliqués).
                const seen = new Set();
                toStock.filter(m => !seen.has(m.id) && seen.add(m.id))
                  .forEach((m, idx) => setTimeout(() => notify?.(`${m.name} ajouté à ton stock`), idx * 900));
              })}>
                <Icon name="check" size={15} color="#fff" /> Valider
              </button>
            </div>
            </>)}
          </SwipeableSheet>
        );
      })()}
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
                {over && <div style={{ fontSize: 11, color: "var(--red)", marginBottom: 8 }}>Maximum {MAX_LIST_ITEMS} articles à la fois – retire {count - MAX_LIST_ITEMS} ligne(s).</div>}
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
      {configList && (
        <SwipeableSheet onClose={() => setConfigList(null)}>
          {(close) => (<>
          {/* En-tête : pastille d'icône + titre + sous-titre contextuel */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <span style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: "rgba(232,112,58,0.12)", display: "grid", placeItems: "center" }}>
              <Icon name="shopping" size={20} color="var(--accent)" />
            </span>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", margin: 0 }}>{configList.isNew ? "Nouvelle liste" : "Configurer la liste"}</h3>
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
                    background: configList.name === s ? "rgba(232,112,58,0.12)" : "var(--surface2)",
                    color: configList.name === s ? "var(--accent)" : "var(--text2)",
                    border: `1px solid ${configList.name === s ? "rgba(232,112,58,0.4)" : "var(--border)"}` }}>{s}</button>
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
            <button className="btn btn-ghost btn-pill" style={{ flex: 1 }} onClick={() => close()}>Annuler</button>
            <button className="btn btn-primary btn-pill" style={{ flex: 1.4 }} disabled={!configList.name.trim()} onClick={() => close(() => {
              const name = configList.name.trim();
              if (configList.isNew) {
                const l = { id: "sl" + Date.now(), name, type: "free", items: [], hideClear: !!configList.hideClear };
                setShoppingLists(prev => [...prev, l]);
                setActiveListId(l.id);
              } else {
                updateList(configList.id, l => ({ ...l, name, hideClear: !!configList.hideClear }));
              }
              // `close(cb)` exécute cb À LA PLACE de `onClose` → on ferme nous-mêmes,
              // sinon la feuille se rouvre sur le même brouillon.
              setConfigList(null);
            })}>{configList.isNew ? "Créer la liste" : "Enregistrer"}</button>
          </div>
          </>)}
        </SwipeableSheet>
      )}
    </div>
  );
}
