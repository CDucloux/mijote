import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, Navigate, Routes, Route } from "react-router-dom";
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, deleteDoc, onSnapshot, getDocs, query, where } from "firebase/firestore";

import { db, auth, provider } from "./lib/firebase.js";
import {
  metaDoc, sharedListsCol, sharedListDoc, userDirCol, userDirDoc,
  toSharedListDoc, loadMasterDB, loadUserData, migrateLegacyDoc, syncRecipes,
} from "./lib/firestore.js";
import { cleanRecipeForExport, validateRecipeSchema } from "./lib/recipeSchema.js";
import { deleteImageByUrl } from "./lib/storage.js";
import { computeNutriInfo } from "./lib/nutriscore.js";
import { buildNameMatcher } from "./lib/nameMatcher.js";
import {
  DEFAULT_CATEGORIES, SAMPLE_RECIPES, SAMPLE_COLLECTIONS,
} from "./constants/categories.js";
import { useLS } from "./hooks/useLS.js";
import { useIsDesktop } from "./hooks/useIsDesktop.js";
import { usePageZoom } from "./hooks/usePageZoom.js";
import { SwipeableSheet } from "./components/SwipeableSheet.jsx";
import { PullToRefresh } from "./components/PullToRefresh.jsx";
import { Icon } from "./components/Icon.jsx";
import { RecipeNotFound } from "./components/RecipeNotFound.jsx";
import { TabBar } from "./components/TabBar.jsx";
import { DesktopSidebar } from "./components/DesktopSidebar.jsx";
import { HomeTab } from "./screens/HomeTab.jsx";
import { MealPlanTab } from "./screens/MealPlanTab.jsx";
import { FridgeTab } from "./screens/FridgeTab.jsx";
import { ShoppingTab } from "./screens/ShoppingTab.jsx";
import { RecipeEditor } from "./screens/RecipeEditor.jsx";
import { RecipeDetail } from "./screens/RecipeDetail.jsx";
import { ConfigTab } from "./screens/ConfigTab.jsx";
import { TAB_BY_PATH, TAB_BY_ID } from "./constants/tabs.js";

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,300&family=DM+Sans:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#0e0e0f;--bg-rgb:14,14,15;--surface:#171718;--surface2:#1f1f21;--surface3:#252527;
    --border:rgba(255,255,255,0.07);--accent:#e8703a;--accent2:#f0a875;
    --text:#f0ede8;--text2:#9a9490;--text3:#5a5754;
    --green:#4caf7d;--red:#e05252;--yellow:#f0c060;--blue:#5b9cf6;--orange:#f0992a;
    --radius:16px;--radius-sm:10px;
    --ff-display:'Fraunces',serif;--ff-body:'DM Sans',sans-serif;
    --tab-h:72px;
  }
  /* ── LIGHT THEME ── */
  html.light,.light{
    --bg:#f5f0eb;--bg-rgb:245,240,235;--surface:#ffffff;--surface2:#ede8e2;--surface3:#e0d8d0;
    --border:rgba(0,0,0,0.09);
    --text:#2c2420;--text2:#5a5250;--text3:#887870;
  }
  html.light,html.light body{background:#f5f0eb;color:#2c2420;}
  /* Pills ustensiles (desktop) : fond blanc en thème clair */
  html.light .ut-pill-desktop{background:#ffffff!important;}
  html.light .field-input{color:#2c2420;background:#ede8e2;}
  html.light select option{background:#ede8e2;color:#1a1614;}
  *,*::before,*::after{transition:background-color 0.2s ease,border-color 0.2s ease,color 0.1s ease;}
  /* Selection highlight — Mijoté sage green, distinct from the orange accent and the default blue */
  ::selection{background:rgba(76,175,125,0.35);}
  ::-moz-selection{background:rgba(76,175,125,0.35);}
  html,body{background:var(--bg);color:var(--text);font-family:var(--ff-body);font-size:15px;height:100%;overflow:hidden;}
  #root{height:100dvh;display:flex;flex-direction:column;max-width:480px;margin:0 auto;position:relative;overflow:hidden;}
  button{font-family:var(--ff-body);cursor:pointer;border:none;background:none;color:inherit;}
  input,textarea,select{font-family:var(--ff-body);}
  ::-webkit-scrollbar{display:none;}*{scrollbar-width:none;}
  .tag{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500;background:var(--surface2);color:var(--text2);border:1px solid var(--border);}
  .tag.accent{background:rgba(232,112,58,0.15);color:var(--accent);border-color:rgba(232,112,58,0.3);}
  .tag.green{background:rgba(76,175,125,0.15);color:var(--green);border-color:rgba(76,175,125,0.3);}
  .field-label{font-size:11px;font-weight:500;color:var(--text3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;}
  .field-input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;color:var(--text);font-size:14px;outline:none;transition:border-color 0.2s;}
  .field-input:focus{border-color:var(--accent);}
  .field-input::placeholder{color:var(--text3);}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 18px;border-radius:var(--radius-sm);font-size:14px;font-weight:500;transition:all 0.18s;}
  .btn-primary{background:var(--accent);color:#fff;}
  .btn-ghost{border:1px solid var(--border);color:var(--text2);background:var(--surface2);}
  .btn-danger{background:rgba(224,82,82,0.15);color:var(--red);border:1px solid rgba(224,82,82,0.3);}
  .btn-sm{padding:6px 12px;font-size:12px;border-radius:8px;}
  .slide-up{animation:slideUp 0.28s cubic-bezier(0.25,0.46,0.45,0.94) both;}
  @keyframes slideUp{from{transform:translateY(16px);opacity:0;}to{transform:translateY(0);opacity:1;}}
  .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;display:flex;flex-direction:column;justify-content:flex-end;animation:fadeIn 0.2s;}
  @keyframes toastIn{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}
  .modal-sheet{background:var(--surface);border-radius:24px 24px 0 0;padding:20px;max-height:92dvh;overflow-y:auto;animation:sheetUp 0.3s cubic-bezier(0.25,0.46,0.45,0.94);}
  @keyframes sheetUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
  .modal-handle{width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px;}
  @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
  @keyframes expandDown{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
  @keyframes editorSlideIn{from{opacity:0;transform:translateY(32px);}to{opacity:1;transform:translateY(0);}}
  .editor-enter{animation:editorSlideIn 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both;}
  @keyframes cookModeIn{from{opacity:0;transform:scale(0.97) translateY(20px);}to{opacity:1;transform:scale(1) translateY(0);}}
  @keyframes popIn{0%{transform:scale(0) rotate(-10deg);opacity:0;}60%{transform:scale(1.2) rotate(5deg);}100%{transform:scale(1) rotate(0deg);opacity:1;}}
  @keyframes floatUp{0%{transform:translateY(0);opacity:1;}100%{transform:translateY(-60px);opacity:0;}}
  .drag-over{border-color:var(--accent)!important;background:rgba(232,112,58,0.08)!important;}
  .detail-scroll-fix{min-height:0;}

  /* ── DESKTOP LAYOUT ── */
  .app-brand{display:inline-flex;align-items:center;gap:3px;}
  @media(min-width:768px){.app-brand{display:none!important;}
  
    ::-webkit-scrollbar{display:block;width:6px;height:6px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:var(--surface3);border-radius:3px;}
    *{scrollbar-width:thin;scrollbar-color:var(--surface3) transparent;}

    html,body{overflow:auto;}
    #root{margin:0;max-width:100%;width:100%;height:100dvh;zoom:var(--page-zoom,1);flex-direction:row;overflow:hidden;}

    /* Sidebar */
    .desktop-sidebar{
      width:220px;min-width:220px;height:100dvh;
      background:var(--surface);border-right:1px solid var(--border);
      display:flex;flex-direction:column;padding:28px 0 20px;
      flex-shrink:0;
    }
    .desktop-sidebar-logo{
      font-family:var(--ff-display);font-size:22px;font-weight:500;
      padding:0 22px 28px;letter-spacing:-0.02em;color:var(--text);
    }
    .desktop-sidebar-logo span{color:var(--accent);}
    .desktop-nav-item{
      display:flex;align-items:center;gap:12px;
      padding:11px 22px;margin:1px 10px;border-radius:10px;
      font-size:14px;font-weight:500;color:var(--text2);
      transition:all 0.15s;cursor:pointer;border:none;background:none;
      font-family:var(--ff-body);width:calc(100% - 20px);text-align:left;
    }
    .desktop-nav-item:hover{background:var(--surface2);color:var(--text);}
    .desktop-nav-item.active{background:rgba(232,112,58,0.15);color:var(--accent);}
    .desktop-nav-item.active svg{stroke:var(--accent);}

    /* Content area */
    .desktop-content{flex:1;overflow:hidden;display:flex;flex-direction:column;}

    /* Wider panels */
    .desktop-content .recipe-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))!important;}
    .desktop-content .collections-row{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))!important;gap:12px!important;overflow:visible!important;}
    .desktop-content .collections-row button{width:auto!important;}
    /* Config ustensiles : 4 cartes par ligne sur desktop (au lieu de 2), pleine largeur */
    .desktop-content .config-ut-grid{grid-template-columns:repeat(4,1fr)!important;}

    /* Detail panel — two-column on large screens */
    .detail-layout{display:flex;height:100%;overflow:hidden;}
    .detail-hero-col{width:340px;min-width:340px;position:relative;flex-shrink:0;}
    .detail-hero-col .hero-img{height:100%!important;position:absolute;inset:0;}
    .detail-content-col{flex:1;overflow-y:auto;display:flex;flex-direction:column;}

    /* Modal on desktop: centered dialog instead of bottom sheet */
    .modal-backdrop{justify-content:center;align-items:center;}
    .modal-sheet{border-radius:20px!important;max-width:480px;width:100%;margin:0 auto;max-height:80dvh;}
    .modal-handle{display:none;}

    /* Editor wider */
    .editor-layout{max-width:720px;margin:0 auto;width:100%;}

    /* Recipe card hover zoom — desktop only */
    .recipe-card-thumb{overflow:hidden;}
    .recipe-card-thumb img{transition:transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94);}
    .recipe-card:hover .recipe-card-thumb img{transform:scale(1.08);}
    .recipe-card{transition:border-color 0.15s,box-shadow 0.25s;}
    .recipe-card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.12);}

    /* Button hover / press feedback — desktop only (no motion) */
    .btn{transition:background-color .18s ease,border-color .18s ease,box-shadow .2s ease,filter .18s ease;}
    .btn-primary:hover{filter:brightness(1.06);box-shadow:0 4px 14px -4px rgba(232,112,58,0.5);}
    .btn-ghost:hover{background:var(--surface3);border-color:var(--text3);color:var(--text);}
    .btn-danger:hover{background:rgba(224,82,82,0.22);border-color:rgba(224,82,82,0.5);}
    .btn:active{filter:brightness(0.95);}
    /* Floating action FAB + soft icon button (no lift) */
    .fab-toggle{transition:filter .18s ease,box-shadow .2s ease;}
    .fab-toggle:hover{filter:brightness(1.06);box-shadow:0 12px 30px -6px rgba(232,112,58,0.6);}
    .fab-toggle:active{filter:brightness(0.93);}
    .icon-btn-soft{transition:background-color .18s ease,color .18s ease;}
    .icon-btn-soft:hover{background:var(--surface3)!important;color:var(--text)!important;}

    /* Cook mode sidebar */
    .cook-mode-sidebar{display:flex!important;flex-direction:column;}

    /* Recipe detail: hide tabs on desktop, show 2-col layout */
    .detail-tabs-mobile{display:none!important;}
    .detail-mobile-content{display:none!important;}
    .detail-desktop-content{display:flex!important;}
  }
`;


function AppInner() {
  usePageZoom();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = TAB_BY_PATH[location.pathname] || (location.pathname.startsWith("/config/") ? "config" : "home");
  const setTab = useCallback((id) => navigate(TAB_BY_ID[id] || "/recipes"), [navigate]);
  // ── Auth state (declared early so DB setters can read isAdmin) ────────────────
  // `undefined` = en cours de résolution (1er chargement), `null` = déconnecté.
  // Au remontage du composant lors d'une navigation, Firebase est déjà initialisé :
  // `auth.currentUser` renvoie l'utilisateur synchronement, évitant un flash de l'écran
  // de chargement entre les onglets.
  const [user, setUser] = useState(() => auth.currentUser ?? undefined);
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const isAdmin = !!(user && ADMIN_EMAIL && user.email === ADMIN_EMAIL);

  const [recipes, setRecipes] = useLS("rf_recipes2", SAMPLE_RECIPES);
  const [collections, setCollections] = useLS("rf_collections2", SAMPLE_COLLECTIONS);
  const [mealPlan, setMealPlan] = useLS("rf_mealplan2", {});
  const [shoppingLists, setShoppingLists] = useLS("rf_shopping3", []);
  // Listes partagées (autres membres ou que je partage) — alimentées par onSnapshot.
  const [sharedLists, setSharedLists] = useState([]);
  // Annuaire des utilisateurs connus (pour proposer les e-mails avec avatar au partage).
  const [directory, setDirectory] = useState([]);
  const personalListsRef = useRef(shoppingLists);
  const sharedListsRef = useRef(sharedLists);
  useEffect(() => { personalListsRef.current = shoppingLists; }, [shoppingLists]);
  useEffect(() => { sharedListsRef.current = sharedLists; }, [sharedLists]);
  // Une liste est « partagée » dès qu'elle a au moins un invité. Le tag _shared (issu du
  // snapshot) ne sert qu'à l'affichage — pas à la décision de routage, sinon le départage
  // (sharedWith vidé) ne ramènerait jamais la liste en perso.
  const listIsShared = (l) => Array.isArray(l.sharedWith) && l.sharedWith.length > 0;
  // Vue fusionnée affichée : listes partagées d'abord, puis perso, dédoublonnées par id.
  const mergedShoppingLists = useMemo(() => {
    const sharedIds = new Set(sharedLists.map(l => l.id));
    return [...sharedLists, ...shoppingLists.filter(l => !sharedIds.has(l.id))];
  }, [shoppingLists, sharedLists]);
  // Reference DBs: shared Master + user's own additions, merged for display.
  const [masterDB, setMasterDB] = useState(() => {
    try {
      const cached = localStorage.getItem("rf_masterDB_cache");
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }
    return { ingredients: [], utensils: [], categories: DEFAULT_CATEGORIES };
  });
  const [userDB, setUserDB] = useState({ ingredients: [], utensils: [] });
  // Nutrition categories live in the Master (admin-managed). Fall back to defaults.
  const categories = useMemo(
    () => (masterDB.categories && Object.keys(masterDB.categories).length ? masterDB.categories : DEFAULT_CATEGORIES),
    [masterDB]
  );
  const setCategories = useCallback((updater) => {
    setMasterDB(prev => {
      const cur = prev.categories && Object.keys(prev.categories).length ? prev.categories : DEFAULT_CATEGORIES;
      const next = typeof updater === "function" ? updater(cur) : updater;
      return { ...prev, categories: next };
    });
  }, []);
  // Admins see master items as editable; normal users see them read-only.
  const ingredientDB = useMemo(
    () => [...masterDB.ingredients, ...userDB.ingredients].map(i => ({ ...i, _ro: !isAdmin })),
    [masterDB, userDB, isAdmin]
  );
  const utensilDB = useMemo(
    () => [...masterDB.utensils, ...userDB.utensils].map(u => ({ ...u, _ro: !isAdmin })),
    [masterDB, userDB, isAdmin]
  );
  // Setters: admins write everything to the shared Master (folding in any of their
  // own/migrated items); normal users only ever write to their own additions.
  const setIngredientDB = useCallback((updater) => {
    if (!isAdmin) return; // base de référence en lecture seule pour les non-admins
    const merged = [...masterDB.ingredients, ...userDB.ingredients];
    const next = (typeof updater === "function" ? updater(merged) : updater).map(({ _ro, ...rest }) => rest);
    setMasterDB(prev => ({ ...prev, ingredients: next }));
    if (userDB.ingredients.length) setUserDB(prev => ({ ...prev, ingredients: [] }));
  }, [masterDB, userDB, isAdmin]);
  const setUtensilDB = useCallback((updater) => {
    if (!isAdmin) return; // base de référence en lecture seule pour les non-admins
    const merged = [...masterDB.utensils, ...userDB.utensils];
    const next = (typeof updater === "function" ? updater(merged) : updater).map(({ _ro, ...rest }) => rest);
    setMasterDB(prev => ({ ...prev, utensils: next }));
    if (userDB.utensils.length) setUserDB(prev => ({ ...prev, utensils: [] }));
  }, [masterDB, userDB, isAdmin]);

  // Écrit les changements des listes partagées vers Firestore (création/màj/suppression/quitter).
  // Compare l'ancien et le nouvel état fusionné pour n'écrire que ce qui change.
  const persistSharedDiffs = useCallback(async (prevMerged, next) => {
    if (!user?.email) return;
    const myEmail = user.email.toLowerCase();
    const prevById = new Map(prevMerged.map(l => [l.id, l]));
    const nextById = new Map(next.map(l => [l.id, l]));
    const ops = [];
    for (const l of next) {
      const prev = prevById.get(l.id);
      if (!listIsShared(l)) {
        // Départage : était partagée, redevient perso → le propriétaire supprime le doc partagé.
        if (prev && prev._shared && (prev.ownerEmail || "").toLowerCase() === myEmail) {
          ops.push(deleteDoc(sharedListDoc(l.id)));
        }
        continue;
      }
      const ownerEmail = (l.ownerEmail || myEmail).toLowerCase();
      const ownerUid = l.ownerUid || (ownerEmail === myEmail ? user.uid : null);
      const payload = toSharedListDoc(l, { ownerEmail, ownerUid });
      const sig = p => JSON.stringify({ name: p.name, items: p.items, hideClear: !!p.hideClear, sharedWith: (p.sharedWith || []).map(e => (e || "").toLowerCase()) });
      if (!prev || !prev._shared || sig(prev) !== sig(payload)) {
        ops.push(setDoc(sharedListDoc(l.id), payload));
      }
    }
    for (const l of prevMerged) {
      if (l._shared && !nextById.has(l.id)) {
        if ((l.ownerEmail || "").toLowerCase() === myEmail) {
          ops.push(deleteDoc(sharedListDoc(l.id)));                          // propriétaire : suppression
        } else {
          const sharedWith = (l.sharedWith || []).filter(e => (e || "").toLowerCase() !== myEmail);
          const memberEmails = (l.memberEmails || []).filter(e => (e || "").toLowerCase() !== myEmail);
          ops.push(setDoc(sharedListDoc(l.id), { ...toSharedListDoc(l, { ownerEmail: (l.ownerEmail || "").toLowerCase(), ownerUid: l.ownerUid || null }), sharedWith, memberEmails })); // membre : quitter
        }
      }
    }
    if (!ops.length) return;
    setSyncStatus("syncing");
    const results = await Promise.allSettled(ops);
    if (results.some(r => r.status === "rejected")) {
      setSyncStatus("error");
      notify("Partage indisponible : écriture refusée. Les règles Firestore sont-elles déployées ?", "error");
    } else {
      setSyncStatus("synced");
    }
  }, [user]);

  // Setter unique exposé à ShoppingTab : reçoit la liste FUSIONNÉE, aiguille perso vs partagé.
  const setMergedShoppingLists = useCallback((updater) => {
    const myEmail = (user?.email || "").toLowerCase();
    const sharedIds = new Set(sharedListsRef.current.map(l => l.id));
    // Vue fusionnée identique au memo : la version partagée prime sur la copie perso de même id.
    const prevMerged = [...sharedListsRef.current, ...personalListsRef.current.filter(l => !sharedIds.has(l.id))];
    const next = typeof updater === "function" ? updater(prevMerged) : updater;

    const ownerOf = l => (l.ownerEmail || myEmail).toLowerCase();
    const isMine = l => !listIsShared(l) || ownerOf(l) === myEmail;

    // Anti-perte : le PROPRIÉTAIRE garde toujours une copie perso durable, même partagée.
    // Les listes partagées PAR d'autres ne vivent que dans la collection partagée.
    const nextPersonal = next.filter(isMine);
    const nextShared = next.filter(listIsShared);

    const strippedPersonal = nextPersonal.map(l => {
      const { _shared, memberEmails, ownerUid, ...rest } = l;
      if (listIsShared(l)) return { ...rest, ownerEmail: ownerOf(l) };  // conserve sharedWith + ownerEmail
      const { ownerEmail, sharedWith, ...clean } = rest;                // perso non partagée : aucune méta de partage
      return clean;
    });
    if (JSON.stringify(personalListsRef.current) !== JSON.stringify(strippedPersonal)) setShoppingLists(strippedPersonal);

    setSharedLists(nextShared.map(l => {                              // reflet optimiste immédiat
      const ownerEmail = ownerOf(l);
      const sw = (l.sharedWith || []).map(e => (e || "").toLowerCase());
      return { ...l, _shared: true, ownerEmail, ownerUid: l.ownerUid || (ownerEmail === myEmail ? user?.uid : null), memberEmails: Array.from(new Set([ownerEmail, ...sw])) };
    }));
    persistSharedDiffs(prevMerged, next);
  }, [persistSharedDiffs, setShoppingLists, user]);
  const [fridge, setFridge] = useLS("rf_fridge", []);
  const [fridgeSettings, setFridgeSettings] = useLS("rf_fridge_settings", { matchThreshold: 25 });
  const [pantry, setPantry] = useLS("rf_pantry", []);
  // Dérivé du pathname (et non de useParams) pour qu'AppInner reste une instance
  // unique montée sur `path="*"` : pas de remontage entre les onglets.
  const recipeIdParam = location.pathname.startsWith("/recipes/")
    ? decodeURIComponent(location.pathname.slice(9)) || undefined
    : undefined;
  const selectedRecipe = recipeIdParam || null;
  const setSelectedRecipe = useCallback((id) => {
    if (id) navigate(`/recipes/${id}`);
    else navigate(location.pathname === `/recipes/${recipeIdParam}` ? "/recipes" : location.pathname, { replace: true });
  }, [navigate, location.pathname, recipeIdParam]);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [notification, setNotification] = useState(null);

  // ── Auth refs ─────────────────────────────────────────────────────────────────
  const firestoreUnsub = useRef(null);
  const cloudLoaded = useRef(false); // gate saves until initial cloud load completes
  const recipeSyncMap = useRef(new Map()); // last-synced recipe snapshot for diffing

  useEffect(() => {
    getRedirectResult(auth).catch(() => { });
    const unsub = onAuthStateChanged(auth, async u => {
      cloudLoaded.current = false;
      recipeSyncMap.current = new Map();
      setUser(u);
      if (u) {
        setSyncStatus("syncing");
        try {
          // Master reference DB (shared, read-only) — load in parallel.
          const masterPromise = loadMasterDB();

          // Load user's split data.
          let data = await loadUserData(u.uid);
          const isEmpty = data.recipes.length === 0 && !data.collections && !data.userDB
            && !data.mealPlan && !data.shoppingLists && !data.fridge;

          // First run with no split data? Try migrating the legacy single doc.
          if (isEmpty) {
            const legacy = await migrateLegacyDoc(u.uid);
            if (legacy) {
              data = {
                recipes: legacy.recipes || [],
                collections: legacy.collections || null,
                mealPlan: legacy.mealPlan || null,
                shoppingLists: legacy.shoppingLists || null,
                fridge: legacy.fridge || null,
                fridgeSettings: legacy.fridgeSettings || null,
                // Legacy ingredientDB/utensilDB become the user's own additions.
                userDB: { ingredients: legacy.ingredientDB || [], utensils: legacy.utensilDB || [] },
              };
            }
          }

          // Hydrate state.
          setRecipes(data.recipes || []);
          if (data.collections) setCollections(data.collections);
          if (data.mealPlan) setMealPlan(data.mealPlan);
          if (data.shoppingLists) setShoppingLists(data.shoppingLists);
          if (data.fridge) setFridge(data.fridge);
          if (data.fridgeSettings) setFridgeSettings(data.fridgeSettings);
          if (data.pantry) setPantry(data.pantry);
          setUserDB(data.userDB || { ingredients: [], utensils: [] });
          const freshMaster = await masterPromise;
          setMasterDB(freshMaster);
          try { localStorage.setItem("rf_masterDB_cache", JSON.stringify(freshMaster)); } catch { /* quota */ }

          // Seed the recipe diff map so the first save doesn't rewrite everything.
          const map = new Map();
          for (const r of (data.recipes || [])) if (r.id) map.set(r.id, r);
          recipeSyncMap.current = map;

          // If we migrated, persist into the split structure once.
          if (isEmpty && data.recipes && (data.recipes.length || data.userDB)) {
            await Promise.all([
              syncRecipes(u.uid, data.recipes, new Map()).then(m => { recipeSyncMap.current = m; }),
              setDoc(metaDoc(u.uid, "collections"), { items: data.collections || [] }),
              setDoc(metaDoc(u.uid, "mealPlan"), { data: data.mealPlan || {} }),
              setDoc(metaDoc(u.uid, "shoppingLists"), { items: data.shoppingLists || [] }),
              setDoc(metaDoc(u.uid, "fridge"), { items: data.fridge || [], settings: data.fridgeSettings || { matchThreshold: 25 }, pantry: data.pantry || [] }),
              setDoc(metaDoc(u.uid, "userDB"), data.userDB || { ingredients: [], utensils: [] }),
            ]);
          }

          setTimeout(() => { cloudLoaded.current = true; setSyncStatus("synced"); }, 0);
        } catch (e) { setSyncStatus("error"); }
      } else {
        if (firestoreUnsub.current) { firestoreUnsub.current(); firestoreUnsub.current = null; }
      }
    });
    return () => unsub();
  }, []);
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("rf_theme") !== "light"; } catch { return true; }
  });
  const toggleTheme = () => setIsDark(prev => {
    const next = !prev;
    try { localStorage.setItem("rf_theme", next ? "dark" : "light"); } catch { }
    return next;
  });

  // Sync theme class to <html> so html/body background updates too
  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
  }, [isDark]);

  // Keep masterDB cache in sync so images are available after reload
  useEffect(() => {
    if (!masterDB.ingredients.length && !masterDB.utensils.length) return;
    try { localStorage.setItem("rf_masterDB_cache", JSON.stringify(masterDB)); } catch { /* quota */ }
  }, [masterDB]);

  // Update document title on tab change
  useEffect(() => {
    const titles = { "home": "Recettes", "meal-plan": "Planning", "shopping": "Courses", "fridge": "Frigo", "config": "Configuration" };
    document.title = `Mijoté | ${titles[tab] || "Recettes"}`;
  }, [tab]);


  // ── Save to Firestore whenever data changes (split structure) ─────────────────
  const saveMeta = useCallback(async (name, payload) => {
    if (!user || !cloudLoaded.current) return;
    setSyncStatus("syncing");
    try {
      await setDoc(metaDoc(user.uid, name), payload);
      setSyncStatus("synced");
    } catch (e) { setSyncStatus("error"); }
  }, [user]);

  // Recipes: diff-based — only changed/new/removed docs are written.
  useEffect(() => {
    if (!user || !cloudLoaded.current) return;
    setSyncStatus("syncing");
    syncRecipes(user.uid, recipes, recipeSyncMap.current)
      .then(map => { recipeSyncMap.current = map; setSyncStatus("synced"); })
      .catch(() => setSyncStatus("error"));
  }, [recipes, user]);

  useEffect(() => { saveMeta("collections", { items: collections }); }, [collections]);
  useEffect(() => { saveMeta("mealPlan", { data: mealPlan }); }, [mealPlan]);
  useEffect(() => { saveMeta("shoppingLists", { items: shoppingLists }); }, [shoppingLists]);

  // Abonnement temps réel aux listes partagées dont je suis membre (par e-mail).
  useEffect(() => {
    if (!user?.email) { setSharedLists([]); return; }
    const email = user.email.toLowerCase();
    let unsub;
    try {
      unsub = onSnapshot(
        query(sharedListsCol(), where("memberEmails", "array-contains", email)),
        snap => setSharedLists(snap.docs.map(d => ({ ...d.data(), _shared: true }))),
        () => { } // règles non déployées / hors-ligne : on ignore silencieusement
      );
    } catch { /* noop */ }
    return () => { if (unsub) unsub(); };
  }, [user]);

  // Annuaire : publie ma fiche (e-mail/avatar) et charge celles des autres pour le partage.
  useEffect(() => {
    if (!user) { setDirectory([]); return; }
    setDoc(userDirDoc(user.uid), {
      uid: user.uid, email: (user.email || "").toLowerCase(),
      displayName: user.displayName || "", photoURL: user.photoURL || "", updatedAt: Date.now(),
    }, { merge: true }).catch(() => { });
    getDocs(userDirCol()).then(s => setDirectory(s.docs.map(d => d.data()))).catch(() => { });
  }, [user]);
  useEffect(() => { saveMeta("fridge", { items: fridge, settings: fridgeSettings, pantry }); }, [fridge, fridgeSettings, pantry]);
  useEffect(() => { saveMeta("userDB", userDB); }, [userDB]);

  // Master DB: only admins persist changes (and Firestore rules enforce it server-side).
  useEffect(() => {
    if (!user || !cloudLoaded.current || !isAdmin) return;
    setSyncStatus("syncing");
    Promise.all([
      setDoc(doc(db, "master", "ingredients"), { items: masterDB.ingredients }),
      setDoc(doc(db, "master", "utensils"), { items: masterDB.utensils }),
      setDoc(doc(db, "master", "categories"), { map: masterDB.categories || DEFAULT_CATEGORIES }),
    ]).then(() => setSyncStatus("synced")).catch(() => setSyncStatus("error"));
  }, [masterDB, user, isAdmin]);

  const notify = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2800);
  };

  const saveRecipe = r => {
    const missingQty = (r.ingredients || []).filter(ing => (ing.name || ing.dbId) && !(Number(ing.amount) > 0));
    if (missingQty.length > 0) {
      const names = missingQty.map(i => i.name || "sans nom").join(", ");
      notify(`Quantité manquante pour : ${names}`, "error");
      return;
    }
    const { score, letter } = computeNutriInfo(r.ingredients, ingredientDB);
    const withScore = { ...r, healthScore: score, nutriLetter: letter };
    let updatedRecipes;
    if (r.id && recipes.find(x => x.id === r.id)) {
      // Editing — check duplicate name only against OTHER recipes
      const nameTaken = recipes.some(x => x.id !== r.id && x.name.toLowerCase().trim() === r.name.toLowerCase().trim());
      if (nameTaken) { notify(`Une recette nommée "${r.name}" existe déjà`, "error"); return; }
      updatedRecipes = recipes.map(x => x.id === r.id ? withScore : x);
    } else {
      // Creating — check duplicate name
      const nameTaken = recipes.some(x => x.name.toLowerCase().trim() === r.name.toLowerCase().trim());
      if (nameTaken) { notify(`Une recette nommée "${r.name}" existe déjà`, "error"); return; }
      if (!r.name.trim()) { notify("Le nom de la recette est obligatoire", "error"); return; }
      updatedRecipes = [{ ...withScore, id: "r" + Date.now(), createdAt: new Date().toISOString().slice(0, 10) }, ...recipes];
    }
    setRecipes(updatedRecipes);
    // Recompute collection counts
    setCollections(prev => prev.map(col => ({ ...col, count: updatedRecipes.filter(rec => (rec.collections || []).includes(col.id)).length })));
    setEditingRecipe(null);
    notify("Recette sauvegardée ✓");
  };

  const deleteRecipe = id => {
    const r = recipes.find(x => x.id === id);
    if (r?.image) deleteImageByUrl(r.image);
    setRecipes(prev => prev.filter(r => r.id !== id));
    navigate("/recipes");
    notify("Recette supprimée");
  };

  const addToShopping = (recipe, selectedIngredients, mult = 1) => {
    const ings = selectedIngredients || recipe.ingredients;
    const items = ings.map(ing => {
      const dbItem = ingredientDB.find(d => d.id === ing.dbId);
      return { id: "si" + Date.now() + Math.random(), name: ing.name, amount: +(ing.amount * mult).toFixed(2), unit: ing.unit, image: dbItem?.image || "", checked: false };
    });
    if (items.length === 0) return;
    setShoppingLists(prev => {
      const existing = prev.find(l => l.type === "recipe" && l.recipeId === recipe.id);
      if (existing) {
        return prev.map(l => l.id === existing.id ? { ...l, items: [...l.items, ...items] } : l);
      }
      return [...prev, { id: "sl" + Date.now(), name: recipe.name, type: "recipe", recipeId: recipe.id, items }];
    });
    notify(`${items.length} ingrédient(s) ajoutés aux courses`);
  };

  const exportJSON = recipe => {
    const blob = new Blob([JSON.stringify(cleanRecipeForExport(recipe), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${recipe.name.split(" ").join("_")}.json`; a.click();
    notify("Export JSON téléchargé");
  };

  const importJSON = json => {
    let data;
    try { data = JSON.parse(json); }
    catch { notify("JSON invalide : fichier illisible", "error"); return; }
    const incoming = (Array.isArray(data) ? data : [data]);
    if (!incoming.length) { notify("Aucune recette dans le fichier", "error"); return; }

    // Validation de schéma : on écarte les recettes non conformes plutôt que
    // d'injecter des données corrompues. Import refusé si TOUT est invalide.
    const validRecipes = [], schemaErrors = [];
    incoming.forEach((r, i) => {
      const label = `Recette ${r && typeof r === "object" && r.name ? `« ${r.name} »` : `#${i + 1}`}`;
      const e = validateRecipeSchema(r, label);
      if (e.length) schemaErrors.push(...e); else validRecipes.push(r);
    });
    if (!validRecipes.length) {
      notify(`Import refusé — schéma invalide : ${schemaErrors[0]}`, "error");
      return;
    }

    try {
      const incomingValid = validRecipes;
      const matchIng = buildNameMatcher(ingredientDB);
      const matchUt = buildNameMatcher(utensilDB);
      let linked = 0;
      // Pour chaque recette : remplit les dbId vides par rapprochement de nom
      // contre la base de l'utilisateur, puis recalcule le score santé à partir
      // des ingrédients désormais reliés. Un dbId déjà présent est respecté.
      const prepared = incomingValid
        .map(r => {
          const ingredients = (r.ingredients || []).map(ing => {
            if (ing.dbId) return ing;
            const dbId = matchIng(ing.name);
            if (dbId) linked++;
            return { ...ing, dbId };
          });
          const utensils = (r.utensils || []).map(u => {
            if (u.dbId) return u;
            const dbId = matchUt(u.name);
            if (dbId) linked++;
            return { ...u, dbId };
          });
          return {
            ...r,
            id: "r" + Date.now() + Math.random(),
            ingredients,
            utensils,
            ...(() => { const { score, letter } = computeNutriInfo(ingredients, ingredientDB); return { healthScore: score, nutriLetter: letter }; })(),
          };
        });
      const rejected = incoming.length - validRecipes.length;
      setRecipes(prev => {
        const existingNames = new Set(prev.map(r => r.name.toLowerCase().trim()));
        const newOnes = prepared.filter(r => !existingNames.has(r.name.toLowerCase().trim()));
        const dupes = prepared.length - newOnes.length;
        const extras = [
          linked > 0 ? `${linked} élément(s) reliés à ta base` : "",
          dupes > 0 ? `${dupes} doublon(s) ignoré(s)` : "",
          rejected > 0 ? `${rejected} recette(s) non conforme(s) écartée(s)` : "",
        ].filter(Boolean).join(" · ");
        if (newOnes.length > 0) notify(`${newOnes.length} recette(s) importée(s)${extras ? ` · ${extras}` : ""} ✓`);
        else notify(`Aucune recette importée${extras ? ` — ${extras}` : ""}`, "error");
        return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
      });
    } catch { notify("Erreur lors de l'import", "error"); }
  };

  const exportPDF = recipe => {
    const ingImg = dbId => ingredientDB.find(d => d.id === dbId)?.image || "";
    const utImg = dbId => utensilDB.find(d => d.id === dbId)?.image || "";
    const pill = (img, name, qty) =>
      `<span class="pill"><span class="pill-img">${img ? `<img src="${img}" alt="" />` : ""}</span><span class="pill-name">${name}</span>${qty ? `<span class="pill-qty">${qty}</span>` : ""}</span>`;
    const ingPills = recipe.ingredients.map(i => pill(ingImg(i.dbId), i.name, `${i.amount}${i.unit || ""}`)).join("");
    const NUTRI_COLORS_PDF = { A: "#1a8a3c", B: "#85bb2f", C: "#f9c813", D: "#e07515", E: "#e63312" };
    const nutriBadge = letter => {
      if (!letter) return "";
      return `<div class="nutri-badge">
        ${["A","B","C","D","E"].map(l => {
          const active = l === letter;
          return `<span class="nl" style="background:${NUTRI_COLORS_PDF[l]};width:${active?21:15}px;height:${active?25:18}px;border-radius:${active?5:3}px;opacity:${active?1:0.5};font-size:${active?14:10}px">${l}</span>`;
        }).join("")}
      </div>`;
    };
    const stepLines = recipe.steps.map((s, i) => {
      const linkedIngs = recipe.ingredients.filter(x => s.ingredients?.includes(x.id)).map(x => pill(ingImg(x.dbId), x.name, `${x.amount}${x.unit || ""}`)).join("");
      const linkedUts = (recipe.utensils || []).filter(u => s.utensils?.includes(u.id)).map(u => pill(utImg(u.dbId), u.name, "")).join("");
      const pills = linkedIngs + linkedUts;
      return `
        <div class="step">
          <div class="step-header">
            <div class="step-num">${i + 1}</div>
            <div class="step-title">Étape ${i + 1}</div>
          </div>
          ${s.text ? `<p class="step-text">${s.text}</p>` : ""}
          ${pills ? `<div class="step-pills">${pills}</div>` : ""}
        </div>`;
    }).join("");
    const utPills = (recipe.utensils || []).map(u => pill(utImg(u.dbId), u.name, "")).join("");
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${recipe.name} — Mijoté</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,300&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --accent: #e8703a; --text: #1a1714; --text2: #5a5250; --text3: #9a9490; --border: #e8e0d8; --surface: #f9f6f2; }
    body { font-family: 'DM Sans', sans-serif; color: var(--text); background: #fff; max-width: 720px; margin: 0 auto; padding: 40px 22px 56px; font-size: 14px; line-height: 1.6; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .hero { width: 100%; height: 230px; object-fit: cover; border-radius: 14px; margin-bottom: 24px; display: block; }
    /* Header */
    .header { padding-bottom: 4px; margin-bottom: 12px; }
    h1 { font-family: 'Fraunces', serif; font-size: 38px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 14px; color: var(--text); }
    .title-rule { width: 48px; height: 4px; border-radius: 4px; background: var(--accent); margin-bottom: 22px; }
    .meta { display: flex; gap: 38px; flex-wrap: wrap; align-items: flex-start; margin-bottom: 0; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; font-weight: 500; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    .meta-val { height: 27px; display: flex; align-items: center; }
    .meta-value { font-size: 16px; font-weight: 600; color: var(--text); line-height: 1; }
    /* Nutri-Score badge */
    .nutri-badge { display: inline-flex; align-items: center; gap: 2px; background: #f9f6f2; border: 1px solid #e8e0d8; border-radius: 6px; padding: 3px 4px; }
    .nl { display: inline-flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; line-height: 1; }
    /* Section titles */
    .section-title { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 500; color: var(--text); margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
    /* Ingredients & step pills */
    .pill { display: inline-flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 4px 13px 4px 4px; font-size: 13px; vertical-align: middle; }
    .pill-img { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: #fff; border: 1px solid var(--border); flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
    .pill-img img { width: 100%; height: 100%; object-fit: cover; }
    .pill-name { font-weight: 500; color: var(--text); }
    .pill-qty { color: var(--text3); font-weight: 500; }
    .ing-pills { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    /* Steps */
    .step { margin-bottom: 22px; }
    .step-header { display: flex; align-items: center; gap: 12px; margin-bottom: 2px; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .step-title { font-weight: 700; font-size: 14px; color: var(--accent); }
    .step-text { color: var(--text2); line-height: 1.65; padding-left: 40px; }
    .step-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; padding-left: 40px; }
    /* Footer */
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text3); }
    .footer-brand { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 500; color: var(--text); letter-spacing: -0.01em; }
    .footer-brand .dot { color: var(--accent); }
    @page { margin: 16mm 14mm; }
    @media print {
      body { max-width: none; margin: 0; padding: 0; font-size: 12px; }
      .hero { height: 200px; break-inside: avoid; }
      .header { break-inside: avoid; }
      .section-title { break-after: avoid; page-break-after: avoid; }
      .pill { break-inside: avoid; page-break-inside: avoid; }
      .step { break-inside: avoid; page-break-inside: avoid; }
      .step-pills { break-inside: avoid; page-break-inside: avoid; }
      .footer { break-inside: avoid; page-break-inside: avoid; }
      p { orphans: 3; widows: 3; }
    }
  </style>
</head>
<body>
  ${recipe.image ? `<img class="hero" src="${recipe.image}" alt="${recipe.name}" />` : ""}
  <div class="header">
    <h1>${recipe.name}</h1>
    <div class="title-rule"></div>
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Préparation</span><div class="meta-val"><span class="meta-value">${recipe.prepTime} min</span></div></div>
      <div class="meta-item"><span class="meta-label">Cuisson</span><div class="meta-val"><span class="meta-value">${recipe.cookTime} min</span></div></div>
      <div class="meta-item"><span class="meta-label">Portions</span><div class="meta-val"><span class="meta-value">${recipe.servings}</span></div></div>
      ${recipe.nutriLetter ? `<div class="meta-item"><span class="meta-label">Nutri-Score</span><div class="meta-val">${nutriBadge(recipe.nutriLetter)}</div></div>` : ""}
    </div>
  </div>

  ${recipe.ingredients?.length ? `
  <div class="section-title">Ingrédients</div>
  <div class="ing-pills">${ingPills}</div>` : ""}

  ${utPills ? `
  <div class="section-title">Ustensiles</div>
  <div class="ing-pills" style="margin-bottom:20px">${utPills}</div>` : ""}

  ${recipe.steps?.length ? `
  <div class="section-title">Étapes</div>
  ${stepLines}` : ""}

  <div class="footer">
    <span class="footer-brand">Mijoté<span class="dot">·</span></span>
    ${recipe.source ? `<span>Source : <a href="${recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source}" style="color:var(--accent)">${recipe.source.replace(/^https?:\/\//, "")}</a></span>` : ""}
  </div>
</body>
</html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    const heroImg = w.document.querySelector(".hero");
    if (heroImg && !heroImg.complete) {
      heroImg.onload = heroImg.onerror = () => setTimeout(() => w.print(), 300);
    } else {
      setTimeout(() => w.print(), 1200);
    }
    notify("PDF en cours de génération…");
  };

  const currentRecipe = recipes.find(r => r.id === selectedRecipe);
  const isDesktop = useIsDesktop();
  const [pendingTab, setPendingTab] = useState(null); // tab requested while editing

  // Navigate with guard: if editing, show confirm dialog first
  const requestTab = (newTab) => {
    if (editingRecipe !== null) {
      setPendingTab(newTab);
    } else {
      setTab(newTab);
    }
  };

  const confirmLeaveEditor = () => {
    setEditingRecipe(null);
    setTab(pendingTab);
    setPendingTab(null);
  };

  // Sign in / out handlers
  const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL;
  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      if (ALLOWED_EMAIL && result.user.email !== ALLOWED_EMAIL) {
        await signOut(auth);
        notify("Accès non autorisé", "error");
        return;
      }
    } catch (e) {
      if (e.code === "auth/popup-blocked") signInWithRedirect(auth, provider);
      else notify("Connexion échouée", "error");
    }
  };
  const handleSignOut = () => { signOut(auth); setUser(null); };

  const tabContent = (
    <div style={{ flex: 1, overflow: isDesktop ? "hidden" : "auto", minHeight: 0, display: "flex", flexDirection: "column" }} className={isDesktop ? "desktop-content" : ""}>
      {tab === "home" && <HomeTab recipes={recipes} collections={collections} ingredientDB={ingredientDB} onSelect={setSelectedRecipe} onNewRecipe={() => setEditingRecipe({ name: "", description: "", prepTime: 0, cookTime: 0, servings: 2, tags: [], ingredients: [], utensils: [], steps: [], collections: [], image: "" })} setCollections={setCollections} user={user} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} />}
      {tab === "meal-plan" && <MealPlanTab mealPlan={mealPlan} recipes={recipes} setMealPlan={setMealPlan} onSelectRecipe={setSelectedRecipe} ingredientDB={ingredientDB} user={user} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} notify={notify} />}
      {tab === "shopping" && <ShoppingTab shoppingLists={mergedShoppingLists} setShoppingLists={setMergedShoppingLists} ingredientDB={ingredientDB} user={user} directory={directory} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} categories={categories} />}
      {tab === "fridge" && <FridgeTab fridge={fridge} setFridge={setFridge} fridgeSettings={fridgeSettings} setFridgeSettings={setFridgeSettings} pantry={pantry} setPantry={setPantry} recipes={recipes} ingredientDB={ingredientDB} onSelectRecipe={setSelectedRecipe} user={user} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} categories={categories} notify={notify} />}
      {tab === "config" && <ConfigTab ingredientDB={ingredientDB} setIngredientDB={setIngredientDB} utensilDB={utensilDB} setUtensilDB={setUtensilDB} collections={collections} setCollections={setCollections} recipes={recipes} onExportAll={() => { const b = new Blob([JSON.stringify(recipes.map(cleanRecipeForExport), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "all_recipes.json"; a.click(); notify("Export complet téléchargé"); }} onImport={importJSON} isDark={isDark} onToggleTheme={toggleTheme} user={user} onSignOut={handleSignOut} syncStatus={syncStatus} isAdmin={isAdmin} categories={categories} setCategories={setCategories} />}
    </div>
  );

  const mainScreen = editingRecipe !== null ? (
    <div className={isDesktop ? "desktop-content editor-layout" : ""} style={{ flex: 1, overflow: "hidden", width: "100%" }}>
      <RecipeEditor recipe={editingRecipe} onSave={saveRecipe} onCancel={() => setEditingRecipe(null)} ingredientDB={ingredientDB} utensilDB={utensilDB} collections={collections} recipes={recipes} />
    </div>
  ) : selectedRecipe && currentRecipe ? (
    <div key={selectedRecipe} className={`editor-enter${isDesktop ? " desktop-content" : ""}`} style={{ flex: 1, overflow: isDesktop ? "hidden" : "auto", minHeight: 0 }}>
      <RecipeDetail recipe={currentRecipe} onBack={() => setSelectedRecipe(null)} onEdit={() => setEditingRecipe(currentRecipe)} onDelete={deleteRecipe} onAddToShopping={addToShopping} onAddToMealPlan={(r, date, portions, slot) => { setMealPlan(prev => ({ ...prev, [date]: [...(prev[date] || []), { recipeId: r.id, portions: portions || 1, slot: slot || "midi" }] })); notify("Ajouté au planning"); }} onExportJSON={exportJSON} onExportPDF={exportPDF} ingredientDB={ingredientDB} utensilDB={utensilDB} collections={collections} onUpdateCollections={setCollections} onToggleCollection={(recipeId, colId) => { setRecipes(prev => { const updated = prev.map(r => { if (r.id !== recipeId) return r; const cols = r.collections || []; const next = cols.includes(colId) ? cols.filter(c => c !== colId) : [...cols, colId]; return { ...r, collections: next }; }); setCollections(c => c.map(col => ({ ...col, count: updated.filter(r => (r.collections || []).includes(col.id)).length }))); return updated; }); }} />
    </div>
  ) : selectedRecipe && !currentRecipe && cloudLoaded.current ? (
    <RecipeNotFound onBack={() => navigate("/recipes")} />
  ) : tabContent;

  // Loading state
  if (user === undefined) return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <style>{`
        @keyframes loadingFadeIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        @keyframes loadingPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.7;transform:scale(0.97);}}
        .loading-root{
          min-height:100dvh;width:100%;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:0;
          background:var(--bg);position:relative;overflow:hidden;
        }
        .loading-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:0.13;pointer-events:none;}
        .loading-card{
          position:relative;z-index:1;display:flex;flex-direction:column;
          align-items:center;gap:0;
          animation:loadingFadeIn 0.5s cubic-bezier(0.25,0.46,0.45,0.94) both;
        }
        .loading-logo{
          font-family:var(--ff-display);font-size:28px;font-weight:500;
          letter-spacing:-0.02em;color:var(--text);margin-bottom:32px;
          animation:loadingPulse 2.4s ease-in-out infinite;
        }
        .loading-logo span{color:var(--accent);}
        .loading-spinner-wrap{position:relative;width:56px;height:56px;margin-bottom:28px;}
        .loading-spinner-track{
          position:absolute;inset:0;border-radius:50%;
          border:2.5px solid var(--border);
        }
        .loading-spinner{
          position:absolute;inset:0;border-radius:50%;
          border:2.5px solid transparent;
          border-top-color:var(--accent);
          border-right-color:var(--accent2);
          animation:spin 0.9s cubic-bezier(0.4,0,0.2,1) infinite;
        }
        .loading-emoji{
          position:absolute;inset:0;display:flex;align-items:center;
          justify-content:center;font-size:22px;
        }
        .loading-label{
          font-size:13px;color:var(--text3);font-family:var(--ff-body);
          font-weight:400;letter-spacing:0.01em;
        }
      `}</style>
      <div className={`loading-root${isDark ? "" : " light"}`}>
        <div className="loading-blob" style={{ width:320,height:320,background:"var(--accent)",top:"-60px",right:"-60px" }} />
        <div className="loading-blob" style={{ width:240,height:240,background:"#5b9cf6",bottom:"60px",left:"-50px" }} />
        <div className="loading-card">
          <div className="loading-logo">Mijoté<span>·</span></div>
          <div className="loading-spinner-wrap">
            <div className="loading-spinner-track" />
            <div className="loading-spinner" />
            <div className="loading-emoji">🫕</div>
          </div>
          <div className="loading-label">Connexion en cours…</div>
        </div>
      </div>
    </>
  );

  // Login screen
  if (!user) return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <style>{`
        @keyframes loginFloat{0%,100%{transform:translateY(0) rotate(-2deg);}50%{transform:translateY(-10px) rotate(2deg);}}
        @keyframes loginFadeUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
        .login-root{min-height:100dvh;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;background:var(--bg);position:relative;overflow:hidden;}
        .login-blob{position:absolute;border-radius:50%;filter:blur(80px);opacity:0.18;pointer-events:none;}
        .login-card{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:0;max-width:360px;width:100%;animation:loginFadeUp 0.6s cubic-bezier(0.25,0.46,0.45,0.94) both;}
        .login-emoji-wrap{display:flex;justify-content:center;margin-bottom:28px;}
        .login-emoji{font-size:72px;line-height:1;animation:loginFloat 4s ease-in-out infinite;display:block;}
        .login-tagline{font-family:var(--ff-display);font-size:26px;font-weight:500;letter-spacing:-0.03em;line-height:1.15;color:var(--text);text-align:center;margin-bottom:10px;}
        .login-tagline em{font-style:italic;color:var(--accent);}
        .login-sub{font-size:16px;font-family:var(--ff-display);font-style:italic;font-weight:300;color:var(--text2);text-align:center;line-height:1.65;margin-bottom:20px;width:100%;}
        .login-google-btn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;padding:16px 24px;border-radius:16px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:15px;font-family:var(--ff-body);font-weight:500;cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,0.25);transition:all 0.18s;margin-bottom:16px;}
        .login-google-btn:hover{background:var(--surface2);}
        .login-divider{display:flex;align-items:center;gap:12px;width:100%;margin-bottom:16px;}
        .login-divider-line{flex:1;height:1px;background:var(--border);}
        .login-feats{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px;}
        .login-feat{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;font-size:11px;font-weight:500;background:var(--surface);border:1px solid var(--border);color:var(--text3);}
        .login-theme-toggle{position:absolute;top:20px;right:20px;z-index:10;display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:30px;padding:6px 10px;cursor:pointer;font-size:12px;font-weight:500;color:var(--text2);transition:background 0.2s,border-color 0.2s;}
        .login-theme-toggle:hover{border-color:var(--accent);color:var(--text);}
        .login-toggle-track{width:32px;height:18px;border-radius:9px;background:var(--surface3);position:relative;transition:background 0.25s;flex-shrink:0;}
        .login-toggle-track.dark{background:var(--accent);}
        .login-toggle-thumb{position:absolute;top:3px;width:12px;height:12px;border-radius:50%;background:#fff;transition:left 0.22s cubic-bezier(0.34,1.56,0.64,1);}
        .login-toggle-thumb.dark{left:17px;}
        .login-toggle-thumb.light{left:3px;}
        .login-copyright{position:absolute;bottom:16px;right:20px;font-size:11px;color:var(--text3);line-height:1.5;text-align:right;pointer-events:none;}
      `}</style>
      <div className={`login-root${isDark ? "" : " light"}`}>
        {/* Theme toggle */}
        <button className="login-theme-toggle" onClick={toggleTheme} aria-label="Changer le thème">
          <span>{isDark ? "🌙" : "☀️"}</span>
          <div className={`login-toggle-track${isDark ? " dark" : ""}`}>
            <div className={`login-toggle-thumb${isDark ? " dark" : " light"}`} />
          </div>
        </button>
        {/* Decorative blobs */}
        <div className="login-blob" style={{ width: 340, height: 340, background: "var(--accent)", top: "-80px", right: "-80px" }} />
        <div className="login-blob" style={{ width: 260, height: 260, background: "#5b9cf6", bottom: "40px", left: "-60px" }} />
        <div className="login-card">
          <div className="login-emoji-wrap"><span className="login-emoji">🫕</span></div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 10, width: "100%" }}>
            <span style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text)", whiteSpace: "nowrap", flexShrink: 0 }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span></span>
            <div style={{ width: 1.5, alignSelf: "stretch", background: "var(--border)", borderRadius: 1, flexShrink: 0 }} />
            <h1 className="login-tagline" style={{ marginBottom: 0 }}>Cuisinez mieux,<br /><em>organisez moins.</em></h1>
          </div>
          <p className="login-sub">Toutes vos recettes, votre planning repas et vos courses — au même endroit, toujours avec vous.</p>
          <button className="login-google-btn" onClick={handleSignIn}>
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-3.59-13.46-8.72l-7.97 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
            Continuer avec Google
          </button>
          <div className="login-feats">
            {["📖 Recettes illimitées", "📅 Planning semaine", "🛒 Listes de courses", "☁️ Sync cloud"].map(f => (
              <span key={f} className="login-feat">{f}</span>
            ))}
          </div>

        </div>
        <p className="login-copyright">© 2026 Mijoté · Tous droits réservés</p>
      </div>
    </>
  );

  return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <div id="root" className={isDark ? "" : "light"}>
        {notification && (
          <div style={{ position: "fixed", top: 16, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 999, pointerEvents: "none" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: notification.type === "error" ? "var(--red)" : notification.type === "warning" ? "#e8920a" : notification.type === "info" ? "#4a90d9" : "var(--green)", color: "#fff", padding: "10px 18px 10px 12px", borderRadius: 30, fontSize: 13, fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.35)", whiteSpace: "nowrap", animation: "toastIn 0.22s cubic-bezier(0.25,0.46,0.45,0.94) both" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={notification.type === "error" ? "close" : notification.type === "warning" ? "warning" : notification.type === "info" ? "forward" : "check"} size={12} color="#fff" />
              </div>
              {notification.msg}
            </div>
          </div>
        )}
        {isDesktop ? (
          <>
            <DesktopSidebar tab={tab} setTab={requestTab} onNewRecipe={() => setEditingRecipe({ name: "", description: "", prepTime: 0, cookTime: 0, servings: 2, tags: [], ingredients: [], utensils: [], steps: [], collections: [], image: "" })} />
            {mainScreen}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <PullToRefresh
              enabled={!isDesktop && editingRecipe === null}
              threshold={110}
              onRefresh={() => window.location.reload()}
            >
              {mainScreen}
            </PullToRefresh>
            <TabBar tab={tab} setTab={requestTab} />
          </div>
        )}

        {/* Leave editor confirmation modal */}
        {pendingTab && (
          <SwipeableSheet onClose={() => setPendingTab(null)}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Quitter le formulaire ?</h3>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Les modifications non sauvegardées seront perdues. Tu peux sauvegarder d'abord en cliquant sur "Sauvegarder" en haut.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setPendingTab(null)}>Rester</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmLeaveEditor}>Quitter sans sauvegarder</button>
            </div>
          </SwipeableSheet>
        )}
      </div>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/recipes" replace />} />
      {/* Une seule instance d'AppInner pour toutes les routes de l'app : elle dérive
          l'onglet / la recette / la section depuis le pathname, ce qui évite tout
          remontage (et donc le flicker de l'écran de chargement) lors de la navigation. */}
      <Route path="*" element={<AppInner />} />
    </Routes>
  );
}

