import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, getDocs, writeBatch } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import React from 'react'

// ─── FIREBASE ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

// ─── FIRESTORE DATA LAYER (split documents) ──────────────────────────────────
// Structure:
//   users/{uid}/recipes/{recipeId}   — one doc per recipe (own 1MB budget each)
//   users/{uid}/meta/collections     — { items: [...] }
//   users/{uid}/meta/mealPlan        — { data: {...} }
//   users/{uid}/meta/shoppingLists   — { items: [...] }
//   users/{uid}/meta/fridge          — { items: [...], settings: {...} }
//   users/{uid}/meta/userDB          — { ingredients: [...], utensils: [...] }
//   master/ingredients               — { items: [...] } (shared, read-only for users)
//   master/utensils                  — { items: [...] }

const metaDoc = (uid, name) => doc(db, "users", uid, "meta", name);
const recipesCol = (uid) => collection(db, "users", uid, "recipes");

// Read the shared Master reference DB (ingredients + utensils + categories).
async function loadMasterDB() {
  try {
    const [ing, ut, cat] = await Promise.all([
      getDoc(doc(db, "master", "ingredients")),
      getDoc(doc(db, "master", "utensils")),
      getDoc(doc(db, "master", "categories")),
    ]);
    return {
      ingredients: ing.exists() ? (ing.data().items || []) : [],
      utensils: ut.exists() ? (ut.data().items || []) : [],
      categories: cat.exists() && cat.data().map && Object.keys(cat.data().map).length
        ? cat.data().map : DEFAULT_CATEGORIES,
    };
  } catch {
    return { ingredients: [], utensils: [], categories: DEFAULT_CATEGORIES };
  }
}

// Load all of a user's data from the split structure.
async function loadUserData(uid) {
  const [recipesSnap, collectionsSnap, mealPlanSnap, shoppingSnap, fridgeSnap, userDBSnap] = await Promise.all([
    getDocs(recipesCol(uid)),
    getDoc(metaDoc(uid, "collections")),
    getDoc(metaDoc(uid, "mealPlan")),
    getDoc(metaDoc(uid, "shoppingLists")),
    getDoc(metaDoc(uid, "fridge")),
    getDoc(metaDoc(uid, "userDB")),
  ]);
  return {
    recipes: recipesSnap.docs.map(d => d.data()),
    collections: collectionsSnap.exists() ? (collectionsSnap.data().items || []) : null,
    mealPlan: mealPlanSnap.exists() ? (mealPlanSnap.data().data || {}) : null,
    shoppingLists: shoppingSnap.exists() ? (shoppingSnap.data().items || []) : null,
    fridge: fridgeSnap.exists() ? (fridgeSnap.data().items || []) : null,
    fridgeSettings: fridgeSnap.exists() ? (fridgeSnap.data().settings || null) : null,
    userDB: userDBSnap.exists() ? userDBSnap.data() : null,
  };
}

// One-time migration from the legacy single doc (users/{uid}/data/app).
async function migrateLegacyDoc(uid) {
  try {
    const legacy = await getDoc(doc(db, "users", uid, "data", "app"));
    if (!legacy.exists()) return null;
    return legacy.data();
  } catch {
    return null;
  }
}

// Diff-based recipe sync: write only changed/new recipes, delete removed ones.
async function syncRecipes(uid, recipes, lastSyncedMap) {
  const batch = writeBatch(db);
  const currentIds = new Set();
  let ops = 0;
  for (const r of recipes) {
    if (!r.id) continue;
    currentIds.add(r.id);
    const prev = lastSyncedMap.get(r.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(r)) {
      batch.set(doc(recipesCol(uid), r.id), r);
      ops++;
    }
  }
  for (const id of lastSyncedMap.keys()) {
    if (!currentIds.has(id)) { batch.delete(doc(recipesCol(uid), id)); ops++; }
  }
  if (ops > 0) await batch.commit();
  const newMap = new Map();
  for (const r of recipes) if (r.id) newMap.set(r.id, r);
  return newMap;
}


// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,300&family=DM+Sans:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#0e0e0f;--surface:#171718;--surface2:#1f1f21;--surface3:#252527;
    --border:rgba(255,255,255,0.07);--accent:#e8703a;--accent2:#f0a875;
    --text:#f0ede8;--text2:#9a9490;--text3:#5a5754;
    --green:#4caf7d;--red:#e05252;--yellow:#f0c060;--blue:#5b9cf6;
    --radius:16px;--radius-sm:10px;
    --ff-display:'Fraunces',serif;--ff-body:'DM Sans',sans-serif;
    --tab-h:72px;
  }
  /* ── LIGHT THEME ── */
  html.light,.light{
    --bg:#f5f0eb;--surface:#ffffff;--surface2:#ede8e2;--surface3:#e0d8d0;
    --border:rgba(0,0,0,0.09);
    --text:#2c2420;--text2:#5a5250;--text3:#887870;
  }
  html.light,html.light body{background:#f5f0eb;color:#2c2420;}
  html.light .field-input{color:#2c2420;background:#ede8e2;}
  html.light select option{background:#ede8e2;color:#1a1614;}
  *,*::before,*::after{transition:background-color 0.2s ease,border-color 0.2s ease,color 0.1s ease;}
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
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  .modal-sheet{background:var(--surface);border-radius:24px 24px 0 0;padding:20px;max-height:92dvh;overflow-y:auto;animation:sheetUp 0.3s cubic-bezier(0.25,0.46,0.45,0.94);}
  @keyframes sheetUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
  .modal-handle{width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px;}
  @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
  @keyframes expandDown{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
  @keyframes editorSlideIn{from{opacity:0;transform:translateY(32px);}to{opacity:1;transform:translateY(0);}}
  .editor-enter{animation:editorSlideIn 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both;}
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
    #root{max-width:100%;height:100dvh;flex-direction:row;overflow:hidden;}

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

    /* Cook mode sidebar */
    .cook-mode-sidebar{display:flex!important;flex-direction:column;}

    /* Recipe detail: hide tabs on desktop, show 2-col layout */
    .detail-tabs-mobile{display:none!important;}
    .detail-mobile-content{display:none!important;}
    .detail-desktop-content{display:flex!important;}
  }
`;

// ─── NUTRITION DATABASE ────────────────────────────────────────────────────────
// Default nutrition categories — seed for the Master `categories` doc.
// `score` is on a 0-10 scale internally (displayed/edited as 0-100 in the UI).
const DEFAULT_CATEGORIES = {
  vegetable: { label: "Légumes", score: 10, color: "#4caf7d", icon: "🥦", order: 0 },
  fruit: { label: "Fruits", score: 8, color: "#80c080", icon: "🍎", order: 1 },
  legume: { label: "Légumineuses", score: 9, color: "#4caf7d", icon: "🫘", order: 2 },
  protein_lean: { label: "Protéines maigres", score: 8, color: "#5b9cf6", icon: "🍗", order: 3 },
  protein_fat: { label: "Protéines grasses", score: 5, color: "#f0a875", icon: "🥩", order: 4 },
  fish_seafood: { label: "Poissons/Fruits de mer", score: 9, color: "#5b9cf6", icon: "🐟", order: 5 },
  dairy: { label: "Produits laitiers", score: 6, color: "#f0e060", icon: "🧀", order: 6 },
  grain_whole: { label: "Céréales complètes", score: 7, color: "#c8a870", icon: "🌾", order: 7 },
  grain_ref: { label: "Céréales raffinées", score: 4, color: "#c8a870", icon: "🍞", order: 8 },
  fat_good: { label: "Matières grasses saines", score: 6, color: "#80c080", icon: "🫒", order: 9 },
  nuts_seeds: { label: "Noix et graines", score: 8, color: "#c8a870", icon: "🥜", order: 10 },
  fat_bad: { label: "Matières grasses saturées", score: 2, color: "#e05252", icon: "🧈", order: 11 },
  mushroom: { label: "Champignons", score: 8, color: "#9a9490", icon: "🍄", order: 12 },
  herbs: { label: "Herbes aromatiques fraîches", score: 9, color: "#4caf7d", icon: "🌿", order: 13 },
  condiment: { label: "Condiments/Épices", score: 7, color: "#9a9490", icon: "🧂", order: 14 },
  sugar: { label: "Sucres/Sucrants", score: 1, color: "#e05252", icon: "🍬", order: 15 },
  alcohol: { label: "Alcools", score: 0, color: "#e05252", icon: "🍷", order: 16 },
  other: { label: "Autres", score: 5, color: "#9a9490", icon: "📦", order: 17 },
};

// Return [key, cat] entries sorted by their `order` field (stable fallback to insertion).
function sortedCategoryEntries(categories) {
  return Object.entries(categories).sort((a, b) => {
    const oa = a[1].order ?? 999, ob = b[1].order ?? 999;
    return oa === ob ? a[0].localeCompare(b[0]) : oa - ob;
  });
}

function computeHealthScore(ingredients, ingredientDB, categories = DEFAULT_CATEGORIES) {
  if (!ingredients || ingredients.length === 0) return 70;
  let totalWeight = 0;
  let weightedScore = 0;
  for (const recipeIng of ingredients) {
    const dbItem = ingredientDB.find(d => d.id === recipeIng.dbId);
    if (!dbItem) continue;
    const amount = recipeIng.amount || 1;
    const unitWeight = recipeIng.unit === "kg" ? amount * 1000 : recipeIng.unit === "l" ? amount * 1000 : amount;
    const weight = Math.max(unitWeight, 10);
    let score;
    if (dbItem.nutrition) {
      // Nutri-score style from macros per 100g
      const n = dbItem.nutrition;
      let s = 50;
      s += (n.fiber || 0) * 3;
      s += (n.protein || 0) * 2;
      s -= (n.saturatedFat || 0) * 4;
      s -= (n.sugar || 0) * 2;
      s -= (n.salt || 0) * 10;
      if (n.isVegetable) s += 15;
      score = Math.max(0, Math.min(99, s));
    } else {
      const cat = categories[dbItem.category || "other"];
      score = (cat?.score || 5) * 10;
    }
    weightedScore += score * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 70;
  return Math.min(99, Math.round(weightedScore / totalWeight));
}

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
// New users start completely empty. Ingredient/utensil reference data now comes
// from the shared read-only Master DB in Firestore (master/ingredients,
// master/utensils), merged with each user's own additions (meta/userDB).
const DEFAULT_INGREDIENT_DB = [];
const DEFAULT_UTENSIL_DB = [];
const SAMPLE_RECIPES = [];
const SAMPLE_COLLECTIONS = [];

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    home: <svg {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
    search: <svg {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>,
    calendar: <svg {...p}><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>,
    book: <svg {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
    plus: <svg {...p} strokeWidth="2"><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></svg>,
    edit: <svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
    trash: <svg {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
    download: <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>,
    share: <svg {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>,
    clock: <svg {...p}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    fire: <svg {...p}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>,
    check: <svg {...p} strokeWidth="2.2"><polyline points="20 6 9 17 4 12" /></svg>,
    back: <svg {...p}><polyline points="15 18 9 12 15 6" /></svg>,
    forward: <svg {...p}><polyline points="9 18 15 12 9 6" /></svg>,
    close: <svg {...p}><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>,
    import: <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>,
    shopping: <svg {...p}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>,
    settings: <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    drag: <svg {...p}><circle cx="9" cy="5" r="1" fill={color} /><circle cx="9" cy="12" r="1" fill={color} /><circle cx="9" cy="19" r="1" fill={color} /><circle cx="15" cy="5" r="1" fill={color} /><circle cx="15" cy="12" r="1" fill={color} /><circle cx="15" cy="19" r="1" fill={color} /></svg>,
    fridge: <svg {...p}><rect x="3" y="2" width="18" height="20" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="2" x2="9" y2="9" /><line x1="8" y1="14" x2="8" y2="18" /></svg>,
    pdf: <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
    photo: <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>,
    portions: <svg {...p}><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="16" /><line x1="8" x2="16" y1="12" y2="12" /></svg>,
    grid: <svg {...p}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
    list2: <svg {...p}><line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" /></svg>,
    sun: <svg {...p}><circle cx="12" cy="12" r="5" /><line x1="12" x2="12" y1="1" y2="3" /><line x1="12" x2="12" y1="21" y2="23" /><line x1="4.22" x2="5.64" y1="4.22" y2="5.64" /><line x1="18.36" x2="19.78" y1="18.36" y2="19.78" /><line x1="1" x2="3" y1="12" y2="12" /><line x1="21" x2="23" y1="12" y2="12" /><line x1="4.22" x2="5.64" y1="19.78" y2="18.36" /><line x1="18.36" x2="19.78" y1="5.64" y2="4.22" /></svg>,
    moon: <svg {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
    logout: <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>,
  };
  return icons[name] || null;
};


// ─── TIME FORMATTER ───────────────────────────────────────────────────────────
function fmtTime(min) {
  if (!min && min !== 0) return "—";
  if (min < 60) return min + "m";
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? h + "h" : h + "h" + String(m).padStart(2, "0");
}

// ─── HEALTH RING ──────────────────────────────────────────────────────────────
const HealthRing = ({ score, size = 56 }) => {
  const r = (size - 8) / 2, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "var(--green)" : score >= 50 ? "var(--yellow)" : "var(--red)";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size < 48 ? 11 : 13, fontWeight: 600, color }}>{score}</span>
      </div>
    </div>
  );
};

// ─── IMAGE (with fallback) ────────────────────────────────────────────────────
const Img = ({ src, alt, style }) => {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  if (!src || err) return (
    <div style={{ background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", ...style }}>
      <Icon name="photo" size={20} />
    </div>
  );
  return <img src={src} alt={alt || ""} onError={() => setErr(true)} referrerPolicy="no-referrer" style={{ objectFit: "cover", ...style }} />;
};

// ─── INGREDIENT IMAGE (round, slightly larger, transparent-friendly) ──────────
// Used everywhere an ingredient image appears, for a consistent circular look.
const IngImage = ({ src, alt, size = 48 }) => {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [src]);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "var(--surface2)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
    }}>
      {src && !err
        ? <img src={src} alt={alt || ""} onError={() => setErr(true)} referrerPolicy="no-referrer"
          loading="lazy" decoding="async"
          style={{ width: "82%", height: "82%", objectFit: "contain" }} />
        : <Icon name="photo" size={Math.round(size * 0.42)} color="var(--text3)" />}
    </div>
  );
};

// ─── IMAGE COMPRESSION + STORAGE UPLOAD ──────────────────────────────────────
// Compress an image File client-side: resize to max edge.
// Transparent images (PNG/WebP with alpha) are kept as PNG to preserve
// transparency; everything else is flattened to JPEG for smaller size.
// Resolves to { blob, ext, contentType }.
function compressImage(file, { maxEdge = 800, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxEdge) { height = Math.round(height * maxEdge / width); width = maxEdge; }
        else if (height > maxEdge) { width = Math.round(width * maxEdge / height); height = maxEdge; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        // Detect transparency: PNG/WebP source likely has an alpha channel.
        const maybeTransparent = /image\/(png|webp)/i.test(file.type);
        let keepAlpha = false;
        if (maybeTransparent) {
          try {
            const data = ctx.getImageData(0, 0, width, height).data;
            for (let i = 3; i < data.length; i += 4) {
              if (data[i] < 250) { keepAlpha = true; break; }
            }
          } catch { keepAlpha = maybeTransparent; } // tainted canvas → trust the source type
        }
        if (keepAlpha) {
          canvas.toBlob(
            blob => blob ? resolve({ blob, ext: "png", contentType: "image/png" }) : reject(new Error("Compression échouée")),
            "image/png"
          );
        } else {
          canvas.toBlob(
            blob => blob ? resolve({ blob, ext: "jpg", contentType: "image/jpeg" }) : reject(new Error("Compression échouée")),
            "image/jpeg", quality
          );
        }
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Upload a compressed image to Firebase Storage.
// `pathPrefix` is e.g. "recipes", "ingredients", "utensils" (stored under the
// user's folder), or "master/..." (stored at root, readable by all users).
// Returns the public download URL stored in Firestore.
async function uploadImage(file, pathPrefix) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Non authentifié");
  const { blob, ext, contentType } = await compressImage(file);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const path = pathPrefix.startsWith("master/")
    ? `${pathPrefix}/${id}.${ext}`
    : `users/${uid}/${pathPrefix}/${id}.${ext}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, blob, { contentType });
  return await getDownloadURL(sRef);
}

// Delete a previously uploaded image by its download URL (best-effort).
async function deleteImageByUrl(url) {
  if (!url || !url.includes("firebasestorage")) return;
  try {
    const sRef = storageRef(storage, url);
    await deleteObject(sRef);
  } catch { /* already gone or not ours — ignore */ }
}

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────
function ImageUpload({ value, onChange, style, pathPrefix = "misc" }) {
  const inputId = useRef("img_" + Math.random().toString(36).slice(2)).current;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadImage(file, pathPrefix);
      onChange(url);
    } catch (err) {
      // Fallback: if Storage upload fails, keep working with compressed base64
      try {
        const { blob } = await compressImage(file);
        const reader = new FileReader();
        reader.onload = ev => onChange(ev.target.result);
        reader.readAsDataURL(blob);
      } catch {
        setError("Échec de l'upload");
      }
    } finally {
      setUploading(false);
      e.target.value = ""; // allow re-selecting the same file
    }
  };
  return (
    <div style={{ position: "relative", ...style }}>
      {value ? (
        <div style={{ position: "relative" }}>
          <Img src={value} style={{ width: "100%", height: style?.height || 120, borderRadius: 12 }} />
          <button onClick={() => onChange("")} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <Icon name="close" size={13} />
          </button>
          <label htmlFor={inputId} style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.6)", borderRadius: 8, padding: "4px 8px", fontSize: 11, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="photo" size={12} color="#fff" /> {uploading ? "…" : "Changer"}
          </label>
        </div>
      ) : (
        <label htmlFor={inputId} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: style?.height || 80, background: "var(--surface2)", border: "2px dashed rgba(255,255,255,0.12)", borderRadius: 12, color: "var(--text3)", cursor: "pointer" }}>
          {uploading ? (
            <>
              <div style={{ width: 22, height: 22, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Compression & upload…</span>
            </>
          ) : (
            <>
              <Icon name="photo" size={22} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Choisir une photo</span>
              <span style={{ fontSize: 11, color: "var(--text3)" }}>{error || "Galerie ou appareil photo"}</span>
            </>
          )}
        </label>
      )}
      <input id={inputId} type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} />
    </div>
  );
}

// ─── USER AVATAR (sync badge + sign-out popover) ─────────────────────────────
function UserAvatar({ user, syncStatus, onSignOut, isDark, onToggleTheme }) {
  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  if (!user) return null;
  const syncLabel = syncStatus === "syncing" ? "Synchronisation…" : syncStatus === "synced" ? "✓ Synchronisé" : syncStatus === "error" ? "⚠ Erreur sync" : null;
  const syncColor = syncStatus === "synced" ? "var(--green)" : syncStatus === "error" ? "var(--red)" : "var(--text3)";
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => { setOpen(o => !o); setConfirmSignOut(false); }} style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Mon compte">
        {user.photoURL
          ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 38, height: 38, borderRadius: "50%", display: "block", border: "2px solid var(--border)" }} />
          : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>{(user.displayName || "?")[0].toUpperCase()}</div>
        }
        <span style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: syncColor, border: "2px solid var(--bg)", display: syncStatus === "idle" ? "none" : "block" }} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => { setOpen(false); setConfirmSignOut(false); }} />
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 16px", zIndex: 300, minWidth: 210, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", animation: "expandDown 0.2s ease" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{(user.displayName || "").toUpperCase()}</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{user.email}</div>
            {syncLabel && <div style={{ fontSize: 11, color: syncColor, marginBottom: 10 }}>{syncLabel}</div>}
            {onToggleTheme && (
              <>
                <div style={{ height: 1, background: "var(--border)", margin: "8px -4px" }} />
                <button onClick={onToggleTheme} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "6px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 12, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
                  <Icon name={isDark ? "sun" : "moon"} size={13} color="currentColor" />
                  {isDark ? "Mode clair" : "Mode sombre"}
                </button>
                <div style={{ height: 1, background: "var(--border)", margin: "8px -4px" }} />
              </>
            )}
            {!confirmSignOut
              ? <button onClick={() => setConfirmSignOut(true)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", marginTop: 4, borderRadius: 11, background: "rgba(224,82,82,0.10)", border: "1px solid rgba(224,82,82,0.25)", color: "var(--red)", fontFamily: "var(--ff-body)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(224,82,82,0.18)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(224,82,82,0.10)"; }}>
                <Icon name="logout" size={16} color="var(--red)" /> Se déconnecter
              </button>
              : <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8, textAlign: "center" }}>Confirmer la déconnexion ?</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setConfirmSignOut(false)}>Annuler</button>
                  <button className="btn btn-danger btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setOpen(false); setConfirmSignOut(false); onSignOut(); }}>Confirmer</button>
                </div>
              </div>
            }
          </div>
        </>
      )}
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "home", label: "Recettes", icon: "book" },
  { id: "meal-plan", label: "Planning", icon: "calendar" },
  { id: "shopping", label: "Courses", icon: "shopping" },
  { id: "fridge", label: "Frigo", icon: "fridge" },
  { id: "config", label: "Config", icon: "settings" },
];

// ─── LOCAL STORAGE HELPERS ────────────────────────────────────────────────────
function useLS(key, def) {
  const [val, setVal] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { } }, [key, val]);
  return [val, setVal];
}

// ─── DESKTOP DETECTION ───────────────────────────────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isDesktop;
}

// ─── SWIPE DOWN TO CLOSE (mobile modals) ─────────────────────────────────────
function useSwipeDown(onClose, threshold = 140) {
  const startY = useRef(null);
  const startX = useRef(null);
  const sheetRef = useRef(null);
  const onTouchStart = e => { startY.current = e.touches[0].clientY; startX.current = e.touches[0].clientX; };
  const onTouchMove = e => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    const dx = Math.abs(e.touches[0].clientX - startX.current);
    // Only follow drag if movement is primarily vertical
    if (dy > 0 && dy > dx && sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = e => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    const dx = Math.abs(e.changedTouches[0].clientX - startX.current);
    if (sheetRef.current) sheetRef.current.style.transform = "";
    if (dy > threshold && dy > dx) onClose();
    startY.current = null;
    startX.current = null;
  };
  return { sheetRef, onTouchStart, onTouchMove, onTouchEnd };
}

// ─── SWIPEABLE SHEET ──────────────────────────────────────────────────────────
function SwipeableSheet({ onClose, children, style }) {
  const { sheetRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeDown(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={sheetRef} className="modal-sheet"
        style={{ touchAction: "none", ...style }}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        <div className="modal-handle" />
        {children}
      </div>
    </div>
  );
}


export default function App() {
  const [tab, setTab] = useState("home");
  // ── Auth state (declared early so DB setters can read isAdmin) ────────────────
  const [user, setUser] = useState(undefined); // undefined = loading, null = not signed in
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const isAdmin = !!(user && ADMIN_EMAIL && user.email === ADMIN_EMAIL);

  const [recipes, setRecipes] = useLS("rf_recipes2", SAMPLE_RECIPES);
  const [collections, setCollections] = useLS("rf_collections2", SAMPLE_COLLECTIONS);
  const [mealPlan, setMealPlan] = useLS("rf_mealplan2", {});
  const [shoppingLists, setShoppingLists] = useLS("rf_shopping3", []);
  // Reference DBs: shared Master + user's own additions, merged for display.
  const [masterDB, setMasterDB] = useState({ ingredients: [], utensils: [], categories: DEFAULT_CATEGORIES });
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
    () => [...masterDB.ingredients.map(i => ({ ...i, _ro: !isAdmin })), ...userDB.ingredients],
    [masterDB, userDB, isAdmin]
  );
  const utensilDB = useMemo(
    () => [...masterDB.utensils.map(u => ({ ...u, _ro: !isAdmin })), ...userDB.utensils],
    [masterDB, userDB, isAdmin]
  );
  // Setters: admins write everything to the shared Master (folding in any of their
  // own/migrated items); normal users only ever write to their own additions.
  const setIngredientDB = useCallback((updater) => {
    if (isAdmin) {
      const merged = [...masterDB.ingredients, ...userDB.ingredients];
      const next = (typeof updater === "function" ? updater(merged) : updater).map(({ _ro, ...rest }) => rest);
      setMasterDB(prev => ({ ...prev, ingredients: next }));
      if (userDB.ingredients.length) setUserDB(prev => ({ ...prev, ingredients: [] }));
    } else {
      setUserDB(prev => {
        const merged = [...masterDB.ingredients, ...prev.ingredients];
        const next = typeof updater === "function" ? updater(merged) : updater;
        const masterIds = new Set(masterDB.ingredients.map(i => i.id));
        return { ...prev, ingredients: next.filter(i => !masterIds.has(i.id)).map(({ _ro, ...rest }) => rest) };
      });
    }
  }, [masterDB, userDB, isAdmin]);
  const setUtensilDB = useCallback((updater) => {
    if (isAdmin) {
      const merged = [...masterDB.utensils, ...userDB.utensils];
      const next = (typeof updater === "function" ? updater(merged) : updater).map(({ _ro, ...rest }) => rest);
      setMasterDB(prev => ({ ...prev, utensils: next }));
      if (userDB.utensils.length) setUserDB(prev => ({ ...prev, utensils: [] }));
    } else {
      setUserDB(prev => {
        const merged = [...masterDB.utensils, ...prev.utensils];
        const next = typeof updater === "function" ? updater(merged) : updater;
        const masterIds = new Set(masterDB.utensils.map(u => u.id));
        return { ...prev, utensils: next.filter(u => !masterIds.has(u.id)).map(({ _ro, ...rest }) => rest) };
      });
    }
  }, [masterDB, userDB, isAdmin]);
  const [fridge, setFridge] = useLS("rf_fridge", []);
  const [fridgeSettings, setFridgeSettings] = useLS("rf_fridge_settings", { matchThreshold: 25 });
  const [selectedRecipe, setSelectedRecipe] = useState(null);
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
          setUserDB(data.userDB || { ingredients: [], utensils: [] });
          setMasterDB(await masterPromise);

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
              setDoc(metaDoc(u.uid, "fridge"), { items: data.fridge || [], settings: data.fridgeSettings || { matchThreshold: 25 } }),
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

  // Update document title on tab change
  useEffect(() => {
    const titles = { "home": "Recettes", "meal-plan": "Planning", "shopping": "Courses", "fridge": "Frigo", "config": "Configuration" };
    document.title = `Mijoté · ${titles[tab] || "Recettes"}`;
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
  useEffect(() => { saveMeta("fridge", { items: fridge, settings: fridgeSettings }); }, [fridge, fridgeSettings]);
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
    const score = computeHealthScore(r.ingredients, ingredientDB, categories);
    const withScore = { ...r, healthScore: score };
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
    setSelectedRecipe(null);
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
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${recipe.name.split(" ").join("_")}.json`; a.click();
    notify("Export JSON téléchargé");
  };

  const importJSON = json => {
    try {
      const data = JSON.parse(json);
      const incoming = (Array.isArray(data) ? data : [data]);
      setRecipes(prev => {
        const existingNames = new Set(prev.map(r => r.name.toLowerCase().trim()));
        const newOnes = incoming.filter(r => r.name && !existingNames.has(r.name.toLowerCase().trim()))
          .map(r => ({ ...r, id: "r" + Date.now() + Math.random() }));
        const skipped = incoming.length - newOnes.length;
        if (newOnes.length > 0) notify(`${newOnes.length} recette(s) importée(s)${skipped > 0 ? ` · ${skipped} doublon(s) ignoré(s)` : ""} ✓`);
        else notify(`Aucune recette importée — ${skipped} doublon(s) ignoré(s)`, "error");
        return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
      });
    } catch { notify("JSON invalide", "error"); }
  };

  const exportPDF = recipe => {
    const ingLines = recipe.ingredients.map(i =>
      `<div class="ing-row"><span class="ing-name">${i.name}</span><span class="ing-qty">${i.amount} ${i.unit}</span></div>`
    ).join("");
    const stepLines = recipe.steps.map((s, i) => {
      const ingNames = recipe.ingredients.filter(x => s.ingredients?.includes(x.id)).map(x => `${x.name} (${x.amount} ${x.unit})`).join(" · ");
      return `
        <div class="step">
          <div class="step-num">${i + 1}</div>
          <div class="step-body">
            <div class="step-title">${s.title}</div>
            <p class="step-text">${s.text}</p>
            ${ingNames ? `<div class="step-ings">🥕 ${ingNames}</div>` : ""}
          </div>
        </div>`;
    }).join("");
    const tags = (recipe.tags || []).map(t => `<span class="tag">${t}</span>`).join("");
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
    body { font-family: 'DM Sans', sans-serif; color: var(--text); background: #fff; max-width: 680px; margin: 0 auto; padding: 48px 40px 64px; font-size: 14px; line-height: 1.6; }
    /* Header */
    .header { border-bottom: 2px solid var(--accent); padding-bottom: 24px; margin-bottom: 28px; }
    .brand { font-family: 'Fraunces', serif; font-size: 13px; font-weight: 400; color: var(--accent); letter-spacing: 0.04em; margin-bottom: 10px; }
    h1 { font-family: 'Fraunces', serif; font-size: 38px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 14px; color: var(--text); }
    .meta { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 12px; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; font-weight: 500; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; }
    .meta-value { font-size: 16px; font-weight: 600; color: var(--text); }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
    .tag { font-size: 11px; font-weight: 500; color: var(--accent); background: rgba(232,112,58,0.1); border: 1px solid rgba(232,112,58,0.25); border-radius: 20px; padding: 2px 10px; }
    /* Section titles */
    .section-title { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
    /* Ingredients */
    .ingredients { background: var(--surface); border-radius: 12px; padding: 16px 20px; margin-bottom: 32px; }
    .ing-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--border); }
    .ing-row:last-child { border-bottom: none; }
    .ing-name { font-weight: 500; }
    .ing-qty { font-weight: 600; color: var(--accent); font-size: 13px; }
    /* Steps */
    .step { display: flex; gap: 14px; margin-bottom: 20px; }
    .step-num { width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
    .step-body { flex: 1; }
    .step-title { font-weight: 600; font-size: 15px; margin-bottom: 4px; }
    .step-text { color: var(--text2); line-height: 1.65; }
    .step-ings { font-size: 11px; color: var(--text3); margin-top: 6px; font-style: italic; }
    /* Footer */
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text3); }
    .footer-brand { font-family: 'Fraunces', serif; color: var(--accent); }
    @media print {
      body { padding: 24px 28px; }
      .step { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Mijoté·</div>
    <h1>${recipe.name}</h1>
    <div class="meta">
      <div class="meta-item"><span class="meta-label">Préparation</span><span class="meta-value">${recipe.prepTime} min</span></div>
      <div class="meta-item"><span class="meta-label">Cuisson</span><span class="meta-value">${recipe.cookTime} min</span></div>
      <div class="meta-item"><span class="meta-label">Portions</span><span class="meta-value">${recipe.servings}</span></div>
      ${recipe.healthScore ? `<div class="meta-item"><span class="meta-label">Score santé</span><span class="meta-value" style="color:${recipe.healthScore >= 70 ? "#4caf7d" : recipe.healthScore >= 50 ? "#f0c060" : "#e05252"}">${recipe.healthScore}/100</span></div>` : ""}
    </div>
    ${tags ? `<div class="tags">${tags}</div>` : ""}
  </div>

  ${recipe.ingredients?.length ? `
  <div class="section-title">Ingrédients</div>
  <div class="ingredients">${ingLines}</div>` : ""}

  ${recipe.steps?.length ? `
  <div class="section-title">Étapes</div>
  ${stepLines}` : ""}

  <div class="footer">
    <span class="footer-brand">Mijoté· v${__APP_VERSION__} — Cardamome</span>
    ${recipe.source ? `<span>Source : <a href="${recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source}" style="color:var(--accent)">${recipe.source.replace(/^https?:\/\//, "")}</a></span>` : ""}
  </div>
</body>
</html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 800);
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
      setSelectedRecipe(null);
    }
  };

  const confirmLeaveEditor = () => {
    setEditingRecipe(null);
    setTab(pendingTab);
    setSelectedRecipe(null);
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
      {tab === "meal-plan" && <MealPlanTab mealPlan={mealPlan} recipes={recipes} setMealPlan={setMealPlan} onSelectRecipe={setSelectedRecipe} ingredientDB={ingredientDB} user={user} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} />}
      {tab === "shopping" && <ShoppingTab shoppingLists={shoppingLists} setShoppingLists={setShoppingLists} ingredientDB={ingredientDB} user={user} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} />}
      {tab === "fridge" && <FridgeTab fridge={fridge} setFridge={setFridge} fridgeSettings={fridgeSettings} setFridgeSettings={setFridgeSettings} recipes={recipes} ingredientDB={ingredientDB} onSelectRecipe={setSelectedRecipe} user={user} syncStatus={syncStatus} onSignOut={handleSignOut} isDark={isDark} onToggleTheme={toggleTheme} categories={categories} />}
      {tab === "config" && <ConfigTab ingredientDB={ingredientDB} setIngredientDB={setIngredientDB} utensilDB={utensilDB} setUtensilDB={setUtensilDB} collections={collections} setCollections={setCollections} recipes={recipes} onExportAll={() => { const b = new Blob([JSON.stringify(recipes, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "all_recipes.json"; a.click(); notify("Export complet téléchargé"); }} onImport={importJSON} isDark={isDark} onToggleTheme={toggleTheme} user={user} onSignOut={handleSignOut} syncStatus={syncStatus} isAdmin={isAdmin} categories={categories} setCategories={setCategories} />}
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
  ) : tabContent;

  // Loading state
  if (user === undefined) return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <div id="root" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 32 }}>🫕</div>
        <div style={{ fontSize: 14, color: "var(--text3)" }}>Chargement…</div>
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
        .login-root{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;background:var(--bg);position:relative;overflow:hidden;}
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
          <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: notification.type === "error" ? "var(--red)" : "var(--green)", color: "#fff", padding: "10px 20px", borderRadius: 30, fontSize: 13, fontWeight: 500, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", whiteSpace: "nowrap", animation: "slideUp 0.2s" }}>
            {notification.msg}
          </div>
        )}
        {isDesktop ? (
          <>
            <DesktopSidebar tab={tab} setTab={requestTab} onNewRecipe={() => setEditingRecipe({ name: "", description: "", prepTime: 0, cookTime: 0, servings: 2, tags: [], ingredients: [], utensils: [], steps: [], collections: [], image: "" })} />
            {mainScreen}
          </>
        ) : (
          <>
            {mainScreen}
            <TabBar tab={tab} setTab={requestTab} />
          </>
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

// ─── TAB BAR (mobile) ────────────────────────────────────────────────────────
function TabBar({ tab, setTab }) {
  return (
    <div style={{ height: "var(--tab-h)", background: "var(--surface)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", flexShrink: 0 }}>
      {TABS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: active ? "var(--accent)" : "var(--text3)", transition: "color 0.15s", padding: "8px 0" }}>
            <Icon name={t.icon} size={20} color={active ? "var(--accent)" : "var(--text3)"} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── DESKTOP SIDEBAR ──────────────────────────────────────────────────────────
function DesktopSidebar({ tab, setTab, onNewRecipe }) {
  return (
    <div className="desktop-sidebar">
      <div className="desktop-sidebar-logo">Mijoté<span>·</span></div>
      <nav style={{ flex: 1 }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} className={`desktop-nav-item${active ? " active" : ""}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={18} color={active ? "var(--accent)" : "var(--text2)"} />
              {t.label}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "0 10px 14px", display: "flex", justifyContent: "center" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 9px", borderRadius: 20,
          background: "rgba(122, 155, 107, 0.18)",
          border: "1px solid rgba(122, 155, 107, 0.35)",
          color: "#8fba7a",
          fontSize: 11, fontWeight: 500, fontFamily: "var(--ff-body)", letterSpacing: "0.01em"
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8fba7a", flexShrink: 0 }} />
          {`v${__APP_VERSION__} — Cardamome`}
        </span>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", margin: "0 10px 14px" }} />
      <div style={{ padding: "0 10px" }}>
        <button className="btn btn-primary" style={{ width: "100%", borderRadius: 12 }} onClick={onNewRecipe}>
          <Icon name="plus" size={16} /> Nouvelle recette
        </button>
      </div>
    </div>
  );
}

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 8;

function HomeTab({ recipes, collections, ingredientDB, onSelect, onNewRecipe, setCollections, user, syncStatus, onSignOut, isDark, onToggleTheme }) {
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState(null);
  const [filterCol, setFilterCol] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  const allTags = [...new Set(recipes.flatMap(r => r.tags || []))];
  const filtered = recipes
    .filter(r => {
      if (search) {
        const q = normalizeStr(search);
        const inName = normalizeStr(r.name).includes(q);
        const inTags = r.tags?.some(t => normalizeStr(t).includes(q));
        const inIngredients = r.ingredients?.some(i => normalizeStr(i.name).includes(q));
        if (!inName && !inTags && !inIngredients) return false;
      }
      if (filterTag && !r.tags?.includes(filterTag)) return false;
      if (filterCol && !r.collections?.includes(filterCol)) return false;
      return true;
    })
    .sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name) : sortBy === "health" ? b.healthScore - a.healthScore : new Date(b.createdAt) - new Date(a.createdAt));

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, filterTag, filterCol, sortBy]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + PAGE_SIZE); },
      { rootMargin: "240px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, filtered.length]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Mes Recettes</h1><span className="app-brand" style={{ fontSize: 11, fontWeight: 500, color: "var(--text3)", letterSpacing: "0.04em", fontFamily: "var(--ff-body)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span> <span style={{ opacity: 0.5 }}>{`v${__APP_VERSION__}`}</span></span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-primary" style={{ padding: "8px 14px", borderRadius: 12 }} onClick={onNewRecipe}><Icon name="plus" size={16} /> Nouvelle</button>
            <UserAvatar user={user} syncStatus={syncStatus} onSignOut={onSignOut} isDark={isDark} onToggleTheme={onToggleTheme} />
          </div>
        </div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}><Icon name="search" size={16} color="var(--text3)" /></span>
          <input className="field-input" placeholder="Rechercher dans Mijoté" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }}><Icon name="close" size={14} /></button>}
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
          {["name", "health", "date"].map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: sortBy === s ? "var(--accent)" : "var(--surface2)", color: sortBy === s ? "#fff" : "var(--text2)", border: `1px solid ${sortBy === s ? "transparent" : "var(--border)"}` }}>
              {s === "name" ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, lineHeight: 1 }}>A<span style={{ fontSize: 9, position: "relative", top: "-1px", margin: "0 1px" }}>→</span>Z</span> : s === "health" ? "Santé" : "Récent"}
            </button>
          ))}
          {allTags.length > 0 && <div style={{ width: 1, background: "var(--border)", flexShrink: 0 }} />}
          {allTags.map(t => (
            <button key={t} onClick={() => setFilterTag(filterTag === t ? null : t)} style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: filterTag === t ? "rgba(232,112,58,0.2)" : "var(--surface2)", color: filterTag === t ? "var(--accent)" : "var(--text2)", border: `1px solid ${filterTag === t ? "rgba(232,112,58,0.5)" : "var(--border)"}` }}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
        {!search && !filterTag && !filterCol && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Collections</h2>
            <div className="collections-row" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {collections.map((col, i) => (
                <button key={col.id} onClick={() => setFilterCol(filterCol === col.id ? null : col.id)} style={{ flexShrink: 0, width: 120, background: filterCol === col.id ? "rgba(232,112,58,0.15)" : "var(--surface)", border: `1px solid ${filterCol === col.id ? "rgba(232,112,58,0.4)" : "var(--border)"}`, borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ aspectRatio: "3/2", position: "relative", background: col.color + "33", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span style={{ fontSize: 26, lineHeight: 1 }}>{col.icon || "📁"}</span>
                    <div style={{ position: "absolute", top: 6, right: 6, minWidth: 20, height: 20, borderRadius: 10, background: col.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", padding: "0 5px" }}>{col.count}</div>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, textAlign: "left" }}>{col.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)", textAlign: "left" }}>{col.count} recettes</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recettes <span style={{ color: "var(--text3)", fontWeight: 400, fontSize: 13 }}>({filtered.length})</span></h2>
          {filterCol && <button onClick={() => setFilterCol(null)} style={{ fontSize: 12, color: "var(--accent)" }}>Effacer filtre</button>}
        </div>
        <div className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {filtered.slice(0, visibleCount).map((r, idx) => <RecipeCard key={r.id} recipe={r} onClick={() => onSelect(r.id)} style={{ animationDelay: `${(idx % PAGE_SIZE) * 0.04}s` }} />)}
        </div>
        {visibleCount < filtered.length && (
          <div ref={sentinelRef} style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <div style={{ width: 22, height: 22, border: "2.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
          </div>
        )}
        {filtered.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: "40px 0" }}><Icon name="search" size={32} /><br /><span style={{ fontSize: 14, marginTop: 8, display: "block" }}>Aucune recette trouvée</span></div>}
      </div>
    </div>
  );
}

function RecipeCard({ recipe, onClick, style }) {
  const total = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const score = recipe.healthScore || 70;
  return (
    <button className="slide-up" onClick={onClick} style={{ background: "var(--surface)", borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--border)", textAlign: "left", transition: "border-color 0.15s", ...style }}>
      <div style={{ aspectRatio: "16/10", position: "relative" }}>
        <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(to top,rgba(0,0,0,0.7),transparent)" }} />
      </div>
      <div style={{ padding: "10px 10px 12px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{recipe.name}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--text2)", display: "flex", alignItems: "center", gap: 4 }}><Icon name="clock" size={11} color="var(--text3)" /> {fmtTime(total)}</span>
          <HealthRing score={score} size={32} />
        </div>
      </div>
    </button>
  );
}

// ─── RECIPE DETAIL ────────────────────────────────────────────────────────────
function RecipeDetail({ recipe, onBack, onEdit, onDelete, onAddToShopping, onAddToMealPlan, onExportJSON, onExportPDF, ingredientDB, utensilDB, collections, onUpdateCollections, onToggleCollection }) {
  const [servings, setServings] = useState(recipe.servings || 2);
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
  const isProgrammaticScroll = useRef(false);
  const mult = servings / (recipe.servings || 2);

  const getIngImage = dbId => ingredientDB.find(d => d.id === dbId)?.image || "";
  const getUtImage = dbId => utensilDB.find(d => d.id === dbId)?.image || "";

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", height: 220, flexShrink: 0, color: "#fff" }}>
        <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.5) 0%,transparent 40%,rgba(14,14,15,0.95) 100%)" }} />
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
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.7)", textDecoration: "none", marginTop: 1, marginBottom: 8 }}>
              <Icon name="forward" size={11} color="rgba(255,255,255,0.7)" />
              {recipe.source.replace(/^https?:\/\//, "")}
            </a>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {recipe.tags?.map(t => <span key={t} className="tag" style={{ fontSize: 10, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }}>{t}</span>)}
            {(recipe.collections || []).map(cid => { const col = (collections || []).find(c => c.id === cid); return col ? <span key={cid} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: col.color + "33", color: col.color, border: `1px solid ${col.color}66` }}>{col.name}</span> : null; })}
            <button onClick={() => setShowCollModal(true)} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 500, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", gap: 4 }}><Icon name="plus" size={10} color="#fff" /> Collection</button>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div style={{ display: "flex", background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "10px 16px", flexShrink: 0 }}>
        {[{ label: "Prép.", value: fmtTime(recipe.prepTime), icon: "clock" }, { label: "Cuisson", value: fmtTime(recipe.cookTime), icon: "fire" }, { label: "Santé", value: <HealthRing score={recipe.healthScore || 70} size={34} />, icon: null }].map((item, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            {item.icon && <Icon name={item.icon} size={13} color="var(--text3)" />}
            {typeof item.value === "string" ? <span style={{ fontSize: 14, fontWeight: 600 }}>{item.value}</span> : item.value}
            <span style={{ fontSize: 10, color: "var(--text3)" }}>{item.label}</span>
          </div>
        ))}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <div style={{ height: 13 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <button onClick={() => setServings(s => Math.max(1, s - 1))} style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontSize: 14 }}>−</button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 18, textAlign: "center" }}>{servings}</span>
            <button onClick={() => setServings(s => s + 1)} style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14 }}>+</button>
          </div>
          <span style={{ fontSize: 10, color: "var(--text3)" }}>Portions</span>
        </div>
      </div>

      {/* Action bar — always visible on all screen sizes */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px", background: isDesktop ? "var(--bg)" : "var(--surface)", borderBottom: isDesktop ? "none" : "1px solid var(--border)", flexShrink: 0 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setSelectedIngs(recipe.ingredients.map(i => i.id)); setShowShoppingModal(true); }}><Icon name="shopping" size={15} /> Ajouter aux courses</button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowMealModal(true)}><Icon name="calendar" size={15} /> Planifier</button>
      </div>

      {/* Mobile tabs / Desktop 2-col */}
      <div className="detail-tabs-mobile" style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0 }}>
        {["Ingrédients", "Ustensiles", "Étapes"].map((t, i) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 500, color: activeTab === t ? "var(--accent)" : "var(--text3)", borderBottom: `2px solid ${activeTab === t ? "var(--accent)" : "transparent"}`, transition: "color 0.15s, border-color 0.15s" }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
        {/* ── MOBILE: swiper ── */}
        <div id="detail-swiper" className="detail-mobile-content"
          onTouchStart={e => {
            const el = e.currentTarget;
            el._tx = e.touches[0].clientX;
            el._ty = e.touches[0].clientY;
            el._lockAxis = null;
            el._dragging = false;
          }}
          onTouchMove={e => {
            const el = e.currentTarget;
            const dx = e.touches[0].clientX - el._tx;
            const dy = Math.abs(e.touches[0].clientY - el._ty);
            if (el._lockAxis === null && (Math.abs(dx) > 6 || dy > 6)) {
              el._lockAxis = Math.abs(dx) > dy ? "x" : "y";
            }
            if (el._lockAxis === "x") {
              e.preventDefault();
              el._dragging = true;
              const tabs = ["Ingrédients", "Ustensiles", "Étapes"];
              const curIdx = tabs.indexOf(activeTab);
              const inner = el.querySelector(".swiper-inner");
              if (inner) inner.style.transform = `translateX(calc(${-curIdx * 100}% + ${dx}px))`;
            }
          }}
          onTouchEnd={e => {
            const el = e.currentTarget;
            if (!el._dragging) return;
            const dx = e.changedTouches[0].clientX - el._tx;
            const tabs = ["Ingrédients", "Ustensiles", "Étapes"];
            const curIdx = tabs.indexOf(activeTab);
            let nextIdx = curIdx;
            if (dx < -50 && curIdx < tabs.length - 1) nextIdx = curIdx + 1;
            else if (dx > 50 && curIdx > 0) nextIdx = curIdx - 1;
            const inner = el.querySelector(".swiper-inner");
            if (inner) {
              inner.style.transition = "transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)";
              inner.style.transform = `translateX(${-nextIdx * 100}%)`;
              setTimeout(() => { if (inner) inner.style.transition = ""; }, 300);
            }
            setActiveTab(tabs[nextIdx]);
            el._dragging = false;
          }}
          style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div className="swiper-inner" style={{ display: "flex", width: "100%", height: "100%", transform: `translateX(${-["Ingrédients", "Ustensiles", "Étapes"].indexOf(activeTab) * 100}%)` }}>
            {/* Slide 1 — Ingrédients */}
            <div style={{ minWidth: "100%", padding: 16, overflowY: "auto", height: "100%" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recipe.ingredients.map(ing => (
                  <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", borderRadius: 12, padding: "10px 14px", border: "1px solid var(--border)" }}>
                    <IngImage src={getIngImage(ing.dbId)} alt={ing.name} size={50} />
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{ing.name}</div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>{+(ing.amount * mult).toFixed(2)}</span>
                      <span style={{ fontSize: 12, color: "var(--text2)", marginLeft: 4 }}>{ing.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ height: 16 }} />
            </div>
            {/* Slide 2 — Ustensiles */}
            <div style={{ minWidth: "100%", padding: 16, overflowY: "auto", height: "100%" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {(recipe.utensils || []).map(u => (
                  <div key={u.id} style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", padding: 14, gap: 8 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", background: "var(--surface2)" }}><Img src={getUtImage(u.dbId)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                    <span style={{ fontSize: 13, fontWeight: 500, textAlign: "center" }}>{u.name}</span>
                  </div>
                ))}
                {(!recipe.utensils || recipe.utensils.length === 0) && <p style={{ color: "var(--text3)", fontSize: 14, gridColumn: "1/-1" }}>Aucun ustensile.</p>}
              </div>
              <div style={{ height: 16 }} />
            </div>
            {/* Slide 3 — Étapes */}
            <div style={{ minWidth: "100%", padding: 16, overflowY: "auto", overflowX: "hidden", height: "100%" }}>
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
                              <IngImage src={getIngImage(ing.dbId)} alt={ing.name} size={22} />
                              {ing.name}
                              <span style={{ color: "var(--text3)", fontWeight: 400, marginLeft: 2 }}>{+(ing.amount * mult).toFixed(2)}{ing.unit}</span>
                            </span>
                          ))}
                          {linkedUts.map(u => (
                            <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--surface2)", borderRadius: 20, padding: "4px 10px 4px 4px", fontWeight: 500, color: "var(--text)", border: "1px solid var(--border)" }}>
                              <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", background: "var(--surface3)", flexShrink: 0 }}><Img src={getUtImage(u.dbId)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                              {u.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ height: 16 }} />
            </div>
          </div>{/* end swiper-inner */}
        </div>

        {/* ── DESKTOP: 2-column layout (hidden on mobile via CSS) ── */}
        <div className="detail-desktop-content" style={{ display: "none", flex: 1, overflow: "hidden", background: "var(--bg)", padding: 16, gap: 16 }}>
          {/* Left col: ingrédients + ustensiles (card) */}
          <div style={{ width: 300, minWidth: 300, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Ingrédients</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {recipe.ingredients.map(ing => (
                  <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <IngImage src={getIngImage(ing.dbId)} alt={ing.name} size={48} />
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
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Ustensiles</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {recipe.utensils.map(u => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface2)", borderRadius: 12, padding: "7px 14px 7px 8px", border: "1px solid var(--border)" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", background: "var(--surface3)", flexShrink: 0 }}><Img src={getUtImage(u.dbId)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
          {/* Right col: étapes (card) */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: 20, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Étapes</div>
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
                            <IngImage src={getIngImage(ing.dbId)} alt={ing.name} size={24} />
                            {ing.name}
                            <span style={{ color: "var(--text3)", fontWeight: 500 }}>{+(ing.amount * mult).toFixed(2)}{ing.unit}</span>
                          </span>
                        ))}
                        {linkedUts.map(u => (
                          <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "var(--surface3)", flexShrink: 0 }}><Img src={getUtImage(u.dbId)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
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
      {cookMode && recipe.steps?.length > 0 && (
        <CookMode recipe={recipe} mult={mult} ingredientDB={ingredientDB} onClose={() => setCookMode(false)} />
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




// ─── TEXT NORMALIZER (accents + case) ────────────────────────────────────────
function normalizeStr(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// ─── INGREDIENT INPUT PARSER ──────────────────────────────────────────────────
function parseIngredientInput(raw) {
  if (!raw || !raw.trim()) return { amount: "", unit: "", name: raw.trim() };
  const s = raw.trim();

  // Known multi-word units (order matters — longest first)
  const UNITS = [
    "cuillère à soupe", "cuillères à soupe", "c. à soupe", "c.à.s",
    "cuillère à café", "cuillères à café", "c. à café", "c.à.c",
    "kg", "g", "mg", "l", "litre", "litres", "cl", "ml", "dl",
    "pièce", "pièces", "pce", "pc",
    "tranche", "tranches", "botte", "bottes", "sachet", "sachets",
    "gousse", "gousses", "feuille", "feuilles", "branche", "branches",
    "pincée", "pincées", "poignée", "poignées", "verre", "verres",
    "bol", "bols", "tasse", "tasses", "boîte", "boîtes", "pot", "pots",
  ];

  // Try to match: number (+ fraction) + optional unit + rest
  const fracMap = { "1/2": 0.5, "1/3": 0.333, "2/3": 0.667, "1/4": 0.25, "3/4": 0.75 };
  const numRe = /^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s*/;
  const fracRe = /^(1\/2|1\/3|2\/3|1\/4|3\/4)\s*/;

  let rest = s;
  let amount = "";

  // Extract number
  let mFrac = rest.match(fracRe);
  let mNum = rest.match(numRe);
  if (mFrac) {
    amount = String(fracMap[mFrac[1]] || mFrac[1]);
    rest = rest.slice(mFrac[0].length);
  } else if (mNum) {
    amount = mNum[1].replace(",", ".");
    rest = rest.slice(mNum[0].length);
    // Check for fraction after number e.g. "1 1/2"
    let mFrac2 = rest.match(fracRe);
    if (mFrac2) {
      amount = String(parseFloat(amount) + (fracMap[mFrac2[1]] || 0));
      rest = rest.slice(mFrac2[0].length);
    }
  }

  if (!amount) return { amount: "", unit: "", name: s };

  // Extract unit
  let unit = "";
  const restLower = rest.toLowerCase();
  for (const u of UNITS) {
    if (restLower.startsWith(u.toLowerCase())) {
      unit = u;
      rest = rest.slice(u.length).trim();
      // Remove leading "de", "d'" after unit
      rest = rest.replace(/^d[e']?\s*/i, "").trim();
      break;
    }
  }

  return { amount: parseFloat(amount) || amount, unit, name: rest.trim() };
}

// ─── TAG INPUT ────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange, allTags }) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const suggestions = allTags.filter(t =>
    t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t) && input.length > 0
  );

  const addTag = tag => {
    const t = tag.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };
  const removeTag = t => onChange(tags.filter(x => x !== t));

  return (
    <div>
      <div className="field-label">Tags</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", minHeight: 42, cursor: "text" }}
        onClick={() => document.getElementById("tag-input-field").focus()}>
        {tags.map(t => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: "rgba(232,112,58,0.15)", color: "var(--accent)", border: "1px solid rgba(232,112,58,0.3)" }}>
            {t}
            <button onClick={e => { e.stopPropagation(); removeTag(t); }} style={{ fontSize: 14, lineHeight: 1, color: "var(--accent)", padding: 0 }}>×</button>
          </span>
        ))}
        <input id="tag-input-field" value={input} onChange={e => setInput(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={e => { if ((e.key === "," || e.key === "Enter") && input.trim()) { e.preventDefault(); addTag(input); } if (e.key === "Backspace" && !input && tags.length) removeTag(tags[tags.length - 1]); }}
          placeholder={tags.length === 0 ? "Végétarien, Rapide…" : ""}
          style={{ border: "none", background: "none", outline: "none", fontSize: 14, color: "var(--text)", minWidth: 100, flex: 1, fontFamily: "var(--ff-body)", padding: "1px 2px" }} />
      </div>
      {focused && suggestions.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, marginTop: 4, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
          {suggestions.slice(0, 6).map(s => (
            <button key={s} onMouseDown={() => addTag(s)}
              style={{ display: "block", width: "100%", padding: "9px 14px", fontSize: 13, textAlign: "left", color: "var(--text2)" }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RECIPE EDITOR ────────────────────────────────────────────────────────────
function RecipeEditor({ recipe, onSave, onCancel, ingredientDB, utensilDB, collections, recipes }) {
  const [form, setForm] = useState({ ...recipe, ingredients: recipe.ingredients || [], utensils: recipe.utensils || [], steps: recipe.steps || [], tags: recipe.tags || [], collections: recipe.collections || [] });
  const [section, setSection] = useState("info");
  const up = (f, v) => setForm(p => ({ ...p, [f]: v }));

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
        <button className="btn btn-primary" style={{ padding: "8px 16px" }} onClick={() => onSave(form)}><Icon name="check" size={15} /> Sauvegarder</button>
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
                <div><div className="field-label">Portions</div><input className="field-input" type="number" min="1" value={form.servings} onChange={e => up("servings", +e.target.value)} /></div>
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
                      const match = parsed.name ? ingredientDB.find(d => normalizeStr(d.name) === normalizeStr(parsed.name)) : null;
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
                      {(ing.amount !== undefined && ing.amount !== "") && <span style={{ fontSize: 11, background: "rgba(240,192,96,0.15)", color: "var(--yellow)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Quantité : {ing.amount}</span>}
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
        <div style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {form.utensils.map(u => (
              <div key={u.id} style={{ background: "var(--surface)", borderRadius: 12, padding: 14, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <select className="field-input" value={u.dbId} onChange={e => {
                    const item = utensilDB.find(d => d.id === e.target.value);
                    up("utensils", form.utensils.map(x => x.id === u.id ? { ...x, dbId: e.target.value, name: item?.name || "" } : x));
                  }}>
                    <option value="">— Sélectionner —</option>
                    {utensilDB.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <button onClick={() => remUt(u.id)}><Icon name="trash" size={14} color="var(--red)" /></button>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ width: "100%" }} onClick={addUt}><Icon name="plus" size={16} /> Ajouter un ustensile</button>
          </div>
          <div style={{ height: 20 }} />
        </div>

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

// ─── AUTO-RESIZE TEXTAREA ─────────────────────────────────────────────────────
function AutoResizeTextarea({ value, onChange, placeholder, className, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea ref={ref} className={className} placeholder={placeholder} value={value} onChange={onChange}
      style={{ resize: "none", overflow: "hidden", minHeight: 76, ...style }} />
  );
}

// ─── DRAGGABLE STEP ───────────────────────────────────────────────────────────
function DraggableStep({ step, index, total, ingredients, utensils, onUpdate, onRemove, onMove }) {
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("stepIdx", String(index)); setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); const from = +e.dataTransfer.getData("stepIdx"); if (from !== index) onMove(from, index); }}
      style={{ background: "var(--surface)", borderRadius: 12, padding: 14, border: `1px solid ${over ? "var(--accent)" : "var(--border)"}`, opacity: dragging ? 0.5 : 1, transition: "opacity 0.15s, border-color 0.15s", cursor: "grab" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--text3)", cursor: "grab" }}><Icon name="drag" size={16} color="var(--text3)" /></span>
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{index + 1}</span>
          <div style={{ display: "flex", gap: 4 }}>
            {index > 0 && <button onClick={() => onMove(index, index - 1)} style={{ padding: "2px 6px", borderRadius: 6, background: "var(--surface2)", fontSize: 11, border: "1px solid var(--border)" }}>↑</button>}
            {index < total - 1 && <button onClick={() => onMove(index, index + 1)} style={{ padding: "2px 6px", borderRadius: 6, background: "var(--surface2)", fontSize: 11, border: "1px solid var(--border)" }}>↓</button>}
          </div>
        </div>
        <button onClick={() => onRemove(step.id)}><Icon name="trash" size={14} color="var(--red)" /></button>
      </div>
      <AutoResizeTextarea className="field-input" placeholder="Instructions…" value={step.text} onChange={e => onUpdate(step.id, "text", e.target.value)} style={{ marginBottom: 10 }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Ingrédients liés</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {ingredients.map(ing => {
          const linked = step.ingredients?.includes(ing.id); return (
            <button key={ing.id} onClick={() => onUpdate(step.id, "ingredients", linked ? step.ingredients.filter(x => x !== ing.id) : [...(step.ingredients || []), ing.id])}
              style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: linked ? "rgba(232,112,58,0.2)" : "var(--surface2)", color: linked ? "var(--accent)" : "var(--text3)", border: `1px solid ${linked ? "rgba(232,112,58,0.5)" : "var(--border)"}`, display: "flex", alignItems: "center", gap: 4 }}>
              {ing.name || "?"}
              {linked && <span style={{ fontSize: 10, color: "var(--accent2)" }}>{ing.amount}{ing.unit}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Ustensiles liés</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {utensils.map(u => {
          const linked = step.utensils?.includes(u.id); return (
            <button key={u.id} onClick={() => onUpdate(step.id, "utensils", linked ? step.utensils.filter(x => x !== u.id) : [...(step.utensils || []), u.id])}
              style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: linked ? "rgba(76,175,125,0.2)" : "var(--surface2)", color: linked ? "var(--green)" : "var(--text3)", border: `1px solid ${linked ? "rgba(76,175,125,0.5)" : "var(--border)"}` }}>
              {u.name || "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── MEAL PLAN — module-level constants & pure helpers ────────────────────────
const MP_DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MP_MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MP_SLOT_LABEL = { midi: "🌤 Midi", soir: "🌙 Soir" };
const MP_SLOT_COLOR = { midi: "rgba(240,192,96,0.18)", soir: "rgba(91,156,246,0.18)" };
const MP_SLOT_TEXT = { midi: "var(--yellow)", soir: "var(--blue)" };
const MP_SLOT_TIMES = { midi: { start: "120000", end: "133000" }, soir: { start: "193000", end: "210000" } };

function mpGetWeekDays(ref) {
  const d = new Date(ref), day = d.getDay(), diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd.toISOString().slice(0, 10); });
}
function mpGetMonthDays(ref) {
  const y = ref.getFullYear(), m = ref.getMonth(), first = new Date(y, m, 1), last = new Date(y, m + 1, 0), days = [];
  for (let i = 0; i < (first.getDay() || 7) - 1; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m, d).toISOString().slice(0, 10));
  return days;
}
function mpPad(n) { return String(n).padStart(2, "0"); }
function mpToICSDate(dateStr, timeStr) { return dateStr.split("-").join("") + "T" + timeStr; }
function mpEscapeICS(s) { return (s || "").split("\n").join("\\n").split(",").join("\\,").split(";").join("\\;"); }

// SlotZone lifted out + memoised → never re-created on parent re-render
const SlotZone = React.memo(function SlotZone({ date, slot, meals, dropTarget, dragInfo, mealPlan, recipes, onSelectRecipe, onRemoveMeal, onMoveMeal, onSetDropTarget, onSetDragInfo }) {
  const dropKey = date + ":" + slot;
  const isOver = dropTarget === dropKey;
  return (
    <div
      onDragOver={e => { e.preventDefault(); onSetDropTarget(dropKey); }}
      onDragLeave={() => onSetDropTarget(null)}
      onDrop={e => { e.preventDefault(); onSetDropTarget(null); if (dragInfo && !(dragInfo.date === date && dragInfo.slot === slot)) { onMoveMeal(dragInfo.date, dragInfo.idx, date, slot); } onSetDragInfo(null); }}
      style={{ borderRadius: 10, padding: "6px 8px", background: isOver ? "rgba(232,112,58,0.12)" : MP_SLOT_COLOR[slot], border: `1px solid ${isOver ? "var(--accent)" : "transparent"}`, transition: "all 0.15s", minHeight: meals.length ? "auto" : 10 }}>
      {meals.map((meal, mi) => {
        const globalIdx = (mealPlan[date] || []).indexOf(meal);
        const r = recipes.find(x => x.id === meal.recipeId);
        if (!r) return null;
        return (
          <div key={mi} draggable
            onDragStart={() => onSetDragInfo({ date, idx: globalIdx, slot })}
            onDragEnd={() => onSetDragInfo(null)}
            style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: mi < meals.length - 1 ? 6 : 0, cursor: "grab" }}>
            <div style={{ width: 46, height: 46, borderRadius: 9, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
            <button onClick={() => onSelectRecipe(r.id)} style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25, marginBottom: 2 }}>{r.name}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: MP_SLOT_TEXT[slot] }}>{MP_SLOT_LABEL[slot]}</div>
              {meal.portions > 1 && <div style={{ fontSize: 9, color: "var(--text3)" }}>1/{meal.portions}</div>}
            </button>
            <button onClick={() => onRemoveMeal(date, globalIdx)} style={{ color: "var(--text3)", flexShrink: 0, padding: 2 }}><Icon name="close" size={11} /></button>
          </div>
        );
      })}
    </div>
  );
});

// ─── MEAL PLAN TAB ────────────────────────────────────────────────────────────
function MealPlanTab({ mealPlan, recipes, setMealPlan, onSelectRecipe, ingredientDB, user, syncStatus, onSignOut, isDark, onToggleTheme }) {
  const [viewMode, setViewMode] = useState("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dragInfo, setDragInfo] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [addModal, setAddModal] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [icsStatus, setIcsStatus] = useState(null);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const weekDays = useMemo(() => mpGetWeekDays(currentDate), [currentDate]);
  const monthDays = useMemo(() => mpGetMonthDays(currentDate), [currentDate]);

  const getMeals = useCallback((date, slot) => (mealPlan[date] || []).filter(m => m.slot === slot), [mealPlan]);

  const removeMeal = useCallback((date, idx) => setMealPlan(prev => { const arr = [...(prev[date] || [])]; arr.splice(idx, 1); return { ...prev, [date]: arr }; }), [setMealPlan]);
  const moveMeal = useCallback((fromDate, fromIdx, toDate, toSlot) => setMealPlan(prev => {
    if (fromDate === toDate) {
      // Same day: splice + re-insert in one atomic array operation
      const arr = [...(prev[fromDate] || [])];
      const [item] = arr.splice(fromIdx, 1);
      item.slot = toSlot;
      arr.push(item);
      return { ...prev, [fromDate]: arr };
    }
    // Different days
    const from = [...(prev[fromDate] || [])];
    const [item] = from.splice(fromIdx, 1);
    item.slot = toSlot;
    return { ...prev, [fromDate]: from, [toDate]: [...(prev[toDate] || []), item] };
  }), [setMealPlan]);
  const addMeal = useCallback((date, slots, recipeId) => {
    setMealPlan(prev => { const e = [...(prev[date] || [])]; slots.forEach(slot => e.push({ recipeId, slot, portions: 1 })); return { ...prev, [date]: e }; });
    setAddModal(null); setSearchQ("");
  }, [setMealPlan]);

  const navigate = useCallback(dir => setCurrentDate(prev => {
    const d = new Date(prev);
    if (viewMode === "week") d.setDate(d.getDate() + dir * 7); else d.setMonth(d.getMonth() + dir);
    return d;
  }), [viewMode]);

  const openAdd = useCallback((date, slots) => { setAddModal({ date, slots }); setSearchQ(""); }, []);

  const filteredRecipes = useMemo(() =>
    recipes.filter(r => !searchQ || r.name.toLowerCase().includes(searchQ.toLowerCase())),
    [recipes, searchQ]
  );

  const SLOT_TIMES = MP_SLOT_TIMES;

  const pad = mpPad;
  const toICSDate = mpToICSDate; // eslint-disable-line
  const escapeICS = mpEscapeICS;

  const exportICS = () => {
    setIcsStatus(null);
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RecipeApp//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    let count = 0;

    Object.entries(mealPlan).forEach(([date, meals]) => {
      (meals || []).forEach(meal => {
        const recipe = recipes.find(r => r.id === meal.recipeId);
        if (!recipe) return;
        const slot = meal.slot || "midi";
        const times = SLOT_TIMES[slot];
        const slotLabel = slot === "midi" ? "Déjeuner" : "Dîner";
        const uid = `${date}-${slot}-${recipe.id}@recipeapp`;
        const now = new Date();
        const dtstamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`;

        const descParts = [
          recipe.description,
          meal.portions > 1 ? `${recipe.servings} portions sur ${meal.portions} jours` : "",
          `Préparation : ${recipe.prepTime} min`,
          `Cuisson : ${recipe.cookTime} min`,
          `Score santé : ${recipe.healthScore || "—"}/100`,
          recipe.ingredients?.map(i => `• ${i.name} ${i.amount} ${i.unit}`).join("\n") || "",
          recipe.source ? `Source : ${recipe.source}` : "",
        ].filter(Boolean).join("\n");

        lines.push(
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART;TZID=Europe/Paris:${toICSDate(date, times.start)}`,
          `DTEND;TZID=Europe/Paris:${toICSDate(date, times.end)}`,
          `SUMMARY:${escapeICS(slotLabel + " — " + recipe.name)}`,
          `DESCRIPTION:${escapeICS(descParts)}`,
          `CATEGORIES:${escapeICS(slotLabel)}`,
          "END:VEVENT"
        );
        count++;
      });
    });

    lines.push("END:VCALENDAR");

    if (count === 0) { setIcsStatus("empty"); return; }

    const CRLF = "\r\n";
    const blob = new Blob([lines.join(CRLF)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "planning_repas.ics";
    a.click();
    URL.revokeObjectURL(a.href);
    setIcsStatus("done");
    setTimeout(() => setIcsStatus(null), 3000);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}><h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Planning repas</h1><span className="app-brand" style={{ fontSize: 11, fontWeight: 500, color: "var(--text3)", letterSpacing: "0.04em", fontFamily: "var(--ff-body)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span> <span style={{ opacity: 0.5 }}>{`v${__APP_VERSION__}`}</span></span></div>
          <UserAvatar user={user} syncStatus={syncStatus} onSignOut={onSignOut} isDark={isDark} onToggleTheme={onToggleTheme} />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
          <button onClick={() => setViewMode("week")} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: viewMode === "week" ? "var(--accent)" : "var(--surface2)", color: viewMode === "week" ? "#fff" : "var(--text2)", border: `1px solid ${viewMode === "week" ? "transparent" : "var(--border)"}` }}>Semaine</button>
          <button onClick={() => setViewMode("month")} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: viewMode === "month" ? "var(--accent)" : "var(--surface2)", color: viewMode === "month" ? "#fff" : "var(--text2)", border: `1px solid ${viewMode === "month" ? "transparent" : "var(--border)"}` }}>Mois</button>
          <button onClick={exportICS} title="Exporter en .ics (Google Calendar, Apple Calendar…)" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(91,156,246,0.15)", border: "1px solid rgba(91,156,246,0.35)", color: "var(--blue)", flexShrink: 0 }}>
            <Icon name="download" size={13} color="var(--blue)" /> .ics
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navigate(-1)} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="back" size={16} /></button>
          <span style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
            {viewMode === "week"
              ? `${new Date(weekDays[0] + "T12:00").getDate()} — ${new Date(weekDays[6] + "T12:00").getDate()} ${MP_MONTHS_FR[new Date(weekDays[6] + "T12:00").getMonth()]} ${new Date(weekDays[6] + "T12:00").getFullYear()}`
              : `${MP_MONTHS_FR[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          </span>
          <button onClick={() => navigate(1)} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="forward" size={16} /></button>
          <button onClick={() => setCurrentDate(new Date())} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(232,112,58,0.15)", color: "var(--accent)", border: "1px solid rgba(232,112,58,0.3)" }}>Auj.</button>
        </div>
        {icsStatus && (
          <div style={{ marginTop: 8, padding: "8px 14px", borderRadius: 10, background: icsStatus === "done" ? "rgba(76,175,125,0.15)" : "rgba(232,112,58,0.12)", border: `1px solid ${icsStatus === "done" ? "rgba(76,175,125,0.35)" : "rgba(232,112,58,0.35)"}`, fontSize: 12 }}>
            {icsStatus === "done" && <span style={{ color: "var(--green)" }}>✓ planning_repas.ics téléchargé — ouvre-le pour importer dans Google Calendar</span>}
            {icsStatus === "empty" && <span style={{ color: "var(--accent2)" }}>⚠ Aucun repas dans le planning à exporter</span>}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 16px" }}>
        {viewMode === "week" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {weekDays.map(date => {
              const isToday = date === todayStr;
              const d = new Date(date + "T12:00");
              return (
                <div key={date} style={{ background: "var(--surface)", borderRadius: 14, padding: 10, border: `1px solid ${isToday ? "rgba(232,112,58,0.5)" : "var(--border)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text)" }}>
                        {MP_DAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1]} {d.getDate()}
                      </span>
                      {isToday && <span style={{ fontSize: 10, background: "rgba(232,112,58,0.2)", color: "var(--accent)", padding: "2px 7px", borderRadius: 10 }}>Aujourd'hui</span>}
                    </div>
                    <button onClick={() => openAdd(date, ["midi", "soir"])} style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon name="plus" size={13} color="var(--text2)" />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <SlotZone date={date} slot="midi" meals={getMeals(date, "midi")} dropTarget={dropTarget} dragInfo={dragInfo} mealPlan={mealPlan} recipes={recipes} onSelectRecipe={onSelectRecipe} onRemoveMeal={removeMeal} onMoveMeal={moveMeal} onSetDropTarget={setDropTarget} onSetDragInfo={setDragInfo} />
                    <SlotZone date={date} slot="soir" meals={getMeals(date, "soir")} dropTarget={dropTarget} dragInfo={dragInfo} mealPlan={mealPlan} recipes={recipes} onSelectRecipe={onSelectRecipe} onRemoveMeal={removeMeal} onMoveMeal={moveMeal} onSetDropTarget={setDropTarget} onSetDragInfo={setDragInfo} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "month" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
              {MP_DAYS_SHORT.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--text3)", padding: "4px 0" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
              {monthDays.map((date, i) => {
                if (!date) return <div key={i} />;
                const isToday = date === todayStr;
                const d = new Date(date + "T12:00");
                const midiMeals = getMeals(date, "midi");
                const soirMeals = getMeals(date, "soir");
                return (
                  <button key={date} onClick={() => openAdd(date, ["midi"])}
                    style={{ background: "var(--surface)", borderRadius: 10, padding: "5px 4px", minHeight: 64, border: `1px solid ${isToday ? "rgba(232,112,58,0.5)" : "var(--border)"}`, textAlign: "left", cursor: "pointer" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? "var(--accent)" : "var(--text3)", textAlign: "center", marginBottom: 4 }}>{d.getDate()}</div>
                    {midiMeals.slice(0, 1).map((m, mi) => { const r = recipes.find(x => x.id === m.recipeId); return r ? <div key={mi} style={{ background: MP_SLOT_COLOR.midi, borderRadius: 3, padding: "1px 3px", fontSize: 8, color: MP_SLOT_TEXT.midi, marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div> : null; })}
                    {soirMeals.slice(0, 1).map((m, mi) => { const r = recipes.find(x => x.id === m.recipeId); return r ? <div key={mi} style={{ background: MP_SLOT_COLOR.soir, borderRadius: 3, padding: "1px 3px", fontSize: 8, color: MP_SLOT_TEXT.soir, marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div> : null; })}
                    {(midiMeals.length + soirMeals.length) > 2 && <div style={{ fontSize: 8, color: "var(--text3)", textAlign: "center" }}>+{midiMeals.length + soirMeals.length - 2}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add recipe modal */}
      {addModal && (
        <SwipeableSheet onClose={() => { setAddModal(null); setSearchQ(""); }} style={{ maxHeight: "80dvh" }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Ajouter une recette</h3>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 12 }}>
            {new Date(addModal.date + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div className="field-label" style={{ marginBottom: 8 }}>Repas (multi-sélection possible)</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["midi", "soir"].map(s => {
                const active = addModal.slots.includes(s);
                const toggle = () => setAddModal(p => {
                  const cur = p.slots.includes(s) ? p.slots.filter(x => x !== s) : [...p.slots, s];
                  return { ...p, slots: cur.length ? cur : p.slots };
                });
                return (
                  <button key={s} onClick={toggle} style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: active ? MP_SLOT_TEXT[s] : "var(--surface2)", color: active ? "#000" : "var(--text2)", border: `2px solid ${active ? MP_SLOT_TEXT[s] : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}>
                    {active && <Icon name="check" size={14} color="#000" />}
                    {MP_SLOT_LABEL[s]}
                  </button>
                );
              })}
            </div>
            {addModal.slots.length === 2 && <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6, textAlign: "center" }}>La recette sera ajoutée aux deux repas</div>}
          </div>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}><Icon name="search" size={15} color="var(--text3)" /></span>
            <input className="field-input" placeholder="Rechercher une recette…" value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ paddingLeft: 34 }} autoFocus />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: "44vh" }}>
            {filteredRecipes.map(r => (
              <button key={r.id} onClick={() => addMeal(addModal.date, addModal.slots, r.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface2)", borderRadius: 12, border: "1px solid var(--border)", textAlign: "left" }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{(r.prepTime || 0) + (r.cookTime || 0)}min · {r.servings} portions</div>
                </div>
                <HealthRing score={r.healthScore || 70} size={30} />
              </button>
            ))}
            {filteredRecipes.length === 0 && <p style={{ textAlign: "center", color: "var(--text3)", padding: "20px 0", fontSize: 13 }}>Aucune recette trouvée</p>}
          </div>
        </SwipeableSheet>
      )}
    </div>
  );
}


// ─── COOK MODE ────────────────────────────────────────────────────────────────
function CookMode({ recipe, mult, ingredientDB, onClose }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);


  const step = recipe.steps[stepIdx];
  const total = recipe.steps.length;
  const linkedIngs = recipe.ingredients.filter(i => step.ingredients?.includes(i.id));

  const getIngImage = dbId => ingredientDB.find(d => d.id === dbId)?.image || "";
  const progress = ((stepIdx + 1) / total) * 100;

  return (
    <>
      {done && (
        <div style={{ position: "fixed", inset: 0, zIndex: 501, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "cookModeIn 0.4s ease", padding: 32, textAlign: "center" }}>
          {/* Floating emojis */}
          {["🍽️", "✨", "🎉", "👨‍🍳", "⭐", "🥳"].map((e, i) => (
            <span key={i} style={{
              position: "absolute", fontSize: 28 + i * 4, animation: `floatUp ${1.2 + i * 0.3}s ease forwards`, animationDelay: `${i * 0.15}s`,
              left: `${10 + i * 14}%`, top: `${60 + Math.sin(i) * 15}%`, pointerEvents: "none"
            }}>{e}</span>
          ))}
          <div style={{ animation: "popIn 0.6s cubic-bezier(0.34,1.56,0.64,1)", marginBottom: 24 }}>
            <div style={{ fontSize: 72, lineHeight: 1 }}>🍳</div>
          </div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 12, animation: "popIn 0.6s 0.2s both cubic-bezier(0.34,1.56,0.64,1)" }}>
            Félicitations !
          </h1>
          <p style={{ fontSize: 16, color: "var(--text2)", lineHeight: 1.6, marginBottom: 32, maxWidth: 300, animation: "popIn 0.5s 0.35s both ease" }}>
            Votre <strong style={{ color: "var(--text)" }}>{recipe.name}</strong> est prêt·e !
          </p>
          <button className="btn btn-primary" style={{ padding: "14px 32px", fontSize: 16, borderRadius: 16, animation: "popIn 0.5s 0.5s both ease" }} onClick={onClose}>
            <Icon name="check" size={18} /> Retour à la recette
          </button>
        </div>
      )}

      <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "var(--bg)", display: "flex", flexDirection: "column", animation: "cookModeIn 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} /></button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{recipe.name}</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>Étape {stepIdx + 1} / {total}</div>
          </div>

        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "var(--surface2)", flexShrink: 0 }}>
          <div style={{ height: "100%", background: "var(--accent)", width: `${progress}%`, transition: "width 0.4s ease" }} />
        </div>


        {/* Main content — desktop: sidebar + content, mobile: single col */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

          {/* Desktop sidebar — steps list */}
          <div className="cook-mode-sidebar" style={{ display: "none", width: 260, minWidth: 260, overflowY: "auto", borderRight: "1px solid var(--border)", padding: "12px 0" }}>
            {recipe.steps.map((s, i) => (
              <button key={s.id} onClick={() => setStepIdx(i)}
                style={{
                  width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", background: i === stepIdx ? "rgba(232,112,58,0.1)" : "none",
                  borderLeft: `3px solid ${i === stepIdx ? "var(--accent)" : "transparent"}`, textAlign: "left", transition: "all 0.15s"
                }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                  background: i < stepIdx ? "var(--green)" : i === stepIdx ? "var(--accent)" : "var(--surface2)",
                  color: i <= stepIdx ? "#fff" : "var(--text3)"
                }}>
                  {i < stepIdx ? <Icon name="check" size={11} color="#fff" /> : i + 1}
                </div>
                <span style={{ fontSize: 13, color: i === stepIdx ? "var(--accent)" : i < stepIdx ? "var(--text3)" : "var(--text2)", fontWeight: i === stepIdx ? 600 : 400, lineHeight: 1.4 }}>{`Étape ${i + 1}`}</span>
              </button>
            ))}
          </div>

          {/* Step content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
              {/* Step header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{stepIdx + 1}</div>
                <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 500 }}>Étape {stepIdx + 1}</h2>
              </div>

              {/* Step text */}
              <p style={{ fontSize: 16, color: "var(--text)", lineHeight: 1.8, marginBottom: 24 }}>{step.text}</p>

              {/* Linked ingredients */}
              {linkedIngs.length > 0 && (
                <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Pour cette étape</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {linkedIngs.map(ing => (
                      <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <IngImage src={getIngImage(ing.dbId)} alt={ing.name} size={42} />
                        <span style={{ flex: 1, fontSize: 14 }}>{ing.name}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>{+(ing.amount * mult).toFixed(2)} {ing.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStepIdx(i => Math.max(0, i - 1))} disabled={stepIdx === 0}>
            <Icon name="back" size={16} /> Précédent
          </button>
          <span style={{ fontSize: 12, color: "var(--text3)", minWidth: 60, textAlign: "center" }}>{stepIdx + 1} / {total}</span>
          {stepIdx < total - 1
            ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStepIdx(i => i + 1)}>Suivant <Icon name="forward" size={16} /></button>
            : <button className="btn btn-primary" style={{ flex: 1, background: "var(--green)" }} onClick={() => setDone(true)}><Icon name="check" size={16} /> Terminé !</button>
          }
        </div>
      </div>
    </>
  );
}

// ─── FRIDGE CONSTANTS ─────────────────────────────────────────────────────────
const FRIDGE_THRESHOLDS = {
  vegetable: { warn: 5, danger: 8, label: "Légume/Fruit" },
  protein_lean: { warn: 2, danger: 4, label: "Viande/Poisson maigre" },
  protein_fat: { warn: 3, danger: 5, label: "Viande grasse" },
  dairy: { warn: 5, danger: 10, label: "Produit laitier" },
  grain_whole: { warn: 30, danger: 60, label: "Céréale complète" },
  grain_ref: { warn: 30, danger: 60, label: "Céréale raffinée" },
  fat_good: { warn: 30, danger: 90, label: "Matière grasse saine" },
  fat_bad: { warn: 14, danger: 30, label: "Matière grasse saturée" },
  sugar: { warn: 60, danger: 180, label: "Sucre" },
  condiment: { warn: 30, danger: 90, label: "Condiment/Épice" },
  legume: { warn: 3, danger: 5, label: "Légumineuse cuite" },
  alcohol: { warn: 180, danger: 365, label: "Alcool" },
  other: { warn: 7, danger: 14, label: "Autre" },
};

function fridgeDaysAge(addedAt) {
  return Math.floor((Date.now() - new Date(addedAt).getTime()) / 86400000);
}
function fridgeStatus(item) {
  const days = fridgeDaysAge(item.addedAt);
  const t = FRIDGE_THRESHOLDS[item.category || "other"];
  if (days >= t.danger) return "danger";
  if (days >= t.warn) return "warn";
  return "ok";
}
const FRIDGE_STATUS_COLOR = { ok: "var(--green)", warn: "var(--yellow)", danger: "var(--red)" };
const FRIDGE_STATUS_BG = { ok: "rgba(76,175,125,0.12)", warn: "rgba(240,192,96,0.12)", danger: "rgba(224,82,82,0.12)" };
const FRIDGE_STATUS_LABEL = { ok: "Frais", warn: "À utiliser bientôt", danger: "À jeter" };

// ─── FRIDGE TAB ───────────────────────────────────────────────────────────────
function FridgeTab({ fridge, setFridge, fridgeSettings, setFridgeSettings, recipes, ingredientDB, onSelectRecipe, user, syncStatus, onSignOut, isDark, onToggleTheme, categories = DEFAULT_CATEGORIES }) {
  const [view, setView] = useState("stock"); // "stock" | "recipes"
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [newItem, setNewItem] = useState({ name: "", category: "vegetable", quantity: "", unit: "", addedAt: new Date().toISOString().slice(0, 10) });
  const [showSettings, setShowSettings] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const saveItem = () => {
    if (!newItem.name.trim()) return;
    if (editItem) {
      setFridge(prev => prev.map(i => i.id === editItem ? { ...newItem, id: editItem } : i));
    } else {
      setFridge(prev => [...prev, { ...newItem, id: "f" + Date.now() }]);
    }
    setNewItem({ name: "", category: "vegetable", quantity: "", unit: "", addedAt: new Date().toISOString().slice(0, 10) });
    setEditItem(null); setShowAdd(false);
  };
  const deleteItem = id => setFridge(prev => prev.filter(i => i.id !== id));
  const startEdit = item => { setNewItem({ ...item, addedAt: item.addedAt.slice(0, 10) }); setEditItem(item.id); setShowAdd(true); };

  // Filtered stock
  const filteredFridge = fridge.filter(item => filterStatus === "all" || fridgeStatus(item) === filterStatus)
    .sort((a, b) => fridgeDaysAge(b.addedAt) - fridgeDaysAge(a.addedAt));

  // Recipe matching
  const threshold = fridgeSettings.matchThreshold / 100;
  const fridgeNames = fridge.map(i => normalizeStr(i.name));
  const matchedRecipes = recipes.map(recipe => {
    const ings = recipe.ingredients || [];
    if (ings.length === 0) return null;
    const matched = ings.filter(ing => fridgeNames.some(fn => normalizeStr(ing.name).includes(fn) || fn.includes(normalizeStr(ing.name))));
    const pct = matched.length / ings.length;
    return pct >= threshold ? { recipe, matched: matched.length, total: ings.length, pct } : null;
  }).filter(Boolean).sort((a, b) => b.pct - a.pct);

  const counts = { all: fridge.length, ok: fridge.filter(i => fridgeStatus(i) === "ok").length, warn: fridge.filter(i => fridgeStatus(i) === "warn").length, danger: fridge.filter(i => fridgeStatus(i) === "danger").length };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Mon Frigo</h1>
            <span className="app-brand" style={{ fontSize: 11, fontWeight: 500, color: "var(--text3)", letterSpacing: "0.04em", fontFamily: "var(--ff-body)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span> <span style={{ opacity: 0.5 }}>{`v${__APP_VERSION__}`}</span></span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setShowSettings(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="settings" size={16} color="var(--text2)" /></button>
            <UserAvatar user={user} syncStatus={syncStatus} onSignOut={onSignOut} isDark={isDark} onToggleTheme={onToggleTheme} />
          </div>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={() => setView("stock")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: view === "stock" ? "var(--accent)" : "var(--surface2)", color: view === "stock" ? "#fff" : "var(--text2)", border: `1px solid ${view === "stock" ? "transparent" : "var(--border)"}` }}>🧊 Stock</button>
          <button onClick={() => setView("recipes")} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: view === "recipes" ? "var(--accent)" : "var(--surface2)", color: view === "recipes" ? "#fff" : "var(--text2)", border: `1px solid ${view === "recipes" ? "transparent" : "var(--border)"}`, display: "flex", alignItems: "center", gap: 6 }}>
            🍽 Recettes possibles
            {matchedRecipes.length > 0 && <span style={{ background: view === "recipes" ? "rgba(255,255,255,0.25)" : "var(--accent)", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{matchedRecipes.length}</span>}
          </button>
        </div>

        {/* Status filters — only in stock view */}
        {view === "stock" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 2, paddingBottom: 12 }}>
            {[["all", "Tous", "var(--text2)"], ["ok", "Frais", "var(--green)"], ["warn", "À surveiller", "var(--yellow)"], ["danger", "Urgents", "var(--red)"]].map(([key, label, color]) => (
              <button key={key} onClick={() => setFilterStatus(key)}
                style={{ flexShrink: 0, padding: "4px 11px", borderRadius: 20, fontSize: 11, fontWeight: 500, background: filterStatus === key ? (key === "all" ? "var(--surface3)" : color) : "var(--surface2)", color: filterStatus === key ? (key === "all" ? "var(--text)" : "#fff") : "var(--text3)", border: `1px solid ${filterStatus === key ? (key === "all" ? "var(--border)" : color) : "var(--border)"}`, display: "flex", alignItems: "center", gap: 5, opacity: counts[key] === 0 && key !== "all" ? 0.4 : 1 }}>
                {label}
                <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>{counts[key]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>

        {/* ── STOCK VIEW ── */}
        {view === "stock" && (
          <>
            <button className="btn btn-primary" style={{ width: "100%", borderRadius: 12, marginBottom: 14 }} onClick={() => { setNewItem({ name: "", category: "vegetable", quantity: "", unit: "", addedAt: new Date().toISOString().slice(0, 10) }); setEditItem(null); setShowAdd(true); }}>
              <Icon name="plus" size={16} /> Ajouter un produit
            </button>
            {filteredFridge.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 40 }}>🧊</span>
                <p style={{ fontSize: 14, fontWeight: 500 }}>{filterStatus === "all" ? "Frigo vide" : "Aucun produit dans cette catégorie"}</p>
                <p style={{ fontSize: 12 }}>Ajoute tes produits pour suivre leur fraîcheur.</p>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredFridge.map(item => {
                const status = fridgeStatus(item);
                const days = fridgeDaysAge(item.addedAt);
                const cat = categories[item.category || "other"];
                const thresh = FRIDGE_THRESHOLDS[item.category || "other"];
                return (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", borderRadius: 14, padding: "12px 14px", border: `1px solid ${status === "danger" ? "rgba(224,82,82,0.3)" : status === "warn" ? "rgba(240,192,96,0.25)" : "var(--border)"}` }}>
                    {/* Icon */}
                    <div style={{ width: 42, height: 42, borderRadius: 11, background: FRIDGE_STATUS_BG[status], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{cat?.icon || "📦"}</div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{item.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {(item.quantity || item.unit) && (
                          <span style={{ fontSize: 11, color: "var(--text3)" }}>{item.quantity}{item.unit && ` ${item.unit}`}</span>
                        )}
                        <span style={{ fontSize: 11, color: FRIDGE_STATUS_COLOR[status], fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: FRIDGE_STATUS_COLOR[status], display: "inline-block" }} />
                          {days === 0 ? "Ajouté aujourd'hui" : `${days}j — ${FRIDGE_STATUS_LABEL[status]}`}
                        </span>
                      </div>
                      {/* Freshness bar */}
                      <div style={{ height: 3, background: "var(--surface2)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, background: FRIDGE_STATUS_COLOR[status], width: `${Math.min(100, (days / thresh.danger) * 100)}%`, transition: "width 0.4s" }} />
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => startEdit(item)} style={{ color: "var(--text3)" }}><Icon name="edit" size={15} /></button>
                      <button onClick={() => deleteItem(item.id)} style={{ color: "var(--red)" }}><Icon name="trash" size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── RECIPES VIEW ── */}
        {view === "recipes" && (
          <>
            {fridge.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 40 }}>🍽</span>
                <p style={{ fontSize: 14, fontWeight: 500 }}>Frigo vide</p>
                <p style={{ fontSize: 12 }}>Ajoute des produits dans ton frigo pour voir les recettes possibles.</p>
              </div>
            ) : matchedRecipes.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 40 }}>🤔</span>
                <p style={{ fontSize: 14, fontWeight: 500 }}>Aucune recette trouvée</p>
                <p style={{ fontSize: 12 }}>Essaie de baisser le seuil de correspondance dans les réglages.</p>
                <button onClick={() => setShowSettings(true)} className="btn btn-ghost btn-sm"><Icon name="settings" size={13} /> Réglages</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 4 }}>{matchedRecipes.length} recette{matchedRecipes.length > 1 ? "s" : ""} avec au moins {fridgeSettings.matchThreshold}% des ingrédients disponibles</p>
                {matchedRecipes.map(({ recipe, matched, total, pct }) => (
                  <button key={recipe.id} onClick={() => onSelectRecipe(recipe.id)}
                    style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", borderRadius: 14, padding: "12px 14px", border: "1px solid var(--border)", textAlign: "left", transition: "border-color 0.15s" }}>
                    <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}><Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{recipe.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: "var(--surface2)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: pct >= 0.75 ? "var(--green)" : pct >= 0.5 ? "var(--yellow)" : "var(--accent)", borderRadius: 2, width: `${pct * 100}%`, transition: "width 0.4s" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: pct >= 0.75 ? "var(--green)" : pct >= 0.5 ? "var(--yellow)" : "var(--accent)", flexShrink: 0 }}>{matched}/{total} ingr.</span>
                      </div>
                    </div>
                    <Icon name="forward" size={16} color="var(--text3)" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {showAdd && (
        <SwipeableSheet onClose={() => { setShowAdd(false); setEditItem(null); }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editItem ? "Modifier" : "Ajouter au frigo"}</h3>
          <div className="field-label">Nom du produit</div>
          <input className="field-input" placeholder="ex: Poulet, Yaourt, Courgette…" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 12 }} autoFocus />
          <div className="field-label">Catégorie</div>
          <select className="field-input" value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} style={{ marginBottom: 12 }}>
            {sortedCategoryEntries(categories).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <div className="field-label">Quantité</div>
              <input className="field-input" type="number" min="0" placeholder="ex: 500" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">Unité</div>
              <input className="field-input" placeholder="g, ml, pièce…" value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} />
            </div>
          </div>
          <div className="field-label">Date d'ajout</div>
          <input type="date" className="field-input" value={newItem.addedAt} onChange={e => setNewItem(p => ({ ...p, addedAt: e.target.value }))} style={{ marginBottom: 16 }} />
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontSize: 12 }}>
            <span style={{ color: "var(--text3)" }}>Seuil d'alerte pour </span>
            <span style={{ fontWeight: 600 }}>{categories[newItem.category]?.label}</span>
            <span style={{ color: "var(--text3)" }}> : </span>
            <span style={{ color: "var(--yellow)", fontWeight: 600 }}>⚠ {FRIDGE_THRESHOLDS[newItem.category]?.warn}j</span>
            <span style={{ color: "var(--text3)" }}> · </span>
            <span style={{ color: "var(--red)", fontWeight: 600 }}>🔴 {FRIDGE_THRESHOLDS[newItem.category]?.danger}j</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowAdd(false); setEditItem(null); }}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveItem} disabled={!newItem.name.trim()}>Sauvegarder</button>
          </div>
        </SwipeableSheet>
      )}

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <SwipeableSheet onClose={() => setShowSettings(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Réglages du Frigo</h3>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Configure le seuil de correspondance pour les suggestions de recettes.</p>
          <div className="field-label">Seuil de correspondance — {fridgeSettings.matchThreshold}%</div>
          <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>Une recette est suggérée si tu as au moins ce pourcentage de ses ingrédients dans le frigo.</p>
          <input type="range" min="10" max="100" step="5" value={fridgeSettings.matchThreshold}
            onChange={e => setFridgeSettings(p => ({ ...p, matchThreshold: +e.target.value }))}
            style={{ width: "100%", accentColor: "var(--accent)", marginBottom: 8 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)", marginBottom: 20 }}>
            <span>10% (permissif)</span><span>100% (exact)</span>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text2)", marginBottom: 20 }}>
            Actuellement : <strong>{matchedRecipes.length} recette{matchedRecipes.length > 1 ? "s" : ""}</strong> correspondent avec tes {fridge.length} produits en frigo.
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setShowSettings(false)}>Fermer</button>
        </SwipeableSheet>
      )}
    </div>
  );
}
function ShoppingTab({ shoppingLists, setShoppingLists, ingredientDB, user, syncStatus, onSignOut, isDark, onToggleTheme }) {
  const [activeListId, setActiveListId] = useState(null);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const activeList = shoppingLists.find(l => l.id === activeListId) || shoppingLists[0] || null;

  const updateList = (id, fn) => setShoppingLists(prev => prev.map(l => l.id === id ? fn(l) : l));
  const deleteList = id => {
    setShoppingLists(prev => prev.filter(l => l.id !== id));
    if (activeListId === id) setActiveListId(null);
  };
  const toggleItem = (listId, itemId) => updateList(listId, l => ({ ...l, items: l.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i) }));
  const clearChecked = listId => updateList(listId, l => ({ ...l, items: l.items.filter(i => !i.checked) }));

  const createList = () => {
    if (!newListName.trim()) return;
    const l = { id: "sl" + Date.now(), name: newListName.trim(), type: "free", items: [] };
    setShoppingLists(prev => [...prev, l]);
    setActiveListId(l.id);
    setNewListName(""); setShowNewList(false);
  };

  const addManualItem = () => {
    if (!newItemName.trim() || !activeList) return;
    const parsed = parseIngredientInput(newItemName);
    const name = parsed.name || newItemName.trim();
    const dbMatch = (ingredientDB || []).find(d => normalizeStr(d.name) === normalizeStr(name));
    const item = { id: "si" + Date.now(), name, amount: parsed.amount || "", unit: parsed.unit || "", image: dbMatch?.image || "", checked: false };
    updateList(activeList.id, l => ({ ...l, items: [...l.items, item] }));
    setNewItemName(""); setNewItemAmount(""); setNewItemUnit("");
  };

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
            <button className="btn btn-primary" style={{ padding: "8px 14px", borderRadius: 12 }} onClick={() => setShowNewList(true)}><Icon name="plus" size={16} /> Nouvelle liste</button>
            <UserAvatar user={user} syncStatus={syncStatus} onSignOut={onSignOut} isDark={isDark} onToggleTheme={onToggleTheme} />
          </div>
        </div>

        {/* New list input */}
        {showNewList && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input className="field-input" placeholder="Nom de la liste…" value={newListName} onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createList()} autoFocus style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={createList}>Créer</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowNewList(false); setNewListName(""); }}>✕</button>
          </div>
        )}

        {/* List selector tabs */}
        {shoppingLists.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
            {shoppingLists.map(l => {
              const isActive = (activeListId === l.id) || (!activeListId && shoppingLists[0] === l);
              const lChecked = l.items.filter(i => i.checked).length;
              return (
                <button key={l.id} onClick={() => setActiveListId(l.id)}
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: isActive ? "var(--accent)" : "var(--surface2)",
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* List header */}
          <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{activeList.name}</span>
              {activeList.type === "recipe" && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text3)" }}>Recette</span>}
              {total > 0 && (
                <div style={{ height: 3, background: "var(--surface2)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--green)", borderRadius: 2, width: `${(checked / total) * 100}%`, transition: "width 0.3s" }} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {checked > 0 && <button className="btn btn-ghost btn-sm" onClick={() => clearChecked(activeList.id)}><Icon name="check" size={12} /> Vider cochés</button>}
              <button className="btn btn-danger btn-sm" onClick={() => activeList.type === "free" ? setConfirmDeleteId(activeList.id) : deleteList(activeList.id)}><Icon name="trash" size={13} /></button>
            </div>
          </div>

          {/* Items */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
            {activeList.items.length === 0 && activeList.type !== "free" && (
              <div style={{ textAlign: "center", color: "var(--text3)", padding: "20px 0", fontSize: 13 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name="shopping" size={14} color="var(--text3)" /> Aucun article dans cette liste.</span>
              </div>
            )}
            {activeList.items.map(item => (
              <button key={item.id} onClick={() => toggleItem(activeList.id, item.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 14px", background: "var(--surface)", borderRadius: 12, marginBottom: 8, border: "1px solid var(--border)", textAlign: "left", opacity: item.checked ? 0.5 : 1, transition: "opacity 0.2s" }}>
                <IngImage src={item.image} alt={item.name} size={46} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, textDecoration: item.checked ? "line-through" : "none" }}>{item.name}</div>
                  {(item.amount || item.unit) && <div style={{ fontSize: 12, color: "var(--text2)" }}>{item.amount} {item.unit}</div>}
                </div>
                <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: item.checked ? "var(--green)" : "transparent", border: `2px solid ${item.checked ? "var(--green)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.checked && <Icon name="check" size={12} color="#fff" />}
                </div>
              </button>
            ))}

            {/* Manual add — only for free lists */}
            {activeList.type === "free" && (
              <div style={{ marginTop: 16, background: "var(--surface)", borderRadius: 14, padding: 14, border: "1px solid var(--border)", maxWidth: 520 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Ajouter un article</div>
                <input className="field-input" placeholder="ex: 500g farine, 2 oeufs, 1 c. à soupe huile…"
                  value={newItemName} onChange={e => setNewItemName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addManualItem()} style={{ marginBottom: 8 }} />
                {newItemName.trim() && (() => {
                  const p = parseIngredientInput(newItemName);
                  const name = p.name || newItemName.trim();
                  const match = (ingredientDB || []).find(d => normalizeStr(d.name) === normalizeStr(name));
                  return (
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {match?.image && <IngImage src={match.image} alt={match.name} size={34} />}
                      {p.amount && <span style={{ fontSize: 11, background: "rgba(240,192,96,0.15)", color: "var(--yellow)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Quantité : {p.amount}</span>}
                      {p.unit && <span style={{ fontSize: 11, background: "rgba(91,156,246,0.15)", color: "var(--blue)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>Unité : {p.unit}</span>}
                      {p.name && <span style={{ fontSize: 11, background: "var(--surface2)", color: "var(--text2)", borderRadius: 8, padding: "2px 8px" }}>{p.name}</span>}
                      {match
                        ? <span style={{ fontSize: 11, background: "rgba(76,175,125,0.15)", color: "var(--green)", borderRadius: 8, padding: "2px 8px", fontWeight: 500 }}>✓ Reconnu</span>
                        : p.name ? <span style={{ fontSize: 11, background: "rgba(224,82,82,0.12)", color: "#c04040", borderRadius: 8, padding: "2px 8px" }}>Non référencé</span> : null}
                    </div>
                  );
                })()}
                <button className="btn btn-primary" style={{ width: "100%" }} onClick={addManualItem} disabled={!newItemName.trim()}>
                  <Icon name="plus" size={15} /> Ajouter
                </button>
              </div>
            )}
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
    </div>
  );
}

// ─── CONFIG TAB ───────────────────────────────────────────────────────────────
function ConfigTab({ ingredientDB, setIngredientDB, utensilDB, setUtensilDB, collections, setCollections, recipes, onExportAll, onImport, isDark, onToggleTheme, user, onSignOut, syncStatus, isAdmin, categories = DEFAULT_CATEGORIES, setCategories }) {
  const [section, setSection] = useState("ingredients");
  const [editIng, setEditIng] = useState(null);
  const [editUt, setEditUt] = useState(null);
  const [editCol, setEditCol] = useState(null);
  const [editCat, setEditCat] = useState(null); // { key, label, score(0-100), color, icon, isNew }
  const [confirmDelCat, setConfirmDelCat] = useState(null); // { key, label }
  const [dragCat, setDragCat] = useState(null); // key being dragged
  const [overCat, setOverCat] = useState(null); // key currently hovered as drop target
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [openCats, setOpenCats] = useState({});
  const fileRef = useRef();
  const toggleCat = k => setOpenCats(p => ({ ...p, [k]: !p[k] }));

  const saveIng = item => {
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

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}>Configuration</h1>
            <span className="app-brand" style={{ fontSize: 11, fontWeight: 500, color: "var(--text3)", letterSpacing: "0.04em", fontFamily: "var(--ff-body)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span> <span style={{ opacity: 0.5 }}>{`v${__APP_VERSION__}`}</span></span>
          </div>
          <UserAvatar user={user} syncStatus={syncStatus} onSignOut={onSignOut} isDark={isDark} onToggleTheme={onToggleTheme} />
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 0, overflowX: "auto", paddingBottom: 0 }}>
          {["ingredients", "ustensiles", "collections", "données"].map(s => (
            <button key={s} onClick={() => setSection(s)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: section === s ? "var(--accent)" : "var(--surface2)", color: section === s ? "#fff" : "var(--text2)", border: `1px solid ${section === s ? "transparent" : "var(--border)"}` }}>
              {s === "ingredients" ? "Ingrédients" : s === "ustensiles" ? "Ustensiles" : s === "collections" ? "Collections" : "Données"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>
        {section === "ingredients" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isAdmin && (
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 14, background: "linear-gradient(135deg, rgba(232,112,58,0.18), rgba(232,112,58,0.06))", border: "1px solid rgba(232,112,58,0.35)", boxShadow: "0 2px 12px rgba(232,112,58,0.10)" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(232,112,58,0.4)" }}>
                  <Icon name="settings" size={16} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.02em" }}>MODE ADMIN</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "var(--accent)", borderRadius: 5, padding: "1px 6px", letterSpacing: "0.04em" }}>MASTER</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>Tes modifications sont publiées dans la base partagée</div>
                </div>
              </div>
            )}
            {isAdmin && (
              <button
                onClick={() => setEditCat({ key: "", label: "", score: 50, color: "#9a9490", icon: "📦", isNew: true })}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", padding: "12px 16px", borderRadius: 13, background: "var(--surface)", border: "1.5px dashed var(--accent)", color: "var(--accent)", fontFamily: "var(--ff-body)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(232,112,58,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="plus" size={13} color="#fff" />
                </span>
                Définir une nouvelle catégorie
              </button>
            )}
            {sortedCategoryEntries(categories).map(([catKey, cat]) => {
              const catIngs = ingredientDB.filter(d => d.category === catKey)
                .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" }));
              const isOpen = openCats[catKey];
              return (
                <div key={catKey}
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
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{catIngs.length} ingrédient{catIngs.length !== 1 ? "s" : ""} · Score {cat.score * 10}/100</div>
                      </div>
                      <span style={{
                        display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%",
                        background: "var(--surface2)", border: "1px solid var(--border)",
                        transition: "transform 0.25s ease", transform: isOpen ? "rotate(-90deg)" : "rotate(90deg)"
                      }}>
                        <Icon name="forward" size={12} color="var(--text3)" />
                      </span>
                    </button>
                    <button className="btn btn-primary btn-sm" style={{ flexShrink: 0, padding: "4px 10px", fontSize: 11 }}
                      onClick={() => setEditIng({ id: "", name: "", category: catKey, image: "", nutrition: null })}>
                      <Icon name="plus" size={12} /> Ajouter
                    </button>
                    {isAdmin && (
                      <>
                        <button onClick={() => setEditCat({ key: catKey, label: cat.label, score: (cat.score || 0) * 10, color: cat.color || "#9a9490", icon: cat.icon || "📦", isNew: false })} style={{ color: "var(--text3)", flexShrink: 0 }} title="Modifier la catégorie"><Icon name="edit" size={14} /></button>
                        <button onClick={() => setConfirmDelCat({ key: catKey, label: cat.label })} disabled={catIngs.length > 0} style={{ color: catIngs.length > 0 ? "var(--text3)" : "var(--red)", opacity: catIngs.length > 0 ? 0.35 : 1, flexShrink: 0 }} title={catIngs.length > 0 ? "Catégorie non vide — déplacez ses ingrédients d'abord" : "Supprimer la catégorie"}><Icon name="trash" size={14} /></button>
                      </>
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
                        <div key={item.id} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                          borderTop: i > 0 ? "1px solid var(--border)" : "none",
                          background: "var(--surface)"
                        }}>
                          <IngImage src={item.image} alt={item.name} size={42} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
                            {item.nutrition && (
                              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>
                                Score personnalisé · {[
                                  item.nutrition.protein && `P:${item.nutrition.protein}g`,
                                  item.nutrition.fiber && `F:${item.nutrition.fiber}g`,
                                  item.nutrition.sugar && `S:${item.nutrition.sugar}g`,
                                ].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </div>
                          {item._ro
                            ? <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 500, padding: "2px 8px", background: "var(--surface3)", borderRadius: 8, flexShrink: 0 }}>Master</span>
                            : <>
                              <button onClick={() => setEditIng({ ...item })} style={{ color: "var(--text3)", marginRight: 4 }}><Icon name="edit" size={14} /></button>
                              <button onClick={() => delIng(item.id)} style={{ color: "var(--red)" }}><Icon name="trash" size={14} /></button>
                            </>
                          }
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {section === "ustensiles" && (
          <div>
            {isAdmin && (
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", marginBottom: 14, borderRadius: 14, background: "linear-gradient(135deg, rgba(232,112,58,0.18), rgba(232,112,58,0.06))", border: "1px solid rgba(232,112,58,0.35)", boxShadow: "0 2px 12px rgba(232,112,58,0.10)" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(232,112,58,0.4)" }}>
                  <Icon name="settings" size={16} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.02em" }}>MODE ADMIN</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "var(--accent)", borderRadius: 5, padding: "1px 6px", letterSpacing: "0.04em" }}>MASTER</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>Tes modifications sont publiées dans la base partagée</div>
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-sm" style={{ marginBottom: 14 }} onClick={() => setEditUt({ id: "", name: "", image: "" })}><Icon name="plus" size={14} /> Nouvel ustensile</button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {utensilDB.map(item => (
                <div key={item.id} style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 10, overflow: "hidden", background: "var(--surface2)" }}><Img src={item.image} alt={item.name} style={{ width: "100%", height: "100%" }} /></div>
                  <span style={{ fontSize: 13, fontWeight: 500, textAlign: "center" }}>{item.name}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {item._ro
                      ? <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 500, padding: "2px 8px", background: "var(--surface3)", borderRadius: 8 }}>Master</span>
                      : <>
                        <button onClick={() => setEditUt({ ...item })} style={{ color: "var(--text3)" }}><Icon name="edit" size={14} /></button>
                        <button onClick={() => delUt(item.id)} style={{ color: "var(--red)" }}><Icon name="trash" size={14} /></button>
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
                        '    <span style="color:#5b9cf6">"title"</span><span style="color:#9a9490">:</span> <span style="color:#4caf7d">"string"</span>',
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
      </div>

      {/* Ingredient editor modal */}
      {editIng && (
        <SwipeableSheet onClose={() => setEditIng(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editIng.id ? "Modifier" : "Nouvel"} ingrédient</h3>
          <div className="field-label">Nom</div>
          <input className="field-input" placeholder="ex: Tomate" value={editIng.name} onChange={e => setEditIng(p => ({ ...p, name: e.target.value }))} style={{ marginBottom: 12 }} />
          <div className="field-label">Catégorie nutritionnelle</div>
          <select className="field-input" value={editIng.category || "other"} onChange={e => setEditIng(p => ({ ...p, category: e.target.value }))} style={{ marginBottom: 12 }}>
            {sortedCategoryEntries(categories).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <div className="field-label">Photo</div>
          <ImageUpload value={editIng.image} onChange={v => setEditIng(p => ({ ...p, image: v }))} style={{ marginBottom: 12, height: 100 }} pathPrefix={isAdmin ? "master/ingredients" : "ingredients"} />
          <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>Valeurs nutritionnelles précises (optionnel — pour 100g)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["protein", "Protéines (g)"], ["fiber", "Fibres (g)"], ["saturatedFat", "G. saturées (g)"], ["sugar", "Sucres (g)"], ["salt", "Sel (g)"]].map(([k, l]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 3 }}>{l}</div>
                  <input className="field-input" type="number" min="0" step="0.1" placeholder="0"
                    value={editIng.nutrition?.[k] || ""}
                    onChange={e => setEditIng(p => ({ ...p, nutrition: { ...(p.nutrition || {}), isVegetable: p.category === "vegetable" || p.category === "legume", [k]: +e.target.value } }))}
                    style={{ padding: "6px 10px", fontSize: 12 }} />
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

      {/* Category editor modal (admin only) */}
      {editCat && (
        <SwipeableSheet onClose={() => setEditCat(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>{editCat.isNew ? "Nouvelle catégorie" : "Modifier la catégorie"}</h3>
          <div className="field-label">Nom</div>
          <input className="field-input" placeholder="ex: Boisson sucrée" value={editCat.label} onChange={e => setEditCat(p => ({ ...p, label: e.target.value }))} style={{ marginBottom: 12 }} />
          <div className="field-label">Score santé — {editCat.score}/100</div>
          <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>Contribue au score santé des recettes utilisant des ingrédients de cette catégorie.</p>
          <input type="range" min="0" max="100" step="10" value={editCat.score}
            onChange={e => setEditCat(p => ({ ...p, score: +e.target.value }))}
            style={{ width: "100%", accentColor: editCat.color, marginBottom: 4 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text3)", marginBottom: 16 }}>
            <span>0 (mauvais)</span><span>100 (excellent)</span>
          </div>
          <div className="field-label" style={{ marginBottom: 8 }}>Couleur</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {["#4caf7d", "#5b9cf6", "#f0a875", "#f0e060", "#c8a870", "#80c080", "#e05252", "#9a9490", "#c080e0"].map(c => (
              <button key={c} onClick={() => setEditCat(p => ({ ...p, color: c }))} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: `3px solid ${editCat.color === c ? "#fff" : "transparent"}`, boxShadow: editCat.color === c ? "0 0 0 2px " + c : "none", transition: "all 0.15s" }} />
            ))}
          </div>
          <div className="field-label" style={{ marginBottom: 8 }}>Icône</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {["🥦", "🍗", "🥩", "🧀", "🌾", "🍞", "🫒", "🧈", "🍬", "🧂", "🫘", "🍷", "📦", "🐟", "🥜", "🍫", "☕", "🥤", "🍯", "🌶️"].map(ico => (
              <button key={ico} onClick={() => setEditCat(p => ({ ...p, icon: ico }))} style={{ width: 38, height: 38, borderRadius: 10, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", background: editCat.icon === ico ? editCat.color + "33" : "var(--surface2)", border: `2px solid ${editCat.icon === ico ? editCat.color : "var(--border)"}`, transition: "all 0.15s" }}>{ico}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--surface2)", borderRadius: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>{editCat.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{editCat.label || "Nom de la catégorie"}</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>Score {editCat.score}/100</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditCat(null)}>Annuler</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveCat(editCat)} disabled={!editCat.label.trim()}>Sauvegarder</button>
          </div>
        </SwipeableSheet>
      )}

      {/* Category delete confirmation */}
      {confirmDelCat && (
        <SwipeableSheet onClose={() => setConfirmDelCat(null)}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Supprimer la catégorie ?</h3>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            La catégorie « {confirmDelCat.label} » sera retirée de la base Master partagée. Cette action est visible par tous les utilisateurs.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDelCat(null)}>Annuler</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => { delCat(confirmDelCat.key); setConfirmDelCat(null); }}>Supprimer</button>
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