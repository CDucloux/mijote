import { useState, useEffect, useRef, useLayoutEffect } from "react";
import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Icon } from "../components/ui/Icon.jsx";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.jsx";
import { ImportResultDialog } from "../components/admin/ImportResultDialog.jsx";
import { IngredientDetail } from "../components/ingredient/IngredientDetail.jsx";
import { AdminDashboard } from "../components/admin/AdminDashboard.jsx";
import { SourcesAdmin } from "../components/admin/SourcesAdmin.jsx";
import { ConsoleHeader } from "../components/admin/ConsoleHeader.jsx";
import { IngredientsAdminSection } from "../components/admin/IngredientsAdminSection.jsx";
import { UtensilsAdminSection } from "../components/admin/UtensilsAdminSection.jsx";
import { TechniquesAdminSection } from "../components/admin/TechniquesAdminSection.jsx";
import { ModerationSection } from "../components/admin/ModerationSection.jsx";
import { BaseMenu } from "../components/admin/BaseMenu.jsx";
import { TechniqueEditorSheet } from "../components/admin/TechniqueEditorSheet.jsx";
import { UtensilEditorSheet } from "../components/admin/UtensilEditorSheet.jsx";
import { useMasterImports } from "../hooks/useMasterImports.js";
import { useModerationReports } from "../hooks/useModerationReports.js";
import { deleteImageByUrl } from "@/lib/firebase/storage.js";
import { buildTechniqueFromDraft } from "@/lib/household/dataYaml.js";
import type { TechniqueDraft } from "@/lib/household/dataYaml.js";
import { normalizeIngredientDraft, normalizeUtensilDraft, reorderCategories } from "@/lib/household/masterDrafts.js";
import type { IngredientTrackingFilter } from "@/lib/food/ingredientTracking.js";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { CONFIG_SECTION_BY_PATH, CONFIG_PATH_BY_SECTION } from "../constants/tabs.js";
import type { ConsoleSection } from "../constants/tabs.js";
import type { IngredientDbItem, UtensilDbItem } from "@/lib/types.js";
import type { TechniqueEntry } from "@/lib/recipes/techniques.js";
import type { IngredientCategory } from "@/lib/data/referenceData.js";

type SourcesProps = ComponentProps<typeof SourcesAdmin>;

/** Entrée dont la suppression attend confirmation. */
type PendingDelete =
  | { type: "ing"; item: IngredientDbItem }
  | { type: "ut"; item: UtensilDbItem }
  | { type: "tech"; item: TechniqueEntry };

const DELETE_NOUN: Record<PendingDelete["type"], string> = { ing: "l'ingrédient", ut: "l'ustensile", tech: "le geste" };

// Ingrédients : le volet de droite affiche déjà son effectif, pas de compteur en en-tête.
const BASE_NOUN: Partial<Record<ConsoleSection, string>> = { ustensiles: "ustensile", techniques: "technique" };

interface ConfigPageProps {
  ingredientDB: IngredientDbItem[];
  setIngredientDB: Dispatch<SetStateAction<IngredientDbItem[]>>;
  utensilDB: UtensilDbItem[];
  setUtensilDB: Dispatch<SetStateAction<UtensilDbItem[]>>;
  isAdmin: boolean;
  categories?: Record<string, IngredientCategory>;
  setCategories: Dispatch<SetStateAction<Record<string, IngredientCategory>>>;
  techniques?: TechniqueEntry[];
  setTechniques?: Dispatch<SetStateAction<TechniqueEntry[]>>;
  sources?: SourcesProps["sources"];
  setSources?: SourcesProps["setSources"];
  /** Sortie animée de la fiche ingrédient, la même que celle de la fiche recette (cf. useDetailDismiss). */
  detailDismissing?: boolean;
  onDetailBack?: () => void;
  onDetailDismissEnd?: () => void;
}

// ─── CONSOLE ADMIN ────────────────────────────────────────────────────────────

export function ConfigPage({ ingredientDB, setIngredientDB, utensilDB, setUtensilDB, isAdmin, categories = DEFAULT_CATEGORIES, setCategories, techniques = [], setTechniques, sources = [], setSources, detailDismissing = false, onDetailBack, onDetailDismissEnd }: ConfigPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const configSectionParam = location.pathname.startsWith("/admin/")
    ? location.pathname.slice(7) || undefined
    : undefined;
  const section: ConsoleSection = (configSectionParam && CONFIG_SECTION_BY_PATH[configSectionParam]) || "dashboard";
  // Fiche ingrédient : /admin/ingredients/{id}
  const ingDetailMatch = location.pathname.match(/^\/admin\/ingredients\/(.+)$/);
  const ingDetailId = ingDetailMatch ? decodeURIComponent(ingDetailMatch[1]) : null;
  // Mémorise la position de défilement de la liste pour la restaurer au retour de
  // la fiche d'un ingrédient (le conteneur scrollable est démonté pendant la fiche,
  // mais ConfigPage reste monté : un ref suffit, cf. même confort sur la page Recettes).
  const sectionScrollRef = useRef<HTMLDivElement>(null);
  // Retour de fiche : la liste se remonte, mais ses cartes ne doivent pas rejouer
  // leur entrée (on revient à un écran déjà vu). L'entrée ne rejoue qu'au
  // changement de section. Ajustement d'état pendant le rendu (pattern React).
  const [quietList, setQuietList] = useState(false);
  const [listSection, setListSection] = useState(section);
  if (ingDetailId && !quietList) setQuietList(true);
  if (!ingDetailId && section !== listSection) { setListSection(section); setQuietList(false); }
  const savedScrollTop = useRef(0);
  useLayoutEffect(() => {
    if (!ingDetailId && sectionScrollRef.current) sectionScrollRef.current.scrollTop = savedScrollTop.current;
  }, [ingDetailId]);
  const setSection = (s: ConsoleSection) => navigate(`/admin/${CONFIG_PATH_BY_SECTION[s] || "ingredients"}`, { replace: true });
  useEffect(() => {
    if (!configSectionParam) navigate("/admin/dashboard", { replace: true });
  }, [configSectionParam]); // eslint-disable-line react-hooks/exhaustive-deps
  // Filtre actif de la liste d'ingrédients (piloté par le dashboard).
  const [ingFilter, setIngFilter] = useState<IngredientTrackingFilter | null>(null);
  // Catégorie et recherche de la liste : gardées ici pour survivre à l'aller-retour vers une fiche.
  const [ingCategory, setIngCategory] = useState<string | null>(null);
  const [ingSearch, setIngSearch] = useState("");
  const gotoSection = (s: ConsoleSection, filter: IngredientTrackingFilter | null = null) => { setIngFilter(filter); setIngCategory(null); setSection(s); };
  const [newIngId, setNewIngId] = useState<string | null>(null); // brouillon d'ingrédient à ouvrir en édition
  const [editUt, setEditUt] = useState<UtensilDbItem | null>(null);
  const [editTech, setEditTech] = useState<TechniqueDraft | null>(null);
  const [confirmDel, setConfirmDel] = useState<PendingDelete | null>(null);
  // Groupes dépliés : gardés ici pour survivre à l'aller-retour vers une fiche.
  const [openTechCats, setOpenTechCats] = useState<Record<string, boolean>>({});
  const toggleTechCat = (k: string) => setOpenTechCats(p => ({ ...p, [k]: !p[k] }));

  const moderation = useModerationReports(isAdmin);
  const transfers = useMasterImports({ ingredientDB, setIngredientDB, utensilDB, setUtensilDB, techniques, setTechniques, categories });
  const { importResult, setImportResult } = transfers;

  const saveIng = (draft: IngredientDbItem) => {
    const item = normalizeIngredientDraft(draft);
    if (ingredientDB.some(d => d.id === item.id)) setIngredientDB(prev => prev.map(d => d.id === item.id ? item : d));
    else setIngredientDB(prev => [...prev, { ...item, id: "db_i" + Date.now() }]);
    setNewIngId(null);
  };
  // Création : on crée un brouillon vide en base et on ouvre SA fiche en édition.
  // (Annuler un brouillon jamais nommé le supprime, cf. onCancelNew côté fiche.)
  const createIngredient = (catKey: string) => {
    const id = "db_i" + Date.now();
    setIngredientDB(prev => [...prev, { id, name: "", category: catKey, image: "", nutrition: null }]);
    setNewIngId(id);
    navigate(`/admin/ingredients/${encodeURIComponent(id)}`);
  };
  const delIng = (id: string) => {
    const item = ingredientDB.find(d => d.id === id);
    if (item?.image) deleteImageByUrl(item.image);
    setIngredientDB(prev => prev.filter(d => d.id !== id));
  };
  const saveUt = (draft: UtensilDbItem) => {
    const item = normalizeUtensilDraft(draft);
    if (utensilDB.some(d => d.id === item.id)) setUtensilDB(prev => prev.map(d => d.id === item.id ? item : d));
    else setUtensilDB(prev => [...prev, { ...item, id: "db_u" + Date.now() }]);
    setEditUt(null);
  };
  const delUt = (id: string) => {
    const item = utensilDB.find(d => d.id === id);
    if (item?.image) deleteImageByUrl(item.image);
    setUtensilDB(prev => prev.filter(d => d.id !== id));
  };
  // Upsert d'un geste technique (master). La normalisation (clés vides retirées,
  // dimensions v2 portées) vit dans `buildTechniqueFromDraft` (testé, src/lib).
  const saveTech = (draft: TechniqueDraft) => {
    if (!(draft.name || "").trim() || !(draft.definition || "").trim()) { setImportResult({ ok: false, title: "Geste incomplet", message: "Le nom et la définition sont requis pour enregistrer un geste." }); return; }
    const item = buildTechniqueFromDraft(draft);
    setTechniques?.(prev => prev.find(t => t.id === item.id) ? prev.map(t => t.id === item.id ? item : t) : [...prev, item]);
    setEditTech(null);
  };
  const delTech = (id: string) => setTechniques?.(prev => prev.filter(t => t.id !== id));
  const confirmDelete = (pending: PendingDelete) => {
    if (pending.type === "ing") delIng(pending.item.id);
    else if (pending.type === "tech") delTech(pending.item.id);
    else delUt(pending.item.id);
    setConfirmDel(null);
    if (ingDetailId) navigate(-1);
  };

  const moveCategory = (fromKey: string, toKey: string) => setCategories(prev => reorderCategories(prev, fromKey, toKey) ?? prev);

  const baseNoun = BASE_NOUN[section];
  const baseCount = baseNoun
    ? { noun: baseNoun, count: section === "ustensiles" ? utensilDB.length : techniques.length }
    : null;
  const detailIngredient = ingDetailId ? ingredientDB.find(d => d.id === ingDetailId) : undefined;

  return (
    <div className={quietList && !ingDetailId ? "config-quiet" : undefined} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {ingDetailId ? (
        <div className={detailDismissing ? "page-dismiss-right" : undefined} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
          onAnimationEnd={detailDismissing ? (e) => { if (e.target === e.currentTarget && e.animationName === "detailDismissRight") onDetailDismissEnd?.(); } : undefined}>
          <IngredientDetail
            ingredient={detailIngredient}
            ingredientDB={ingredientDB}
            categories={categories}
            isAdmin={isAdmin}
            autoEdit={ingDetailId === newIngId}
            onBack={onDetailBack || (() => navigate(-1))}
            onSave={saveIng}
            onCancelNew={(ing) => { if (!ing?.name?.trim()) { delIng(ing.id); setNewIngId(null); navigate(-1); } }}
            onDelete={() => { if (detailIngredient) setConfirmDel({ type: "ing", item: detailIngredient }); }}
          />
        </div>
      ) : (
        <>
          <ConsoleHeader section={section} onSection={s => gotoSection(s)} pendingReports={moderation.reports.length} baseCount={baseCount}
            actions={isAdmin && baseCount && (section === "ustensiles"
              ? <BaseMenu count={baseCount.count} noun={baseCount.noun} {...transfers.utensils} />
              : section === "techniques" ? <BaseMenu count={baseCount.count} noun={baseCount.noun} importTitle="Importer le glossaire" {...transfers.techniques} /> : null)} />

          <div ref={sectionScrollRef} onScroll={e => { savedScrollTop.current = e.currentTarget.scrollTop; }} style={{ flex: 1, overflowY: "auto", padding: "16px 20px var(--page-pad-b)" }}>
            {section === "dashboard" && (
              <AdminDashboard ingredientDB={ingredientDB} utensilDB={utensilDB} techniques={techniques}
                onGoto={(s, filter) => gotoSection(s, filter ?? null)} />
            )}
            {section === "ingredients" && (
              <IngredientsAdminSection ingredientDB={ingredientDB} categories={categories} isAdmin={isAdmin}
                filter={ingFilter} onFilter={setIngFilter} category={ingCategory} onCategory={setIngCategory} search={ingSearch} onSearch={setIngSearch}
                onReorder={moveCategory} onCreate={createIngredient}
                onOpen={id => navigate(`/admin/ingredients/${encodeURIComponent(id)}`)} transfer={transfers.ingredients} />
            )}
            {section === "ustensiles" && (
              <UtensilsAdminSection utensilDB={utensilDB}
                onEdit={item => setEditUt({ ...item })} onDelete={item => setConfirmDel({ type: "ut", item })} />
            )}
            {section === "techniques" && (
              <TechniquesAdminSection techniques={techniques} isAdmin={isAdmin} openCats={openTechCats} onToggleCat={toggleTechCat}
                onCreate={catKey => setEditTech({ id: "", name: "", category: catKey, definition: "", aliases: [], difficulty: undefined, source: "" })}
                onEdit={t => setEditTech({ ...t, aliases: t.aliases || [], source: t.source || "" })}
                onDelete={item => setConfirmDel({ type: "tech", item })} />
            )}
            {section === "sources" && <SourcesAdmin sources={sources} setSources={setSources} isAdmin={isAdmin} />}
            {section === "modération" && <ModerationSection {...moderation} />}
          </div>
          {/* FAB « + » flottant pour ajouter un ustensile (comme les listes de courses libres) */}
          {isAdmin && section === "ustensiles" && (
            <button onClick={() => setEditUt({ id: "", name: "", category: "divers", appliance: "", image: "" })} title="Nouvel ustensile" className="pressable"
              style={{ position: "absolute", bottom: 16, right: 16, width: 52, height: 52, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px -4px rgba(0,0,0,0.45)", zIndex: 50, border: "none", cursor: "pointer" }}>
              <Icon name="plus" size={22} color="#fff" />
            </button>
          )}
        </>
      )}

      {editTech && <TechniqueEditorSheet initial={editTech} techniques={techniques} onClose={() => setEditTech(null)} onSave={saveTech} />}
      {editUt && <UtensilEditorSheet initial={editUt} isAdmin={isAdmin} onClose={() => setEditUt(null)} onSave={saveUt} />}

      {/* Résultat d'un import YAML (ou saisie refusée) */}
      {importResult && <ImportResultDialog {...importResult} onClose={() => setImportResult(null)} />}
      {confirmDel && (
        <ConfirmDialog title={`Supprimer ${DELETE_NOUN[confirmDel.type]} ?`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => confirmDelete(confirmDel)}>
          <strong style={{ color: "var(--text)" }}>« {confirmDel.item.name} »</strong> sera retiré de la base Master partagée. Cette action est visible par tous les utilisateurs et irréversible.
        </ConfirmDialog>
      )}
    </div>
  );
}
