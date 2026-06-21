import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation, Navigate, Routes, Route } from "react-router-dom";
import { createPortal } from "react-dom";
import { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, deleteDoc, onSnapshot, getDocs, query, where } from "firebase/firestore";
import React from 'react'

import { db, auth, provider } from "./lib/firebase.js";
import {
  metaDoc, sharedListsCol, sharedListDoc, userDirCol, userDirDoc,
  toSharedListDoc, loadMasterDB, loadUserData, migrateLegacyDoc, syncRecipes,
} from "./lib/firestore.js";
import { cleanRecipeForExport, validateRecipeSchema } from "./lib/recipeSchema.js";
import { deleteImageByUrl } from "./lib/storage.js";
import { computeNutriInfo } from "./lib/nutriscore.js";
import { findIngredientMatch, buildNameMatcher } from "./lib/nameMatcher.js";
import { normalizeStr, parseIngredientInput } from "./lib/parseIngredient.js";
import {
  DEFAULT_CATEGORIES, sortedCategoryEntries, SAMPLE_RECIPES, SAMPLE_COLLECTIONS,
} from "./constants/categories.js";
import { useLS } from "./hooks/useLS.js";
import { useIsDesktop } from "./hooks/useIsDesktop.js";
import { usePageZoom } from "./hooks/usePageZoom.js";
import { SwipeableSheet } from "./components/SwipeableSheet.jsx";
import { PullToRefresh } from "./components/PullToRefresh.jsx";
import { Icon } from "./components/Icon.jsx";
import { Img, IngImage } from "./components/Img.jsx";
import { NutriScoreBadge } from "./components/NutriScoreBadge.jsx";
import { ImageUpload } from "./components/ImageUpload.jsx";
import { UserAvatar } from "./components/UserAvatar.jsx";
import { TagInput } from "./components/TagInput.jsx";
import { AutoResizeTextarea } from "./components/AutoResizeTextarea.jsx";
import { RecipeCard } from "./components/RecipeCard.jsx";
import { RecipeNotFound } from "./components/RecipeNotFound.jsx";
import { NutritionModal } from "./components/NutritionModal.jsx";
import { ChangelogSection } from "./components/ChangelogSection.jsx";
import { ReadOnlyBanner, AdminBanner } from "./components/Banners.jsx";
import { UtensilPicker } from "./components/UtensilPicker.jsx";
import { DraggableStep } from "./components/DraggableStep.jsx";
import { IngredientDetail } from "./components/IngredientDetail.jsx";
import { TIP_TYPES } from "./constants/tipTypes.js";
import {
  ING_MD_COLUMNS, ING_MD_REQUIRED_LABELS, ING_MD_BOUNDS,
  splitMarkdownRow, parseIngredientsMarkdown,
} from "./lib/ingredientsMarkdown.js";
import { TabBar } from "./components/TabBar.jsx";
import { DesktopSidebar } from "./components/DesktopSidebar.jsx";
import { CookMode } from "./screens/CookMode.jsx";
import { HomeTab } from "./screens/HomeTab.jsx";
import { MealPlanTab } from "./screens/MealPlanTab.jsx";
import { FridgeTab } from "./screens/FridgeTab.jsx";
import { ShoppingTab } from "./screens/ShoppingTab.jsx";
import {
  TAB_BY_PATH, TAB_BY_ID, CONFIG_SECTION_BY_PATH, CONFIG_PATH_BY_SECTION,
} from "./constants/tabs.js";
import { fmtTime } from "./lib/format.js";

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

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
// ─── RECIPE DETAIL ────────────────────────────────────────────────────────────
function RecipeDetail({ recipe, onBack, onEdit, onDelete, onAddToShopping, onAddToMealPlan, onExportJSON, onExportPDF, ingredientDB, utensilDB, collections, onUpdateCollections, onToggleCollection }) {
  const navigate = useNavigate();
  const [servings, setServings] = useState(Math.min(24, recipe.servings || 2));
  const [activeTab, setActiveTab] = useState("Ingrédients");
  const isDesktop = useIsDesktop();
  const [showMealModal, setShowMealModal] = useState(false);
  const [mealDate, setMealDate] = useState(new Date().toISOString().slice(0, 10));
  const [mealPortions, setMealPortions] = useState(1);
  const [mealSlots, setMealSlots] = useState(["midi"]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCollModal, setShowCollModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [selectedIngs, setSelectedIngs] = useState([]);
  const [cookMode, setCookMode] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef(null);
  const isProgrammaticScroll = useRef(false);
  const mult = servings / (recipe.servings || 2);

  // Collapse the desktop actions panel when clicking anywhere outside it.
  useEffect(() => {
    if (!actionsOpen) return;
    const handlePointerDown = e => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) setActionsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [actionsOpen]);

  const scrollRef = useRef(null);
  const heroSentinelRef = useRef(null);
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const swipeStart = useRef(null);
  const TAB_ORDER = ["Ingrédients", "Ustensiles", "Étapes"];
  const swipeHandlers = {
    onTouchStart: e => { swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null }; },
    onTouchMove: e => {
      const s = swipeStart.current; if (!s || s.axis) return;
      const dx = Math.abs(e.touches[0].clientX - s.x), dy = Math.abs(e.touches[0].clientY - s.y);
      if (dx > 8 || dy > 8) s.axis = dx > dy ? "x" : "y";
    },
    onTouchEnd: e => {
      const s = swipeStart.current; swipeStart.current = null;
      if (!s || s.axis !== "x") return;
      const dx = e.changedTouches[0].clientX - s.x;
      const idx = TAB_ORDER.indexOf(activeTab);
      if (dx < -50 && idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1]);
      else if (dx > 50 && idx > 0) setActiveTab(TAB_ORDER[idx - 1]);
    },
  };

  useEffect(() => {
    const sentinel = heroSentinelRef.current;
    if (!sentinel || isDesktop) return;
    const obs = new IntersectionObserver(
      ([entry]) => setHeroCollapsed(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [isDesktop]);

  const getIngImage = (dbId, name) => ingredientDB.find(d => d.id === dbId)?.image || (name ? findIngredientMatch(name, ingredientDB)?.image || "" : "");
  const getUtImage = (dbId, name) => utensilDB.find(d => d.id === dbId)?.image || (name ? utensilDB.find(d => normalizeStr(d.name) === normalizeStr(name))?.image || "" : "");

  return (
    <div className="recipe-detail-root" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── DESKTOP HERO ── */}
      {isDesktop && (
      <div style={{ position: "relative", height: 160, flexShrink: 0, color: "#fff" }}>
        <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.2) 0%,transparent 35%,rgba(14,14,15,0.82) 100%)" }} />
        <button onClick={onBack} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="back" size={18} /></button>
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
          <button onClick={onEdit} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={16} /></button>
          <button onClick={() => onExportPDF(recipe)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="pdf" size={16} /></button>
          <button onClick={() => onExportJSON(recipe)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="download" size={16} /></button>
          <button onClick={() => setShowDeleteConfirm(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(224,82,82,0.55)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={16} /></button>
        </div>
        <div style={{ position: "absolute", bottom: 14, left: 20, right: 20 }}>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 2 }}>{recipe.name}</h1>
          {recipe.source && (
            <a href={recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.65)", textDecoration: "none", marginTop: 1, marginBottom: 8 }}>
              {(() => { try { return new URL(recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source).hostname.replace(/^www\./, ""); } catch { return recipe.source.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0]; } })()}
              <Icon name="externalLink" size={11} color="rgba(255,255,255,0.65)" />
            </a>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {recipe.tags?.map(t => <span key={t} className="tag" style={{ fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}>{t}</span>)}
            {(recipe.collections || []).map(cid => { const col = (collections || []).find(c => c.id === cid); return col ? <span key={cid} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: col.color + "33", color: col.color, border: `1px solid ${col.color}66` }}>{col.name}</span> : null; })}
            <button onClick={() => setShowCollModal(true)} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 500, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", gap: 4 }}><Icon name="plus" size={10} color="#fff" /> Collection</button>
          </div>
        </div>
      </div>
      )}

      {/* ── DESKTOP INFO BAR — carte arrondie façon mobile ── */}
      {isDesktop && (
      <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "stretch", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "10px 0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {/* Prép. */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <Icon name="clock" size={12} color="var(--text3)" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtTime(recipe.prepTime)}</span>
            </div>
            <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>Prép.</span>
          </div>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
          {/* Cuisson */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <Icon name="fire" size={12} color="var(--text3)" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtTime(recipe.cookTime)}</span>
            </div>
            <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>Cuisson</span>
          </div>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
          {/* Nutri-Score */}
          <button onClick={() => setShowNutrition(true)} title="Analyse nutritionnelle" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <NutriScoreBadge letter={recipe.nutriLetter} />
            </div>
            <span style={{ fontSize: 10, color: "var(--text3)", display: "flex", alignItems: "center", gap: 2, marginTop: 3 }}>Nutri-Score <Icon name="forward" size={9} color="var(--text3)" /></span>
          </button>
          <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
          {/* Portions */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <button onClick={() => setServings(s => Math.max(1, s - 1))} style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontSize: 15, border: "none", cursor: "pointer" }}>−</button>
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 18, textAlign: "center" }}>{servings}</span>
              <button onClick={() => setServings(s => Math.min(24, s + 1))} style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, border: "none", cursor: "pointer" }}>+</button>
            </div>
            <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>Portions</span>
          </div>
        </div>
      </div>
      )}

      {/* Desktop FAB */}
      {isDesktop && (
        <div ref={actionsRef} style={{ position: "fixed", right: 24, bottom: 28, zIndex: 60, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
          {actionsOpen ? (
            <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, minWidth: 232, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)", boxShadow: "0 16px 42px -8px rgba(0,0,0,0.28)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Actions</span>
                <button className="icon-btn-soft" title="Réduire" onClick={() => setActionsOpen(false)} style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", color: "var(--text3)" }}>
                  <Icon name="close" size={13} color="var(--text3)" />
                </button>
              </div>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => { setSelectedIngs(recipe.ingredients.map(i => i.id)); setShowShoppingModal(true); }}><Icon name="shopping" size={15} /> Courses</button>
              <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => setShowMealModal(true)}><Icon name="calendar" size={15} /> Planifier</button>
            </div>
          ) : (
            <button className="fab-toggle" title="Actions" onClick={() => setActionsOpen(true)} style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 26px -4px rgba(232,112,58,0.5)" }}>
              <Icon name="shopping" size={22} color="#fff" />
            </button>
          )}
        </div>
      )}

      {/* Desktop tabs */}
      {isDesktop && (
      <div className="detail-tabs-mobile" style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
        {["Ingrédients", "Ustensiles", "Étapes"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 500, color: activeTab === t ? "var(--accent)" : "var(--text3)", borderBottom: `2px solid ${activeTab === t ? "var(--accent)" : "transparent"}`, transition: "color 0.15s, border-color 0.15s" }}>{t}</button>
        ))}
      </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
        {/* ── MOBILE: scrollable hero + sticky bar + tabs + content ── */}
        <div className="detail-mobile-content" ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* Hero image — grand et beau */}
          <div style={{ position: "relative", height: 260, flexShrink: 0, color: "#fff" }}>
            <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.25) 0%,transparent 40%,rgba(0,0,0,0.72) 100%)" }} />
            {/* Boutons overlay */}
            <button onClick={onBack} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="back" size={18} color="#fff" /></button>
            <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
              <button onClick={onEdit} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="edit" size={16} color="#fff" /></button>
              <button onClick={() => onExportPDF(recipe)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="pdf" size={16} color="#fff" /></button>
              <button onClick={() => setShowDeleteConfirm(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(224,82,82,0.5)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="trash" size={16} color="#fff" /></button>
            </div>
            {/* Titre + source + tags */}
            <div style={{ position: "absolute", bottom: 16, left: 18, right: 18 }}>
              <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 4, color: "#fff" }}>{recipe.name}</h1>
              {recipe.source && (
                <a href={recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.65)", textDecoration: "none", marginBottom: 6 }}>
                  {(() => { try { return new URL(recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source).hostname.replace(/^www\./, ""); } catch { return recipe.source.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0]; } })()}
                  <Icon name="externalLink" size={10} color="rgba(255,255,255,0.65)" />
                </a>
              )}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                {recipe.tags?.map(t => <span key={t} className="tag" style={{ fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>{t}</span>)}
                {(recipe.collections || []).map(cid => { const col = (collections || []).find(c => c.id === cid); return col ? <span key={cid} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: col.color + "33", color: col.color, border: `1px solid ${col.color}66` }}>{col.name}</span> : null; })}
                <button onClick={() => setShowCollModal(true)} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 500, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><Icon name="plus" size={10} color="#fff" /> Collection</button>
              </div>
            </div>
          </div>

          {/* Sentinelle invisible juste sous le hero — dès qu'elle sort du viewport la barre compacte apparaît */}
          <div ref={heroSentinelRef} style={{ height: 1, flexShrink: 0 }} />

          {/* Barre compacte sticky */}
          <div style={{
            position: "sticky", top: 0, zIndex: 30, flexShrink: 0,
            background: heroCollapsed ? "rgba(var(--bg-rgb),0.85)" : "transparent",
            backdropFilter: heroCollapsed ? "blur(16px)" : "none",
            borderBottom: heroCollapsed ? "1px solid var(--border)" : "none",
            transition: "background 0.25s, border-color 0.25s",
            pointerEvents: heroCollapsed ? "auto" : "none",
            height: 52, marginTop: -52,
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px",
          }}>
            {heroCollapsed && <>
              <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="back" size={16} color="var(--text)" /></button>
              <span style={{ fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 500, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "0 8px", color: "var(--text)" }}>{recipe.name}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setSelectedIngs(recipe.ingredients.map(i => i.id)); setShowShoppingModal(true); }} style={{ height: 32, padding: "0 12px", borderRadius: 20, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, border: "none", cursor: "pointer" }}><Icon name="shopping" size={13} color="#fff" /> Courses</button>
              </div>
            </>}
          </div>

          {/* Infos + actions — remontés juste sous le hero, au-dessus des onglets */}
          <div style={{ padding: "16px 16px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", borderRadius: 16, padding: "14px 8px", marginBottom: 12, border: "1px solid var(--border)" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <Icon name="clock" size={13} color="var(--text3)" />
                <span style={{ fontSize: 15, fontWeight: 600 }}>{fmtTime(recipe.prepTime)}</span>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>Prép.</span>
              </div>
              <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <Icon name="fire" size={13} color="var(--text3)" />
                <span style={{ fontSize: 15, fontWeight: 600 }}>{fmtTime(recipe.cookTime)}</span>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>Cuisson</span>
              </div>
              <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
              <button onClick={() => setShowNutrition(true)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer" }}>
                <NutriScoreBadge letter={recipe.nutriLetter} />
                <span style={{ fontSize: 10, color: "var(--text3)", display: "flex", alignItems: "center", gap: 2 }}>Nutri-Score <Icon name="forward" size={9} color="var(--text3)" /></span>
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setSelectedIngs(recipe.ingredients.map(i => i.id)); setShowShoppingModal(true); }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 30, background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "var(--ff-body)", border: "none", cursor: "pointer" }}>
                <Icon name="shopping" size={14} color="#fff" /> Courses
              </button>
              <button onClick={() => setShowMealModal(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 30, background: "var(--surface2)", color: "var(--text)", fontSize: 13, fontWeight: 600, fontFamily: "var(--ff-body)", border: "1px solid var(--border)", cursor: "pointer" }}>
                <Icon name="calendar" size={14} color="var(--text)" /> Planifier
              </button>
            </div>
          </div>

          {/* Onglets sticky sous la barre */}
          <div style={{ position: "sticky", top: 52, zIndex: 29, background: "var(--surface)", borderBottom: "1px solid var(--border)", display: "flex", flexShrink: 0 }}>
            {TAB_ORDER.map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "11px 0", fontSize: 12, fontWeight: 500, color: activeTab === t ? "var(--accent)" : "var(--text3)", background: "none", border: "none", borderBottom: `2px solid ${activeTab === t ? "var(--accent)" : "transparent"}`, transition: "color 0.15s, border-color 0.15s", cursor: "pointer" }}>{t}</button>
            ))}
          </div>

          {/* Contenu selon onglet actif — swipe horizontal pour changer d'onglet */}
          <div {...swipeHandlers}>
          {activeTab === "Ingrédients" && (
            <div style={{ padding: "16px 16px 32px" }}>
              {/* Portions — pilote les quantités de la liste */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)", borderRadius: 14, padding: "12px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>Portions</span>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setServings(s => Math.max(1, s - 1))} style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontSize: 18, border: "none", cursor: "pointer" }}>−</button>
                  <span style={{ fontSize: 18, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{servings}</span>
                  <button onClick={() => setServings(s => Math.min(24, s + 1))} style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, border: "none", cursor: "pointer" }}>+</button>
                </div>
              </div>
              {/* Liste ingrédients */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recipe.ingredients.map(ing => (
                  <div key={ing.id} onClick={() => ing.dbId && navigate(`/config/ingredients/${encodeURIComponent(ing.dbId)}`)} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", borderRadius: 12, padding: "10px 14px", border: "1px solid var(--border)", cursor: ing.dbId ? "pointer" : "default" }}>
                    <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={50} />
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{ing.name}</div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>{+(ing.amount * mult).toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 4 }}>{ing.unit}</span>
                    </div>
                    {ing.dbId && <Icon name="forward" size={13} color="var(--text3)" />}
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === "Ustensiles" && (
            <div style={{ padding: "16px 16px 32px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(recipe.utensils || []).map(u => (
                  <div key={u.id} style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", padding: 14, gap: 8 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", background: "#fff" }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                    <span style={{ fontSize: 13, fontWeight: 500, textAlign: "center" }}>{u.name}</span>
                  </div>
                ))}
                {(!recipe.utensils || recipe.utensils.length === 0) && <p style={{ color: "var(--text3)", fontSize: 14, gridColumn: "1/-1" }}>Aucun ustensile.</p>}
              </div>
            </div>
          )}
          {activeTab === "Étapes" && (
            <div style={{ padding: "16px 16px 32px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {recipe.steps && recipe.steps.length > 0 && (
                  <button className="btn btn-primary" style={{ width: "100%", borderRadius: 14, padding: "13px 18px", fontSize: 15, fontWeight: 600, gap: 10 }} onClick={() => setCookMode(true)}>
                    <Icon name="fire" size={17} /> Mode pas à pas
                  </button>
                )}
                {(recipe.steps || []).map((step, i) => {
                  const linkedIngs = recipe.ingredients.filter(ing => step.ingredients?.includes(ing.id));
                  const linkedUts = (recipe.utensils || []).filter(u => step.utensils?.includes(u.id));
                  const hasPills = linkedIngs.length > 0 || linkedUts.length > 0;
                  return (
                    <div key={step.id} style={{ background: "var(--surface)", borderRadius: 14, padding: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: step.text ? 8 : hasPills ? 10 : 0 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>Étape {i + 1}</span>
                      </div>
                      {step.text && (
                        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: hasPills ? 10 : 0, wordBreak: "break-word", overflowWrap: "break-word" }}>{step.text}</p>
                      )}
                      {hasPills && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                          {linkedIngs.map(ing => (
                            <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)", border: "1px solid var(--border)" }}>
                              <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={22} />
                              {ing.name}
                              <span style={{ color: "var(--text3)", fontWeight: 400, marginLeft: 2 }}>{+(ing.amount * mult).toFixed(2)}{ing.unit}</span>
                            </span>
                          ))}
                          {linkedUts.map(u => (
                            <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)", border: "1px solid var(--border)" }}>
                              <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                              {u.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>{/* end swipe wrapper */}
        </div>


        {/* ── DESKTOP: 2-column layout (hidden on mobile via CSS) ── */}
        <div className="detail-desktop-content" style={{ display: "none", flex: 1, overflow: "hidden", background: "var(--bg)", padding: "12px 16px 16px", gap: 16 }}>
          {/* Left col: ingrédients + ustensiles (card) */}
          <div style={{ width: 300, minWidth: 300, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", minHeight: 34, marginBottom: 16 }}>
                <span style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text)" }}>Ingrédients</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {recipe.ingredients.map(ing => (
                  <div key={ing.id} onClick={() => ing.dbId && navigate(`/config/ingredients/${encodeURIComponent(ing.dbId)}`)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: ing.dbId ? "pointer" : "default", borderRadius: 10, padding: "4px 6px", margin: "-4px -6px", transition: "background 0.15s" }} onMouseEnter={e => { if (ing.dbId) e.currentTarget.style.background = "var(--surface2)"; }} onMouseLeave={e => { e.currentTarget.style.background = ""; }}>
                    <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={48} />
                    <div style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{+(ing.amount * mult).toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 2 }}>{ing.unit}</span>
                    </div>
                    <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{ing.name}</div>
                  </div>
                ))}
              </div>
            </div>
            {recipe.utensils && recipe.utensils.length > 0 && (
              <div>
                <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text)", marginBottom: 12 }}>Ustensiles</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {recipe.utensils.map(u => (
                    <div key={u.id} className="ut-pill-desktop" style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface2)", borderRadius: 12, padding: "7px 14px 7px 8px", border: "1px solid var(--border)" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
          {/* Right col: étapes (card) */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 20, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 34, marginBottom: 16 }}>
              <span style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text)" }}>Étapes</span>
              {recipe.steps && recipe.steps.length > 0 && (
                <button className="btn btn-primary btn-sm" style={{ gap: 7, borderRadius: 10 }} onClick={() => setCookMode(true)}>
                  <Icon name="fire" size={13} /> Mode pas à pas
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              {(recipe.steps || []).map((step, i) => {
                const linkedIngs = recipe.ingredients.filter(ing => step.ingredients?.includes(ing.id));
                const linkedUts = (recipe.utensils || []).filter(u => step.utensils?.includes(u.id));
                return (
                  <div key={step.id}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>Étape {i + 1}</div>
                    {step.text && <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, marginBottom: 12, wordBreak: "break-word", overflowWrap: "break-word" }}>{step.text}</p>}
                    {(linkedIngs.length > 0 || linkedUts.length > 0) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {linkedIngs.map(ing => (
                          <span key={ing.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                            <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={24} />
                            {ing.name}
                            <span style={{ color: "var(--text3)", fontWeight: 500 }}>{+(ing.amount * mult).toFixed(2)}{ing.unit}</span>
                          </span>
                        ))}
                        {linkedUts.map(u => (
                          <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                            {u.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── COOK MODE — fullscreen step-by-step ── */}
      {showNutrition && (
        <NutritionModal recipe={recipe} ingredientDB={ingredientDB} servings={servings} onClose={() => setShowNutrition(false)} />
      )}
      {cookMode && recipe.steps?.length > 0 && (
        <CookMode recipe={recipe} mult={mult} ingredientDB={ingredientDB} utensilDB={utensilDB} onClose={() => setCookMode(false)} />
      )}

      {/* Shopping ingredient selection modal */}
      {showShoppingModal && (
        <SwipeableSheet onClose={() => setShowShoppingModal(false)} style={{ maxHeight: "85dvh" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Ajouter aux courses</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>Décoche les ingrédients que tu as déjà.</p>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <button style={{ fontSize: 12, color: "var(--accent)" }} onClick={() => setSelectedIngs(recipe.ingredients.map(i => i.id))}>Tout sélectionner</button>
            <button style={{ fontSize: 12, color: "var(--text3)" }} onClick={() => setSelectedIngs([])}>Tout décocher</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", maxHeight: "52vh", marginBottom: 16 }}>
            {recipe.ingredients.map(ing => {
              const selected = selectedIngs.includes(ing.id);
              return (
                <button key={ing.id} onClick={() => setSelectedIngs(prev => selected ? prev.filter(x => x !== ing.id) : [...prev, ing.id])}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12,
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    textAlign: "left", transition: "opacity 0.15s", opacity: selected ? 1 : 0.4
                  }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: selected ? "var(--accent)" : "transparent",
                    border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {selected && <Icon name="check" size={11} color="#fff" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{ing.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 8 }}>{+(ing.amount * mult).toFixed(2)} {ing.unit}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }}
            disabled={selectedIngs.length === 0}
            onClick={() => { onAddToShopping(recipe, recipe.ingredients.filter(i => selectedIngs.includes(i.id)), mult); setShowShoppingModal(false); }}>
            <Icon name="shopping" size={15} /> Ajouter {selectedIngs.length > 0 ? `${selectedIngs.length} article${selectedIngs.length > 1 ? "s" : ""}` : ""}
          </button>
        </SwipeableSheet>
      )}

      {showMealModal && (
        <SwipeableSheet onClose={() => setShowMealModal(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Ajouter au planning</h3>
          <div className="field-label">Date</div>
          <input type="date" className="field-input" value={mealDate} onChange={e => setMealDate(e.target.value)} style={{ marginBottom: 12 }} />
          <div className="field-label" style={{ marginBottom: 8 }}>Repas (multi-sélection)</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["midi", "🌤 Midi", "var(--yellow)"], ["soir", "🌙 Soir", "var(--blue)"]].map(([slot, label, col]) => {
              const active = mealSlots.includes(slot);
              const toggle = () => setMealSlots(prev => {
                const next = active ? prev.filter(s => s !== slot) : [...prev, slot];
                return next.length ? next : prev;
              });
              return (
                <button key={slot} onClick={toggle} style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: active ? col : "var(--surface2)", color: active ? "#000" : "var(--text2)", border: `2px solid ${active ? col : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}>
                  {active && <Icon name="check" size={14} color="#000" />}
                  {label}
                </button>
              );
            })}
          </div>
          {mealSlots.length === 2 && <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10, textAlign: "center" }}>Ajouté au midi ET au soir</div>}
          <div className="field-label">Étaler sur X jours consécutifs</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setMealPortions(p => Math.max(1, p - 1))} className="btn btn-ghost btn-sm" style={{ width: 34, height: 34, borderRadius: "50%", padding: 0 }}>−</button>
            <span style={{ fontSize: 18, fontWeight: 700, minWidth: 30, textAlign: "center" }}>{mealPortions}</span>
            <button onClick={() => setMealPortions(p => p + 1)} className="btn btn-ghost btn-sm" style={{ width: 34, height: 34, borderRadius: "50%", padding: 0 }}>+</button>
            <span style={{ fontSize: 12, color: "var(--text2)", flex: 1 }}>{mealPortions > 1 ? `${recipe.servings} portions ÷ ${mealPortions} jours = ${(recipe.servings / mealPortions).toFixed(1)} p/j` : "Toutes les portions ce jour"}</span>
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => {
            for (let d = 0; d < mealPortions; d++) {
              const dt = new Date(mealDate + "T12:00:00"); dt.setDate(dt.getDate() + d);
              const dateStr = dt.toISOString().slice(0, 10);
              mealSlots.forEach(slot => onAddToMealPlan(recipe, dateStr, mealPortions, slot));
            }
            setShowMealModal(false);
          }}><Icon name="check" size={16} /> Confirmer</button>
        </SwipeableSheet>
      )}
      {showDeleteConfirm && (
        <SwipeableSheet onClose={() => setShowDeleteConfirm(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Supprimer la recette ?</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20 }}>Retirer cette recette la supprimera définitivement des recettes enregistrées.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>Annuler</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { onDelete(recipe.id); setShowDeleteConfirm(false); }}>Supprimer</button>
          </div>
        </SwipeableSheet>
      )}
      {showCollModal && (
        <SwipeableSheet onClose={() => setShowCollModal(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Collections</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Sélectionne les collections pour <strong>{recipe.name}</strong></p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {(collections || []).map(col => {
              const active = (recipe.collections || []).includes(col.id);
              return (
                <button key={col.id} onClick={() => onToggleCollection(recipe.id, col.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: active ? col.color + "22" : "var(--surface2)", border: `1.5px solid ${active ? col.color : "var(--border)"}`, transition: "all 0.15s" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, textAlign: "left", color: active ? col.color : "var(--text)" }}>{col.name}</span>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: active ? col.color : "transparent", border: `2px solid ${active ? col.color : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {active && <Icon name="check" size={12} color="#fff" />}
                  </div>
                </button>
              );
            })}
            {(!collections || collections.length === 0) && <p style={{ color: "var(--text3)", fontSize: 13 }}>Aucune collection. Créez-en dans l'onglet Config.</p>}
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setShowCollModal(false)}>Fermer</button>
        </SwipeableSheet>
      )}
    </div>
  );
}





// ─── RECIPE EDITOR ────────────────────────────────────────────────────────────

function RecipeEditor({ recipe, onSave, onCancel, ingredientDB, utensilDB, collections, recipes }) {
  const [form, setForm] = useState({ ...recipe, ingredients: recipe.ingredients || [], utensils: recipe.utensils || [], steps: recipe.steps || [], tags: recipe.tags || [], collections: recipe.collections || [] });
  const [section, setSection] = useState("info");
  const up = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // Un ingrédient renseigné doit avoir une quantité strictement positive.
  const ingIsMissingQty = ing => (ing.name || ing.dbId) && !(Number(ing.amount) > 0);
  const handleSave = () => {
    if (form.ingredients.some(ingIsMissingQty)) setSection("ingrédients");
    onSave(form);
  };

  // Ingredients
  const addIng = () => {
    up("ingredients", [...form.ingredients, { id: "i" + Date.now(), dbId: "", name: "", amount: "", unit: "", _raw: "" }]);
  };
  const updIng = (id, f, v) => up("ingredients", form.ingredients.map(i => i.id === id ? { ...i, [f]: v } : i));
  const remIng = id => up("ingredients", form.ingredients.filter(i => i.id !== id));

  // Utensils
  const addUt = () => {
    const first = utensilDB[0];
    up("utensils", [...form.utensils, { id: "u" + Date.now(), dbId: first?.id || "", name: first?.name || "" }]);
  };
  const updUt = (id, f, v) => up("utensils", form.utensils.map(u => u.id === id ? { ...u, [f]: v } : u));
  const remUt = id => up("utensils", form.utensils.filter(u => u.id !== id));

  // Steps with drag reorder
  const addStep = () => up("steps", [...form.steps, { id: "s" + Date.now(), title: "", text: "", ingredients: [], utensils: [] }]);
  const updStep = (id, f, v) => up("steps", form.steps.map(s => s.id === id ? { ...s, [f]: v } : s));
  const remStep = id => up("steps", form.steps.filter(s => s.id !== id));
  const moveStep = (fromIdx, toIdx) => {
    const arr = [...form.steps];
    const [removed] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, removed);
    up("steps", arr);
  };

  const dragRef = useRef(null);
  const isProgrammaticScroll = useRef(false);
  const scrollTimer = useRef(null);

  return (
    <div className="editor-enter" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
        <button onClick={onCancel}><Icon name="close" size={20} /></button>
        <h2 style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>{recipe.id ? "Modifier" : (form.name.trim() || "Nouvelle recette")}</h2>
        <button className="btn btn-primary" style={{ padding: "8px 16px" }} onClick={handleSave}><Icon name="check" size={15} /> Sauvegarder</button>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, overflowX: "auto" }}>
        {["info", "ingrédients", "ustensiles", "étapes"].map((s, i) => (
          <button key={s} onClick={() => {
            setSection(s);
            const el = document.getElementById("editor-swiper");
            if (el) {
              isProgrammaticScroll.current = true;
              clearTimeout(scrollTimer.current);
              el.scrollTo({ left: i * el.offsetWidth, behavior: "smooth" });
              scrollTimer.current = setTimeout(() => { isProgrammaticScroll.current = false; }, 350);
            }
          }} style={{ flexShrink: 0, padding: "10px 16px", fontSize: 12, fontWeight: 500, color: section === s ? "var(--accent)" : "var(--text3)", borderBottom: `2px solid ${section === s ? "var(--accent)" : "transparent"}`, textTransform: "capitalize", transition: "color 0.15s, border-color 0.15s" }}>{s}</button>
        ))}
      </div>
      <div id="editor-swiper"
        onTouchStart={e => {
          const el = e.currentTarget;
          el._touchStartX = e.touches[0].clientX;
          el._touchStartY = e.touches[0].clientY;
          el._lockAxis = null;
        }}
        onTouchMove={e => {
          const el = e.currentTarget;
          if (el._lockAxis === null) {
            const dx = Math.abs(e.touches[0].clientX - el._touchStartX);
            const dy = Math.abs(e.touches[0].clientY - el._touchStartY);
            if (dx > 6 || dy > 6) el._lockAxis = dx > dy ? "x" : "y";
          }
          if (el._lockAxis === "y") el.style.overflowX = "hidden";
          else el.style.overflowX = "auto";
        }}
        onTouchEnd={e => { e.currentTarget.style.overflowX = "auto"; }}
        onScroll={e => {
          if (isProgrammaticScroll.current) return;
          const idx = Math.round(e.target.scrollLeft / e.target.offsetWidth);
          setSection(["info", "ingrédients", "ustensiles", "étapes"][idx]);
        }} style={{ flex: 1, display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>

        {/* Slide 1 — Info */}
        <div style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto", padding: 20 }}>
          {(
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><div className="field-label">Nom <span style={{ color: "var(--accent2)" }}>*</span></div><input className="field-input" placeholder="ex: Tarte Tatin" value={form.name} onChange={e => up("name", e.target.value)} /></div>
              <div><div className="field-label">Source</div><input className="field-input" placeholder="marmiton.org…" value={form.source || ""} onChange={e => up("source", e.target.value)} /></div>
              <div>
                <div className="field-label">Photo principale</div>
                <ImageUpload value={form.image} onChange={v => up("image", v)} style={{ height: 140 }} pathPrefix="recipes" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div><div className="field-label">Prép. (min)</div><input className="field-input" type="number" min="0" value={form.prepTime} onChange={e => up("prepTime", +e.target.value)} /></div>
                <div><div className="field-label">Cuisson (min)</div><input className="field-input" type="number" min="0" value={form.cookTime} onChange={e => up("cookTime", +e.target.value)} /></div>
                <div><div className="field-label">Portions</div><input className="field-input" type="number" min="1" max="24" value={form.servings} onChange={e => up("servings", Math.min(24, Math.max(1, +e.target.value)))} /></div>
              </div>
              <TagInput tags={form.tags || []} onChange={v => up("tags", v)} allTags={[...new Set(recipes?.flatMap(r => r.tags || []) || [])]} />
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Collections</div>
                {collections.length === 0 && <p style={{ fontSize: 12, color: "var(--text3)" }}>Aucune collection — créez-en dans Config.</p>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {collections.map(col => {
                    const active = (form.collections || []).includes(col.id);
                    return (
                      <button key={col.id} onClick={() => up("collections", active ? (form.collections || []).filter(id => id !== col.id) : [...(form.collections || []), col.id])}
                        style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: active ? col.color : "var(--surface2)", color: active ? "#fff" : "var(--text2)", border: `1px solid ${active ? col.color : "var(--border)"}`, display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
                        {active && <Icon name="check" size={11} color="#fff" />}
                        {col.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div style={{ height: 20 }} />
        </div>

        {/* Slide 2 — Ingrédients */}
        <div style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {form.ingredients.map(ing => (
              <div key={ing.id} style={{ background: "var(--surface)", borderRadius: 12, padding: 12, border: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <input className="field-input" placeholder="ex: 500g pois chiches, 2 oeufs, 1 c. à soupe huile…"
                    value={ing._raw !== undefined ? ing._raw : ""}
                    onChange={e => {
                      const raw = e.target.value;
                      const parsed = parseIngredientInput(raw);
                      const match = parsed.name ? findIngredientMatch(parsed.name, ingredientDB) : null;
                      up("ingredients", form.ingredients.map(x => x.id === ing.id ? {
                        ...x, _raw: raw, name: parsed.name, amount: parsed.amount, unit: parsed.unit,
                        dbId: match ? match.id : ""
                      } : x));
                    }}
                    style={{ marginBottom: 0 }} />
                  {(ing.name || ing.amount) && (
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {ing.dbId && (() => {
                        const img = ingredientDB.find(d => d.id === ing.dbId)?.image;
                        return img ? <IngImage src={img} alt={ing.name} size={32} /> : null;
                      })()}
                      {Number(ing.amount) > 0
                        ? <span style={{ fontSize: 11, background: "rgba(240,192,96,0.15)", color: "var(--yellow)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Quantité : {ing.amount}</span>
                        : <span style={{ fontSize: 11, background: "rgba(224,82,82,0.12)", color: "#c04040", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>⚠ Quantité manquante</span>}
                      {ing.unit && <span style={{ fontSize: 11, background: "rgba(91,156,246,0.15)", color: "var(--blue)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Unité : {ing.unit}</span>}
                      {ing.name && <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--text2)", borderRadius: 8, padding: "2px 8px" }}>{ing.name}</span>}
                      {ing.dbId
                        ? <span style={{ fontSize: 11, background: "rgba(76,175,125,0.15)", color: "var(--green)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>✓ Ingrédient reconnu</span>
                        : ing.name ? <span style={{ fontSize: 11, background: "rgba(224,82,82,0.12)", color: "#c04040", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>✕ Non référencé</span> : null}
                    </div>
                  )}
                </div>
                <button onClick={() => remIng(ing.id)} style={{ flexShrink: 0, paddingTop: 10 }}><Icon name="trash" size={14} color="var(--red)" /></button>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ width: "100%" }} onClick={addIng}><Icon name="plus" size={16} /> Ajouter un ingrédient</button>
          </div>
          <div style={{ height: 20 }} />
        </div>

        {/* Slide 3 — Ustensiles */}
        <UtensilPicker utensilDB={utensilDB} selected={form.utensils} onChange={v => up("utensils", v)} />

        {/* Slide 4 — Étapes */}
        <div style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text3)", background: "var(--surface2)", padding: "8px 12px", borderRadius: 10 }}>
              ↕ Glissez les étapes pour les réorganiser
            </div>
            {form.steps.map((step, i) => (
              <DraggableStep key={step.id} step={step} index={i} total={form.steps.length}
                ingredients={form.ingredients} utensils={form.utensils}
                onUpdate={updStep} onRemove={remStep} onMove={moveStep} />
            ))}
            <button className="btn btn-ghost" style={{ width: "100%" }} onClick={addStep}><Icon name="plus" size={16} /> Ajouter une étape</button>
          </div>
          <div style={{ height: 20 }} />
        </div>

      </div>
    </div>
  );
}


// ─── CONFIG TAB ───────────────────────────────────────────────────────────────





function ConfigTab({ ingredientDB, setIngredientDB, utensilDB, setUtensilDB, collections, setCollections, recipes, onExportAll, onImport, isDark, onToggleTheme, user, onSignOut, syncStatus, isAdmin, categories = DEFAULT_CATEGORIES, setCategories }) {
  const navigate = useNavigate();
  const location = useLocation();
  const configSectionParam = location.pathname.startsWith("/config/")
    ? location.pathname.slice(8) || undefined
    : undefined;
  const section = CONFIG_SECTION_BY_PATH[configSectionParam] || "ingredients";
  // Fiche ingrédient : /config/ingredients/{id}
  const ingDetailMatch = location.pathname.match(/^\/config\/ingredients\/(.+)$/);
  const ingDetailId = ingDetailMatch ? decodeURIComponent(ingDetailMatch[1]) : null;
  const setSection = (s) => navigate(`/config/${CONFIG_PATH_BY_SECTION[s] || "ingredients"}`, { replace: true });
  useEffect(() => {
    if (!configSectionParam) navigate("/config/ingredients", { replace: true });
  }, [configSectionParam]);
  const [editIng, setEditIng] = useState(null);
  const [editUt, setEditUt] = useState(null);
  const [editCol, setEditCol] = useState(null);
  const [editCat, setEditCat] = useState(null); // { key, label, score(0-100), color, icon, isNew }
  const [confirmDelCat, setConfirmDelCat] = useState(null); // { key, label }
  const [confirmDel, setConfirmDel] = useState(null); // { type: "ing" | "ut", item }
  const [dragCat, setDragCat] = useState(null); // key being dragged
  const [overCat, setOverCat] = useState(null); // key currently hovered as drop target
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [openCats, setOpenCats] = useState({});
  const fileRef = useRef();
  const [mdError, setMdError] = useState("");
  const [mdInfo, setMdInfo] = useState("");
  const [mdDragOver, setMdDragOver] = useState(false);
  const mdFileRef = useRef();
  const toggleCat = k => setOpenCats(p => ({ ...p, [k]: !p[k] }));

  const saveIng = raw => {
    // Conseils : on retire les lignes vides, on supprime le champ si plus rien.
    const tips = (raw.tips || []).map(t => ({ type: t.type, text: (t.text || "").trim() })).filter(t => t.text);
    const item = { ...raw };
    if (tips.length) item.tips = tips; else delete item.tips;
    if (ingredientDB.find(d => d.id === item.id)) setIngredientDB(prev => prev.map(d => d.id === item.id ? item : d));
    else setIngredientDB(prev => [...prev, { ...item, id: "db_i" + Date.now() }]);
    setEditIng(null);
  };
  const delIng = id => {
    const item = ingredientDB.find(d => d.id === id);
    if (item?.image) deleteImageByUrl(item.image);
    setIngredientDB(prev => prev.filter(d => d.id !== id));
  };
  const saveUt = item => {
    if (utensilDB.find(d => d.id === item.id)) setUtensilDB(prev => prev.map(d => d.id === item.id ? item : d));
    else setUtensilDB(prev => [...prev, { ...item, id: "db_u" + Date.now() }]);
    setEditUt(null);
  };
  const delUt = id => {
    const item = utensilDB.find(d => d.id === id);
    if (item?.image) deleteImageByUrl(item.image);
    setUtensilDB(prev => prev.filter(d => d.id !== id));
  };

  // ── Categories (admin only) — score entered on 0-100, stored on 0-10 scale ──
  const slugifyCat = (label) => "cat_" + label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 32);
  const saveCat = (form) => {
    const label = (form.label || "").trim();
    if (!label) return;
    let key = form.key;
    if (form.isNew) {
      key = slugifyCat(label) || ("cat_" + Date.now());
      if (categories[key]) key = key + "_" + Date.now().toString(36).slice(-4);
    }
    const entry = {
      label,
      score: Math.max(0, Math.min(10, Math.round((Number(form.score) || 0) / 10))),
      color: form.color || "#9a9490",
      icon: form.icon || "📦",
      order: form.isNew
        ? (Math.max(-1, ...Object.values(categories).map(c => c.order ?? 0)) + 1)
        : (categories[key]?.order ?? Object.keys(categories).length),
    };
    setCategories(prev => ({ ...prev, [key]: entry }));
    setEditCat(null);
  };
  const delCat = (key) => {
    const inUse = ingredientDB.filter(d => (d.category || "other") === key).length;
    if (inUse > 0) return; // guarded in UI too
    setCategories(prev => { const next = { ...prev }; delete next[key]; return next; });
  };
  // Reorder categories by drag & drop: move `fromKey` to the position of `toKey`.
  const moveCategory = (fromKey, toKey) => {
    if (fromKey === toKey) return;
    const ordered = sortedCategoryEntries(categories).map(([k]) => k);
    const from = ordered.indexOf(fromKey), to = ordered.indexOf(toKey);
    if (from < 0 || to < 0) return;
    ordered.splice(to, 0, ordered.splice(from, 1)[0]);
    setCategories(prev => {
      const next = { ...prev };
      ordered.forEach((k, i) => { next[k] = { ...next[k], order: i }; });
      return next;
    });
  };

  // Export Markdown COMPLET de toute la base d'ingrédients (admin/master).
  // Toutes les colonnes de ING_MD_COLUMNS (identité + nutrition). Aller-retour
  // fidèle : le fichier produit est réimportable tel quel. Trié par catégorie puis nom.
  const exportIngredientsMarkdown = () => {
    const esc = s => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
    const cell = (r, col) => {
      if (col.nut) { const v = r.nutrition?.[col.key]; return v == null || v === "" ? "" : esc(v); }
      if (col.key === "aliases") return esc((r.aliases || []).join(", "));
      if (col.key === "category") return esc(r.category || "other");
      return esc(r[col.key]);
    };
    const order = sortedCategoryEntries(categories).map(([k]) => k);
    const rows = [...ingredientDB].sort((a, b) => {
      const ca = order.indexOf(a.category || "other"), cb = order.indexOf(b.category || "other");
      return ca !== cb ? ca - cb : (a.name || "").localeCompare(b.name || "", "fr");
    });
    const header = `| ${ING_MD_COLUMNS.map(c => c.label).join(" | ")} |\n|${ING_MD_COLUMNS.map(() => "---").join("|")}|`;
    const body = rows.map(r => `| ${ING_MD_COLUMNS.map(c => cell(r, c)).join(" | ")} |`).join("\n");
    const md = `# Base d'ingrédients Mijoté (${rows.length})\n\nValeurs nutritionnelles pour 100g. Oméga-3 inclus dans les lipides. \`Légume\` est recalculé depuis la catégorie à l'import.\n\n${header}\n${body}\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = "ingredients_mijote.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Import Markdown : réinjecte / met à jour la base. Match par dbid sinon par nom.
  const importIngredientsMarkdown = (text) => {
    setMdInfo("");
    // 1. Garde-fou en-tête : le fichier doit ressembler à un export Mijoté.
    const headerOk = (text || "").split(/\r?\n/).some(l =>
      /\|/.test(l) && (() => {
        const cells = splitMarkdownRow(l).map(c => c.toLowerCase());
        return ING_MD_REQUIRED_LABELS.every(lbl => cells.includes(lbl));
      })());
    if (!headerOk) {
      setMdError("Fichier non reconnu : il doit contenir un tableau exporté depuis Mijoté (colonnes Nom, dbid, Catégorie, kcal…). Import annulé pour protéger la base.");
      return;
    }
    const parsed = parseIngredientsMarkdown(text);
    if (!parsed.length) { setMdError("Aucun ingrédient reconnu dans le fichier Markdown."); return; }

    // 2. Validation stricte ligne par ligne. Au moindre problème on annule TOUT
    //    l'import : pas d'écrasement partiel de la base master.
    const validCats = new Set(Object.keys(categories));
    const errors = [];
    parsed.forEach(row => {
      const where = `« ${row.name || "?"} »`;
      if (!row.name || row.name.length > 120) errors.push(`${where} : nom manquant ou trop long.`);
      if (row.category && !validCats.has(row.category)) errors.push(`${where} : catégorie inconnue « ${row.category} ».`);
      const nut = row.nutrition || {};
      Object.entries(ING_MD_BOUNDS).forEach(([k, [min, max]]) => {
        const v = k === "gramsPerPiece" ? row.gramsPerPiece : nut[k];
        if (v != null && (typeof v !== "number" || Number.isNaN(v) || v < min || v > max))
          errors.push(`${where} : ${k} = ${v} hors bornes (${min}–${max}).`);
      });
    });
    if (errors.length) {
      setMdError(`Import annulé — ${errors.length} erreur${errors.length > 1 ? "s" : ""} : ` + errors.slice(0, 3).join(" ") + (errors.length > 3 ? " …" : ""));
      return;
    }

    let created = 0, updated = 0;
    setIngredientDB(prev => {
      const next = [...prev];
      const idxById = new Map(next.map((d, i) => [d.id, i]));
      const idxByName = new Map(next.map((d, i) => [normalizeStr(d.name), i]));
      parsed.forEach((row, n) => {
        let idx = (row.id != null && idxById.has(row.id)) ? idxById.get(row.id)
          : idxByName.has(normalizeStr(row.name)) ? idxByName.get(normalizeStr(row.name)) : -1;
        if (idx >= 0) {
          const cur = next[idx];
          next[idx] = { ...cur, ...row, id: cur.id, nutrition: row.nutrition || cur.nutrition };
          updated++;
        } else {
          const id = "db_i" + Date.now() + "_" + n;
          const item = { ...row, id };
          next.push(item);
          idxById.set(id, next.length - 1);
          idxByName.set(normalizeStr(row.name), next.length - 1);
          created++;
        }
      });
      return next;
    });
    setMdError("");
    setMdInfo(`${created} créé${created > 1 ? "s" : ""}, ${updated} mis à jour.`);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {ingDetailId ? (
        <IngredientDetail
          ingredient={ingredientDB.find(d => d.id === ingDetailId)}
          ingredientDB={ingredientDB}
          categories={categories}
          isAdmin={isAdmin}
          onBack={() => navigate(-1)}
          onEdit={() => { const it = ingredientDB.find(d => d.id === ingDetailId); if (it) setEditIng({ ...it }); }}
          onDelete={() => { const it = ingredientDB.find(d => d.id === ingDetailId); if (it) setConfirmDel({ type: "ing", item: it }); }}
        />
      ) : (
      <>
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Configuration</h1>
            <span className="app-brand" style={{ fontSize: 11, fontWeight: 500, color: "var(--text3)", letterSpacing: "0.04em", fontFamily: "var(--ff-body)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span> <span style={{ opacity: 0.5 }}>{`v${__APP_VERSION__}`}</span></span>
          </div>
          <UserAvatar user={user} syncStatus={syncStatus} onSignOut={onSignOut} isDark={isDark} onToggleTheme={onToggleTheme} />
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 0, overflowX: "auto", paddingBottom: 0 }}>
          {["ingredients", "ustensiles", "collections", "données", "nouveautés"].map(s => (
            <button key={s} onClick={() => setSection(s)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: section === s ? "var(--accent)" : "var(--surface2)", color: section === s ? "#fff" : "var(--text2)", border: `1px solid ${section === s ? "transparent" : "var(--border)"}` }}>
              {s === "ingredients" ? "Ingrédients" : s === "ustensiles" ? "Ustensiles" : s === "collections" ? "Collections" : s === "données" ? "Données" : "Changelog"}
            </button>
          ))}
        </div>
        {/* Compteur + bannière admin : figés avec l'en-tête (restent visibles au scroll), pour Ingrédients et Ustensiles */}
        {(section === "ingredients" || section === "ustensiles") && (() => {
          const n = section === "ingredients" ? ingredientDB.length : utensilDB.length;
          const noun = section === "ingredients" ? "ingrédient" : "ustensile";
          return (
            <div style={{ paddingTop: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12, color: "var(--text2)", padding: "0 2px", marginBottom: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", fontFamily: "var(--ff-display)" }}>{n}</span>
                <span>{noun}{n > 1 ? "s" : ""} dans la base</span>
              </div>
              {isAdmin ? <AdminBanner style={{ marginBottom: 16 }} /> : <ReadOnlyBanner style={{ marginBottom: 16 }} />}
            </div>
          );
        })()}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
        {section === "ingredients" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sortedCategoryEntries(categories).map(([catKey, cat], ci) => {
              const catIngs = ingredientDB.filter(d => d.category === catKey)
                .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" }));
              const isOpen = openCats[catKey];
              return (
                <div key={catKey} className="slide-up"
                  draggable={isAdmin}
                  onDragStart={isAdmin ? (e) => { setDragCat(catKey); e.dataTransfer.effectAllowed = "move"; } : undefined}
                  onDragOver={isAdmin ? (e) => { e.preventDefault(); if (catKey !== overCat) setOverCat(catKey); } : undefined}
                  onDragLeave={isAdmin ? () => { if (overCat === catKey) setOverCat(null); } : undefined}
                  onDrop={isAdmin ? (e) => { e.preventDefault(); if (dragCat && dragCat !== catKey) moveCategory(dragCat, catKey); setDragCat(null); setOverCat(null); } : undefined}
                  onDragEnd={isAdmin ? () => { setDragCat(null); setOverCat(null); } : undefined}
                  style={{
                    background: "var(--surface)", borderRadius: 14, overflow: "hidden",
                    border: `1px solid ${overCat === catKey && dragCat && dragCat !== catKey ? "var(--accent)" : "var(--border)"}`,
                    opacity: dragCat === catKey ? 0.4 : 1,
                    boxShadow: overCat === catKey && dragCat && dragCat !== catKey ? "0 0 0 2px var(--accent)" : "none",
                    transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.15s",
                    animationDelay: `${ci * 0.04}s`,
                  }}>
                  {/* Category header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                    {isAdmin && (
                      <span style={{ cursor: "grab", color: "var(--text3)", display: "flex", flexShrink: 0, touchAction: "none" }} title="Glisser pour réordonner">
                        <Icon name="drag" size={16} color="var(--text3)" />
                      </span>
                    )}
                    <button onClick={() => toggleCat(catKey)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                      <span style={{ fontSize: 20 }}>{cat.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{cat.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{catIngs.length} ingrédient{catIngs.length !== 1 ? "s" : ""} · <code style={{ fontSize: 10, background: "var(--surface2)", borderRadius: 4, padding: "1px 4px" }}>{catKey}</code></div>
                      </div>
                      <span style={{
                        display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%",
                        background: "var(--surface2)", border: "1px solid var(--border)",
                        transition: "transform 0.25s ease", transform: isOpen ? "rotate(-90deg)" : "rotate(90deg)"
                      }}>
                        <Icon name="forward" size={12} color="var(--text3)" />
                      </span>
                    </button>
                    {isAdmin && (
                      <button className="btn btn-primary btn-sm" style={{ flexShrink: 0, padding: "4px 10px", fontSize: 11 }}
                        onClick={() => setEditIng({ id: "", name: "", category: catKey, image: "", nutrition: null })}>
                        <Icon name="plus" size={12} /> Ajouter
                      </button>
                    )}
                  </div>
                  {/* Ingredients list */}
                  {isOpen && (
                    <div style={{ borderTop: "1px solid var(--border)", animation: "expandDown 0.2s ease" }}>
                      {catIngs.length === 0 && (
                        <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>
                          Aucun ingrédient dans cette catégorie.
                        </div>
                      )}
                      {catIngs.map((item, i) => (
                        <button key={item.id} onClick={() => navigate(`/config/ingredients/${encodeURIComponent(item.id)}`)} title="Voir la fiche" className="ing-row-btn" style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                          borderTop: i > 0 ? "1px solid var(--border)" : "none",
                          background: "var(--surface)", textAlign: "left", cursor: "pointer", border: "none", transition: "background 0.15s",
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface2)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}>
                          <IngImage src={item.image} alt={item.name} size={42} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--accent)", marginTop: 2, fontWeight: 600 }}>
                              <Icon name="fileText" size={10} color="var(--accent)" /> Découvrir la fiche
                            </div>
                          </div>
                          {item._ro && <span style={{ fontSize: 10, color: "rgba(155,135,245,1)", fontWeight: 600, padding: "2px 8px", background: "rgba(155,135,245,0.14)", border: "1px solid rgba(155,135,245,0.35)", borderRadius: 8, flexShrink: 0 }}>Master</span>}
                          <Icon name="forward" size={14} color="var(--text3)" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Import / Export Markdown de la base master (admin) — en bas ── */}
            {isAdmin && (
              <>
                <div style={{ height: 6 }} />
                {/* Export */}
                <div className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Exporter la base</h3>
                      <p style={{ fontSize: 12, color: "var(--text2)" }}>{ingredientDB.length} ingrédient{ingredientDB.length > 1 ? "s" : ""} · format Markdown</p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={exportIngredientsMarkdown} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <Icon name="download" size={14} /> Exporter
                    </button>
                  </div>
                </div>
                {/* Import drag & drop */}
                <div className="slide-up" style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Importer dans la base</h3>
                  <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12, lineHeight: 1.45 }}>
                    <span style={{ color: "var(--red)", fontWeight: 600 }}>⚠️ Écrase la base master</span> : met à jour (par nom / dbid) ou crée les ingrédients. Seuls les fichiers exportés depuis Mijoté et validés sont acceptés.
                  </p>
                  <input ref={mdFileRef} type="file" accept=".md,.markdown,.txt" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => { try { importIngredientsMarkdown(ev.target.result); } catch { setMdInfo(""); setMdError("Fichier illisible : " + f.name); } }; r.readAsText(f); } e.target.value = ""; }} />
                  <div
                    onDragOver={e => { e.preventDefault(); setMdDragOver(true); }}
                    onDragLeave={() => setMdDragOver(false)}
                    onDrop={e => { e.preventDefault(); setMdDragOver(false); const f = Array.from(e.dataTransfer.files).find(f => /\.(md|markdown|txt)$/i.test(f.name)); if (f) { const r = new FileReader(); r.onload = ev => { try { importIngredientsMarkdown(ev.target.result); } catch { setMdInfo(""); setMdError("Fichier illisible : " + f.name); } }; r.readAsText(f); } }}
                    onClick={() => mdFileRef.current.click()}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "28px 20px", borderRadius: 12, border: `2px dashed ${mdDragOver ? "var(--accent)" : "var(--border)"}`, background: mdDragOver ? "rgba(232,112,58,0.06)" : "var(--surface2)", cursor: "pointer", transition: "all 0.15s" }}>
                    <Icon name="import" size={28} color={mdDragOver ? "var(--accent)" : "var(--text3)"} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: mdDragOver ? "var(--accent)" : "var(--text)" }}>Dépose un fichier Markdown ici</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>ou clique pour sélectionner</div>
                    </div>
                  </div>
                  {mdError && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{mdError}</p>}
                  {mdInfo && <p style={{ color: "var(--accent)", fontSize: 12, marginTop: 8 }}>✓ {mdInfo}</p>}
                </div>
              </>
            )}
          </div>
        )}

        {section === "ustensiles" && (
          <div>
            {isAdmin && <button className="btn btn-primary btn-sm" style={{ marginBottom: 14 }} onClick={() => setEditUt({ id: "", name: "", image: "" })}><Icon name="plus" size={14} /> Nouvel ustensile</button>}
            <div className="config-ut-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[...utensilDB].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr")).map((item, ui) => (
                <div key={item.id} className="slide-up" style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animationDelay: `${ui * 0.03}s` }}>
                  <div style={{ width: 50, height: 50, borderRadius: 10, overflow: "hidden", background: "#fff" }}><Img src={item.image} alt={item.name} style={{ width: "100%", height: "100%" }} /></div>
                  <span style={{ fontSize: 13, fontWeight: 500, textAlign: "center" }}>{item.name}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {item._ro
                      ? <span style={{ fontSize: 10, color: "rgba(155,135,245,1)", fontWeight: 600, padding: "2px 8px", background: "rgba(155,135,245,0.14)", border: "1px solid rgba(155,135,245,0.35)", borderRadius: 8 }}>Master</span>
                      : <>
                        <button onClick={() => setEditUt({ ...item })} style={{ color: "var(--text3)" }}><Icon name="edit" size={14} /></button>
                        <button onClick={() => setConfirmDel({ type: "ut", item })} style={{ color: "var(--red)" }}><Icon name="trash" size={14} /></button>
                      </>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === "collections" && (
          <div>
            <button className="btn btn-primary btn-sm" style={{ marginBottom: 14 }} onClick={() => setEditCol({ id: "", name: "", color: "#e8703a", icon: "📁" })}><Icon name="plus" size={14} /> Nouvelle collection</button>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {collections.map(col => (
                <div key={col.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", borderRadius: 12, padding: "10px 14px", border: "1px solid var(--border)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: col.color + "33", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{col.icon || "📁"}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{col.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{col.count} recette(s)</div>
                  </div>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                  <button onClick={() => setEditCol({ ...col })} style={{ color: "var(--text3)", marginRight: 4 }}><Icon name="edit" size={14} /></button>
                  <button onClick={() => setCollections(prev => prev.filter(c => c.id !== col.id))} style={{ color: "var(--red)" }}><Icon name="trash" size={14} /></button>
                </div>
              ))}
              {collections.length === 0 && <p style={{ fontSize: 13, color: "var(--text3)" }}>Aucune collection. Créez-en une !</p>}
            </div>
          </div>
        )}

        {section === "données" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Export */}
            <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Exporter des recettes</h3>
                  <p style={{ fontSize: 12, color: "var(--text2)" }}>{recipes.length} recette{recipes.length > 1 ? "s" : ""} sauvegardée{recipes.length > 1 ? "s" : ""}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={onExportAll} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="download" size={14} /> Exporter
                </button>
              </div>
            </div>

            {/* Import drag & drop */}
            <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Importer des recettes</h3>
              <input ref={fileRef} type="file" accept=".json" multiple
                onChange={e => { Array.from(e.target.files).forEach(f => { const r = new FileReader(); r.onload = ev => { try { onImport(ev.target.result); } catch { setJsonError("Fichier invalide : " + f.name); } }; r.readAsText(f); }); e.target.value = ""; }}
                style={{ display: "none" }} />
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".json")).forEach(f => { const r = new FileReader(); r.onload = ev => { try { onImport(ev.target.result); } catch { setJsonError("Fichier invalide : " + f.name); } }; r.readAsText(f); }); }}
                onClick={() => fileRef.current.click()}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "28px 20px",
                  borderRadius: 12, border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                  background: dragOver ? "rgba(232,112,58,0.06)" : "var(--surface2)",
                  cursor: "pointer", transition: "all 0.15s"
                }}>
                <Icon name="import" size={28} color={dragOver ? "var(--accent)" : "var(--text3)"} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: dragOver ? "var(--accent)" : "var(--text)" }}>Dépose tes fichiers JSON ici</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>ou clique pour sélectionner — plusieurs fichiers acceptés</div>
                </div>
              </div>
              {jsonError && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>{jsonError}</p>}
            </div>

            {/* JSON schema expander */}
            <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
              <button onClick={() => setSchemaOpen(p => !p)}
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "none", color: "var(--text)", fontFamily: "var(--ff-body)", fontSize: 14, fontWeight: 600 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="book" size={15} color="var(--text3)" />
                  Schéma JSON de référence
                </span>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", transition: "transform 0.25s ease, background 0.15s", transform: schemaOpen ? "rotate(-90deg)" : "rotate(90deg)" }}><Icon name="forward" size={12} color="var(--text3)" style={{ transform: "none" }} /></span>
              </button>
              {schemaOpen && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)", animation: "expandDown 0.35s ease" }}>
                  <div style={{ fontSize: 11, lineHeight: 1.8, overflow: "auto", background: "var(--surface2)", padding: 14, borderRadius: 10, marginTop: 12, fontFamily: "monospace", whiteSpace: "pre" }}
                    dangerouslySetInnerHTML={{
                      __html: [
                        '<span style="color:#9a9490">{</span>',
                        '  <span style="color:#5b9cf6">"name"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>  <span style="color:#5a5754;font-style:italic">← obligatoire, unique</span>',
                        '  <span style="color:#5b9cf6">"image"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"url | base64"</span>',
                        '  <span style="color:#5b9cf6">"prepTime"</span><span style="color:#9a9490">:</span> <span style="color:#f0c060">number</span>  <span style="color:#5a5754;font-style:italic">← minutes</span>',
                        '  <span style="color:#5b9cf6">"cookTime"</span><span style="color:#9a9490">:</span> <span style="color:#f0c060">number</span>  <span style="color:#5a5754;font-style:italic">← minutes</span>',
                        '  <span style="color:#5b9cf6">"servings"</span><span style="color:#9a9490">:</span> <span style="color:#f0c060">number</span>',
                        '  <span style="color:#5b9cf6">"tags"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[</span><span style="color:#4caf7d">"string"</span><span style="color:#9a9490">]</span>',
                        '  <span style="color:#5b9cf6">"source"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"url"</span>  <span style="color:#5a5754;font-style:italic">← lien de la recette originale</span>',
                        '  <span style="color:#5b9cf6">"collections"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[</span><span style="color:#4caf7d">"collection_id"</span><span style="color:#9a9490">]</span>',
                        '  <span style="color:#5b9cf6">"ingredients"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[{</span>',
                        '    <span style="color:#5b9cf6">"name"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>',
                        '    <span style="color:#5b9cf6">"amount"</span><span style="color:#9a9490">:</span> <span style="color:#f0c060">number</span>',
                        '    <span style="color:#5b9cf6">"unit"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>  <span style="color:#5a5754;font-style:italic">← "g", "ml", "pièce"…</span>',
                        '  <span style="color:#9a9490">}]</span>',
                        '  <span style="color:#5b9cf6">"utensils"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[{</span>',
                        '    <span style="color:#5b9cf6">"name"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>',
                        '  <span style="color:#9a9490">}]</span>',
                        '  <span style="color:#5b9cf6">"steps"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[{</span>',
                        '    <span style="color:#5b9cf6">"text"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>',
                        '    <span style="color:#5b9cf6">"ingredients"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[</span><span style="color:#4caf7d">"ingredient_name"</span><span style="color:#9a9490">]</span>  <span style="color:#5a5754;font-style:italic">← optionnel</span>',
                        '    <span style="color:#5b9cf6">"utensils"</span><span style="color:#9a9490">:</span> <span style="color:#9a9490">[</span><span style="color:#4caf7d">"utensil_name"</span><span style="color:#9a9490">]</span>  <span style="color:#5a5754;font-style:italic">← optionnel</span>',
                        '  <span style="color:#9a9490">}]</span>',
                        '<span style="color:#9a9490">}</span>',
                      ].join('\n')
                    }} />
                  <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 8, lineHeight: 1.6 }}>
                    💡 Accepte un objet ou un tableau. Les IDs sont régénérés à l'import. Les images base64 sont supportées.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {section === "nouveautés" && <ChangelogSection />}
      </div>
      </>
      )}

      {/* Ingredient editor modal */}
      {editIng && (
        <SwipeableSheet onClose={() => setEditIng(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editIng.id ? "Modifier" : "Nouvel"} ingrédient</h3>
          <div className="field-label">Nom</div>
          <input className="field-input" placeholder="ex: Tomate" value={editIng.name} onChange={e => setEditIng(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 12 }} />
          <div className="field-label">Alias / synonymes</div>
          <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6, lineHeight: 1.4 }}>
            Autres noms qui doivent pointer vers cet ingrédient (ex : ciboule, cébette, oignon nouveau).
          </p>
          <div style={{ marginBottom: 12 }}>
            <TagInput
              tags={editIng.aliases || []}
              onChange={v => setEditIng(p => ({ ...p, aliases: v }))}
              allTags={[]}
              label=""
              placeholder="ciboule, cébette…"
              inputId="alias-input-field"
              commitOnBlur
              dedupeInsensitive />
          </div>
          <div className="field-label">Catégorie nutritionnelle</div>
          <select className="field-input" value={editIng.category || "other"} onChange={e => setEditIng(p => ({ ...p, category: e.target.value }))} style={{ marginBottom: 12 }}>
            {sortedCategoryEntries(categories).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <div className="field-label">Photo</div>
          <ImageUpload value={editIng.image} onChange={v => setEditIng(p => ({ ...p, image: v }))} style={{ marginBottom: 12, height: 100 }} pathPrefix={isAdmin ? "master/ingredients" : "ingredients"} />
          <div className="field-label">Poids moyen d'une pièce (g)</div>
          <input className="field-input" type="number" min="0" step="1" placeholder="ex. 125 pour une tomate — optionnel"
            value={editIng.gramsPerPiece ?? ""}
            onChange={e => setEditIng(p => ({ ...p, gramsPerPiece: e.target.value === "" ? undefined : +e.target.value }))}
            style={{ marginBottom: 4 }} />
          <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>Utilisé pour le score quand la quantité est en pièces, tranches, gousses…</div>
          <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>Valeurs nutritionnelles précises (optionnel — pour 100g)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["calories", "Énergie (kcal)", 1], ["protein", "Protéines (g)", 0.1], ["carbs", "Glucides (g)", 0.1], ["sugar", "Sucres (g)", 0.1], ["fat", "Lipides (g)", 0.1], ["saturatedFat", "G. saturées (g)", 0.1], ["omega3", "Oméga-3 (g)", 0.01], ["fiber", "Fibres (g)", 0.1], ["salt", "Sel (g)", 0.01]].map(([k, l, step]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 3 }}>{l}</div>
                  <input className="field-input" type="number" min="0" step={step} placeholder="0"
                    value={editIng.nutrition?.[k] || ""}
                    onChange={e => setEditIng(p => ({ ...p, nutrition: { ...(p.nutrition || {}), isVegetable: p.category === "vegetable" || p.category === "legume", [k]: +e.target.value } }))}
                    style={{ padding: "6px 10px", fontSize: 12 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Conseils (préparation / utilisation / bienfaits) */}
          <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>Conseils (optionnel)</div>
              <button className="btn btn-ghost btn-sm" style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", fontSize: 11 }}
                onClick={() => setEditIng(p => ({ ...p, tips: [...(p.tips || []), { type: "prep", text: "" }] }))}>
                <Icon name="plus" size={12} /> Ajouter
              </button>
            </div>
            {(editIng.tips || []).length === 0 && <div style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>Aucun conseil. Astuces de préparation, d'utilisation ou bienfaits.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(editIng.tips || []).map((tip, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <select className="field-input" value={tip.type} style={{ width: 120, flexShrink: 0, padding: "6px 8px", fontSize: 12 }}
                    onChange={e => setEditIng(p => ({ ...p, tips: p.tips.map((t, i) => i === idx ? { ...t, type: e.target.value } : t) }))}>
                    {Object.entries(TIP_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                  <textarea className="field-input" rows={2} placeholder="Conseil utile…" value={tip.text}
                    onChange={e => setEditIng(p => ({ ...p, tips: p.tips.map((t, i) => i === idx ? { ...t, text: e.target.value } : t) }))}
                    style={{ flex: 1, padding: "6px 10px", fontSize: 12, resize: "vertical", minHeight: 38 }} />
                  <button onClick={() => setEditIng(p => ({ ...p, tips: p.tips.filter((_, i) => i !== idx) }))} style={{ color: "var(--red)", flexShrink: 0, marginTop: 6 }}><Icon name="trash" size={14} color="var(--red)" /></button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditIng(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveIng(editIng)}>Sauvegarder</button>
          </div>
        </SwipeableSheet>
      )}


      {/* Category delete confirmation */}
      {confirmDel && (
        <SwipeableSheet onClose={() => setConfirmDel(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Supprimer {confirmDel.type === "ing" ? "l'ingrédient" : "l'ustensile"} ?</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            « {confirmDel.item.name} » sera retiré de la base Master partagée. Cette action est visible par tous les utilisateurs et irréversible.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDel(null)}>Annuler</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { confirmDel.type === "ing" ? delIng(confirmDel.item.id) : delUt(confirmDel.item.id); setConfirmDel(null); if (ingDetailId) navigate(-1); }}>Supprimer</button>
          </div>
        </SwipeableSheet>
      )}

      {/* Utensil editor modal */}
      {editUt && (
        <SwipeableSheet onClose={() => setEditUt(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editUt.id ? "Modifier" : "Nouvel"} ustensile</h3>
          <div className="field-label">Nom</div>
          <input className="field-input" placeholder="ex: Casserole" value={editUt.name} onChange={e => setEditUt(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 12 }} />
          <div className="field-label">Photo</div>
          <ImageUpload value={editUt.image} onChange={v => setEditUt(p => ({ ...p, image: v }))} style={{ marginBottom: 14, height: 100 }} pathPrefix={isAdmin ? "master/utensils" : "utensils"} />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditUt(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveUt(editUt)}>Sauvegarder</button>
          </div>
        </SwipeableSheet>
      )}

      {/* Collection editor modal */}
      {editCol && (
        <SwipeableSheet onClose={() => setEditCol(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editCol.id ? "Modifier" : "Nouvelle"} collection</h3>
          <div style={{ marginBottom: 12 }}>
            <div className="field-label">Nom</div>
            <input className="field-input" placeholder="ex: Plats végétariens" value={editCol.name} onChange={e => setEditCol(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="field-label" style={{ marginBottom: 8 }}>Couleur</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {["#e8703a", "#f0c060", "#e05252", "#4caf7d", "#5b9cf6", "#c080e0", "#f0a875", "#9a9490"].map(c => (
              <button key={c} onClick={() => setEditCol(p => ({ ...p, color: c }))} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: `3px solid ${editCol.color === c ? "#fff" : "transparent"}`, boxShadow: editCol.color === c ? "0 0 0 2px " + c : "none", transition: "all 0.15s" }} />
            ))}
          </div>
          <div className="field-label" style={{ marginBottom: 8 }}>Icône</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {["🍽️", "🥗", "🍝", "🍰", "🥩", "🥦", "🥐", "🍜", "🍛", "🫕", "🥘", "🧁", "🍣", "🫙", "🥚", "🧀", "🫒", "🌮", "🍲"].map(ico => (
              <button key={ico} onClick={() => setEditCol(p => ({ ...p, icon: ico }))} style={{ width: 38, height: 38, borderRadius: 10, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", background: editCol.icon === ico ? editCol.color + "33" : "var(--surface2)", border: `2px solid ${editCol.icon === ico ? editCol.color : "var(--border)"}`, transition: "all 0.15s" }}>{ico}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface2)", borderRadius: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: editCol.color + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{editCol.icon || "📁"}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{editCol.name || "Nom de la collection"}</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>Aperçu</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditCol(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
              if (!editCol.name.trim()) return;
              if (editCol.id && collections.find(c => c.id === editCol.id)) {
                setCollections(prev => prev.map(c => c.id === editCol.id ? { ...editCol } : c));
              } else {
                setCollections(prev => [...prev, { ...editCol, id: "c" + Date.now(), count: 0 }]);
              }
              setEditCol(null);
            }}>Sauvegarder</button>
          </div>
        </SwipeableSheet>
      )}
    </div>
  );
}