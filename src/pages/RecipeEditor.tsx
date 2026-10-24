import { useState, useRef, useMemo, useCallback, Fragment } from "react";
import { Icon, type IconName } from "../components/ui/Icon.jsx";
import { RECIPE_CATEGORIES, BASE_CATEGORY_IDS } from "../constants/recipeCategories.js";
import { UtensilPicker } from "../components/recipe/UtensilPicker.jsx";
import { ChefSheet } from "../components/recipe/ChefSheet.jsx";
import { DraggableStep } from "../components/recipe/DraggableStep.jsx";
import { DraggableIngredient } from "../components/recipe/DraggableIngredient.jsx";
import { SectionCard, EditorSectionHeader, NewSectionButton, SectionAddBar, EditorHead, type ComponentChoice } from "../components/recipeEditor/EditorSections.jsx";
import { EditorInfoPane } from "../components/recipeEditor/EditorInfoPane.jsx";
import { findIngredientMatch, type DbEntry } from "@/lib/food/nameMatcher.js";
import { parseIngredientInput } from "@/lib/food/parseIngredient.js";
import { groupOrder, relabelGroup, moveWithAdopt, sectionRuns } from "@/lib/recipes/recipeGroups.js";
import { cleanEditorIngredients } from "@/lib/recipes/editorIngredients.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { useEditorSwiper } from "../hooks/useEditorSwiper.js";
import { withEditedTiming } from "@/lib/planning/stepTiming.js";
import type { Cut, IngredientDbItem, Recipe, RecipeYield, UtensilDbItem } from "@/lib/types.js";
import type { EditorForm, EditorFormUpdate, EditorIngredient, EditorYield } from "../components/recipeEditor/editorForm.js";

/** Rendement éditable : quantité vidée = `""`, unité par défaut en grammes. */
const toEditorYield = (value: RecipeYield | undefined): EditorYield => {
  const amount = Number(value?.amount);
  return { amount: value?.amount === undefined || value.amount === "" || !Number.isFinite(amount) ? "" : amount, unit: value?.unit || "g" };
};

// ─── RECIPE EDITOR ────────────────────────────────────────────────────────────

type EditorTab = "info" | "ingrédients" | "ustensiles" | "étapes";

const TABS: { id: EditorTab; label: string; icon: IconName }[] = [
  { id: "info", label: "Infos", icon: "info" },
  { id: "ingrédients", label: "Ingrédients", icon: "leaf" },
  { id: "ustensiles", label: "Ustensiles", icon: "utensils" },
  { id: "étapes", label: "Étapes", icon: "list2" },
];
const TAB_IDS = TABS.map(t => t.id);
const RECIPE_CATEGORY_IDS: ReadonlySet<string> = new Set(RECIPE_CATEGORIES.map(c => c.id));

interface RecipeEditorProps {
  recipe: Recipe;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
  ingredientDB: (IngredientDbItem & DbEntry)[];
  utensilDB: UtensilDbItem[];
  recipes?: Recipe[];
}

export function RecipeEditor({ recipe, onSave, onCancel, ingredientDB, utensilDB, recipes }: RecipeEditorProps) {
  const [form, setForm] = useState<EditorForm>({ ...recipe, name: recipe.name || "", ingredients: recipe.ingredients || [], utensils: recipe.utensils || [], steps: recipe.steps || [], cuisine: recipe.cuisine || "", category: recipe.category || "", collections: recipe.collections || [], isComponent: !!recipe.isComponent, yield: toEditorYield(recipe.yield) });
  const { section, swiperRef, goSection, handlers: swiperHandlers } = useEditorSwiper(TAB_IDS);
  const [chefOpen, setChefOpen] = useState(false);
  const up: EditorFormUpdate = (f, v) => setForm(p => ({ ...p, [f]: v }));
  // Bascule « préparation de base » : les types de recette diffèrent (rôle repas vs
  // familles de base), on nettoie donc la catégorie si elle n'a plus de sens.
  const toggleComponent = () => setForm(p => {
    const isComp = !p.isComponent;
    const valid = isComp ? BASE_CATEGORY_IDS : RECIPE_CATEGORY_IDS;
    return { ...p, isComponent: isComp, category: valid.has(p.category) ? p.category : "" };
  });
  const upYield = (f: "amount" | "unit", v: number | string) => setForm(p => ({ ...p, yield: { ...p.yield, [f]: v } }));

  const [saveError, setSaveError] = useState("");
  const handleSave = () => {
    const { cleaned, missingQty: invalid } = cleanEditorIngredients(form.ingredients);
    if (invalid.length > 0) {
      setForm(p => ({ ...p, ingredients: cleaned }));
      setSaveError(`${invalid.length} ingrédient${invalid.length > 1 ? "s" : ""} sans quantité valide. Renseigne une quantité ou supprime la ligne.`);
      goSection("ingrédients", 1);
      return;
    }
    setSaveError("");
    const { yield: draftYield, ...rest } = form;
    // Le rendement n'a de sens que pour une préparation de base.
    onSave(form.isComponent
      ? { ...rest, ingredients: cleaned, yield: { amount: Number(draftYield.amount) || 0, unit: draftYield.unit || "g" } }
      : { ...rest, ingredients: cleaned, isComponent: false });
  };

  // Ingredients
  const lastAddedIdRef = useRef<string | null>(null);
  // Les handlers passés aux lignes/étapes MÉMOÏSÉES doivent garder une identité
  // stable : on les fige avec `useCallback` + `setForm` fonctionnel (aucune closure
  // sur `form`), condition pour que `React.memo` évite de re-rendre les lignes non
  // éditées à chaque frappe (cause du lag sur les grosses recettes).
  const clearSaveError = useCallback(() => setSaveError(e => (e ? "" : e)), []);
  // Insère un ingrédient à la position `index` (dans la liste globale) avec la section `group`.
  const addIngAt = useCallback((index: number, group: string) => {
    const id = "i" + Date.now();
    lastAddedIdRef.current = id;
    setForm(p => {
      const arr = p.ingredients.slice();
      arr.splice(index, 0, { id, dbId: "", name: "", amount: "", unit: "", _raw: "", group });
      return { ...p, ingredients: arr };
    });
  }, []);
  // Entrée sur une ligne : insère la suivante APRÈS elle, dans sa section. On repart de
  // l'id (pas d'un index capturé) pour que le callback reste stable entre les rendus.
  const handleIngEnter = useCallback((id: string | undefined) => {
    const newId = "i" + Date.now();
    lastAddedIdRef.current = newId;
    setForm(p => {
      const idx = p.ingredients.findIndex(i => i.id === id);
      const at = idx < 0 ? p.ingredients.length : idx + 1;
      const group = idx < 0 ? "" : (p.ingredients[idx].group || "");
      const arr = p.ingredients.slice();
      arr.splice(at, 0, { id: newId, dbId: "", name: "", amount: "", unit: "", _raw: "", group });
      return { ...p, ingredients: arr };
    });
  }, []);
  // Déplacement LIBRE (index globaux) : l'item adopte la section du bloc d'arrivée.
  const moveIngGlobal = useCallback((from: number, to: number) => setForm(p => ({ ...p, ingredients: moveWithAdopt(p.ingredients, from, to) })), []);
  const updIng = useCallback(<K extends keyof EditorIngredient>(id: string | undefined, f: K, v: EditorIngredient[K]) => { clearSaveError(); setForm(p => ({ ...p, ingredients: p.ingredients.map(i => i.id === id ? { ...i, [f]: v } : i) })); }, [clearSaveError]);
  const remIng = useCallback((id: string | undefined) => { clearSaveError(); setForm(p => ({ ...p, ingredients: p.ingredients.filter(i => i.id !== id) })); }, [clearSaveError]);
  // Retour arrière sur une ligne vide : supprime la ligne et refocalise la précédente.
  const removeIngBackspace = useCallback((id: string | undefined) => {
    clearSaveError();
    setForm(p => {
      const idx = p.ingredients.findIndex(i => i.id === id);
      const prev = p.ingredients[idx - 1];
      lastAddedIdRef.current = prev?.id ?? null;
      return { ...p, ingredients: p.ingredients.filter(i => i.id !== id) };
    });
  }, [clearSaveError]);
  // Parse + rapprochement base d'ingrédients à chaque frappe dans le champ « raw ».
  const handleRawChange = useCallback((id: string | undefined, raw: string) => {
    clearSaveError();
    const parsed = parseIngredientInput(raw);
    const match = parsed.name ? findIngredientMatch(parsed.name, ingredientDB) : null;
    setForm(p => ({ ...p, ingredients: p.ingredients.map(x => x.id === id ? {
      ...x, _raw: raw, name: parsed.name, amount: parsed.amount, unit: parsed.unit,
      dbId: match ? match.id : "",
    } : x) }));
  }, [clearSaveError, ingredientDB]);
  // Handlers de champ figés (identité stable) pour les lignes mémoïsées.
  const handleIngAmount = useCallback((id: string | undefined, v: number | "") => updIng(id, "amount", v), [updIng]);
  const handleIngCut = useCallback((id: string | undefined, cut: Cut | null) => updIng(id, "cut", cut), [updIng]);

  // Composants disponibles (préparations de base), hors la recette courante et hors
  // celles déjà référencées. Indisponible si on édite soi-même un composant (mono-niveau v1).
  const usedRecipeIds = new Set(form.ingredients.filter(i => i.recipeId).map(i => i.recipeId));
  const availableComponents = (recipes || []).filter(r => r.isComponent && r.id !== form.id && !usedRecipeIds.has(r.id));
  const addComponentAt = useCallback((index: number, comp: Recipe, group = "") => {
    setForm(p => {
      const arr = p.ingredients.slice();
      arr.splice(index, 0, { id: "i" + Date.now(), recipeId: comp.id, name: comp.name, amount: "", unit: comp.yield?.unit || "g", group });
      return { ...p, ingredients: arr };
    });
  }, []);

  // Étapes, mêmes primitives (handlers figés) : insertion positionnelle + déplacement libre.
  const addStepAt = useCallback((index: number, group: string) => {
    setForm(p => {
      const arr = p.steps.slice();
      arr.splice(index, 0, { id: "s" + Date.now(), text: "", ingredients: [], utensils: [], group });
      return { ...p, steps: arr };
    });
  }, []);
  const updStep = useCallback((id: string | undefined, f: string, v: unknown) => setForm(p => ({ ...p, steps: p.steps.map(s => s.id === id ? { ...s, [f]: v } : s) })), []);
  const setStepTiming = useCallback((id: string | undefined, duration: number | null, activeTime: number | null) =>
    setForm(p => ({ ...p, steps: p.steps.map(s => s.id === id ? withEditedTiming(s, duration, activeTime) : s) })), []);
  const remStep = useCallback((id: string | undefined) => setForm(p => ({ ...p, steps: p.steps.filter(s => s.id !== id) })), []);
  const moveStepGlobal = useCallback((from: number, to: number) => setForm(p => ({ ...p, steps: moveWithAdopt(p.steps, from, to) })), []);

  // Image de chaque ligne résolue UNE fois ici (regated par signature légère), au lieu
  // d'un scan complet de la base PAR étape ET PAR ligne (findIngredientMatch réindexe
  // toute la base à chaque appel). Les cartes d'étape consomment `ing.image` tel quel.
  const stepIngSig = form.ingredients.map(i => `${i.id}~${i.recipeId || ""}~${i.dbId || ""}~${i.name || ""}~${i.amount}~${i.unit || ""}`).join("|");
  const stepIngredients = useMemo(
    () => form.ingredients.map(ing => ({
      ...ing,
      image: ing.recipeId
        ? ((recipes || []).find(r => r.id === ing.recipeId)?.image || "")
        : ((ingredientDB || []).find(d => d.id === ing.dbId)?.image || (ing.name ? findIngredientMatch(ing.name, ingredientDB || [])?.image || "" : "")),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stepIngSig, ingredientDB, recipes],
  );

  // ── Sections partagées (ingrédients + étapes) ───────────────────────────────
  // `sectionNames` porte l'ORDRE des sections et permet les sections VIDES (créées
  // avant d'y ajouter le moindre item, le modèle « libellé » ne peut pas les stocker).
  const [sectionNames, setSectionNames] = useState(() => groupOrder(form));
  // Union ordonnée : sections déclarées + toute section présente dans les données.
  const allSections = [...new Set([...sectionNames, ...groupOrder(form)])];
  // Tant qu'aucune section n'existe, « Nouvelle section » se place en tête de liste
  // (on structure avant de remplir) ; ensuite il suit les sections, en bas.
  const noSection = allSections.length === 0;
  // Blocs à plat et premier bloc hors section : son bouton d'ajout se colle dessous.
  const ingRuns = sectionRuns(form.ingredients);
  const ingFreeRun = ingRuns.find(r => r.group == null);
  const stepRuns = sectionRuns(form.steps);
  const stepFreeRun = stepRuns.find(r => r.group == null);
  const freeIngBar = (at: number) => <SectionAddBar onAddIngredient={() => addIngAt(at, "")} components={[]} canBase={false} />;
  const freeStepBtn = (at: number) => <button className="editor-add" onClick={() => addStepAt(at, "")}><Icon name="plus" size={16} /> Ajouter une étape</button>;
  const addSection = (name: string) => { const t = name.trim(); if (t && !allSections.includes(t)) setSectionNames(s => [...s, t]); };
  const renameSection = (from: string, to: string) => {
    const t = to.trim();
    if (!t || t === from) return;
    up("ingredients", relabelGroup(form.ingredients, from, t));
    up("steps", relabelGroup(form.steps, from, t));
    setSectionNames(s => s.map(x => (x === from ? t : x)));
  };
  const deleteSection = (name: string) => {
    // Dissout la section : ses items repassent en principale (aucune suppression).
    up("ingredients", relabelGroup(form.ingredients, name, ""));
    up("steps", relabelGroup(form.steps, name, ""));
    setSectionNames(s => s.filter(x => x !== name));
  };
  const ingsOf = (g: string) => form.ingredients.filter(i => (i.group || "") === g);
  // Bases disponibles pour une zone d'ajout : insérées à `index` avec la section `group`.
  const compsAt = (group: string, index: number): ComponentChoice[] => (form.isComponent ? [] : availableComponents.map(c => ({ id: c.id, name: c.name, image: c.image, yield: c.yield, onPick: () => addComponentAt(index, c, group) })));

  const isDesktop = useIsDesktop();

  // Élastique vertical (rubber-band + rebond d'inertie) pour les panneaux du pager
  // (chacun a son propre `overflow-y`). Le panneau Ustensiles est un composant à part
  // (UtensilPicker) qui gère son propre élastique. Désactivé sur desktop.
  const paneInfo = useElasticScroll<HTMLDivElement>({ disabled: isDesktop });
  const paneIng = useElasticScroll<HTMLDivElement>({ disabled: isDesktop });
  const paneStep = useElasticScroll<HTMLDivElement>({ disabled: isDesktop });
  // Ligne visée par un glisser en cours (index global), par liste.
  const [ingDropIdx, setIngDropIdx] = useState<number | null>(null);
  const [stepDropIdx, setStepDropIdx] = useState<number | null>(null);

  return (
    <div className="editor-enter" style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Barre d'action. Le fond et le filet restent pleine largeur, le CONTENU suit la
          colonne `.editor-col`, commune aux onglets et aux panneaux : tout s'aligne. */}
      <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
        <div className="editor-col" style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px" }}>
          <button onClick={onCancel} className="cook-close-btn" style={{ flexShrink: 0, width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--surface2)", border: "none", cursor: "pointer" }}><Icon name="close" size={14} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>{recipe.id ? "Modifier la recette" : "Nouvelle recette"}</div>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.15 }}>{form.name.trim() || "Sans titre"}</div>
          </div>
          <button className="btn btn-primary btn-pill" style={{ flexShrink: 0 }} onClick={handleSave}><Icon name="save" size={15} /> Enregistrer</button>
        </div>
      </div>
      {/* Onglets segmentés (icône + libellé), pilotent aussi le glissement */}
      <div style={{ padding: "9px 0", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div className="editor-col" style={{ display: "flex", gap: 5, padding: "0 20px" }}>
          {TABS.map(({ id, label, icon }, i) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => goSection(id, i)} className={`editor-tab${active ? " active" : ""}`} style={{
                flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "7px 3px", borderRadius: 11, border: "none", cursor: "pointer",
                background: active ? "rgba(var(--accent-rgb),0.12)" : "transparent", color: active ? "var(--accent)" : "var(--text3)",
                transition: "color 0.15s ease, background-color 0.15s ease" }}>
                <Icon name={icon} size={17} color="currentColor" />
                <span style={{ fontSize: 10.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div id="editor-swiper" ref={swiperRef}
        {...swiperHandlers}
        style={{ flex: 1, display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}>

        {/* Slide 1 – Infos */}
        <EditorInfoPane form={form} up={up} upYield={upYield} onToggleComponent={toggleComponent} onOpenChef={() => setChefOpen(true)} pane={paneInfo} />

        {/* Slide 2 – Ingrédients */}
        <div ref={paneIng.scrollRef} style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto" }}>
          <div ref={paneIng.contentRef} className="editor-col" style={{ padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
            <EditorHead icon="leaf" label="Ingrédients" extra={form.ingredients.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "var(--text3)" }}>{form.ingredients.length}</span>} />
            {saveError && (
              <div className="shake" style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", borderRadius: 12, background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.4)", color: "var(--red)", fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>
                <Icon name="warning" size={16} color="var(--red)" /> {saveError}
              </div>
            )}
            {noSection && <NewSectionButton onAdd={addSection} />}
            {/* Ajout hors section : collé sous les ingrédients sans section (le premier
                bloc libre), ou en tête s'il n'y en a pas, jamais sous les sections. */}
            {!ingFreeRun && freeIngBar(0)}
            {/* Liste À PLAT dans l'ordre réel : en-têtes de section en ligne, chaque
                bloc a son bouton d'ajout (ingrédient / base). Réordonnancement libre. */}
            {ingRuns.map(run => {
              const g = run.group; // null = hors section
              const endIdx = run.start + run.items.length; // insertion en fin de bloc
              const rawInSection = g != null && ingsOf(g).some(i => !i.recipeId);
              return (
                <Fragment key={run.start}>
                  {g != null && <EditorSectionHeader name={g} onRename={t => renameSection(g, t)} onDelete={() => deleteSection(g)} />}
                  {run.items.map((ing, j) => {
                    const gi = run.start + j;
                    return (
                      <DraggableIngredient key={ing.id} ing={ing} index={gi} total={form.ingredients.length}
                        draggable={!isDesktop} ingredientDB={ingredientDB} recipes={recipes}
                        autoFocus={ing.id === lastAddedIdRef.current}
                        isDropTarget={ingDropIdx === gi} onTargetChange={setIngDropIdx}
                        onRawChange={handleRawChange}
                        onUpdateAmount={handleIngAmount}
                        onCutChange={handleIngCut}
                        onRemove={remIng} onMove={moveIngGlobal} onEnter={handleIngEnter} onBackspaceEmpty={removeIngBackspace} />
                    );
                  })}
                  {g != null && <SectionAddBar onAddIngredient={() => addIngAt(endIdx, g)} components={compsAt(g, endIdx)} canBase={!form.isComponent && !rawInSection} />}
                  {run === ingFreeRun && freeIngBar(endIdx)}
                </Fragment>
              );
            })}
            {/* Sections vides, puis création d'une nouvelle section, toujours en dernier */}
            {allSections.filter(n => !form.ingredients.some(i => (i.group || "") === n)).map(name => (
              <SectionCard key={name} name={name} onRename={t => renameSection(name, t)} onDelete={() => deleteSection(name)}>
                <SectionAddBar onAddIngredient={() => addIngAt(form.ingredients.length, name)} components={compsAt(name, form.ingredients.length)} canBase={!form.isComponent} />
              </SectionCard>
            ))}
            {!noSection && <NewSectionButton onAdd={addSection} />}
          </div>
        </div>

        {/* Slide 3 – Ustensiles */}
        <UtensilPicker utensilDB={utensilDB} selected={form.utensils} onChange={v => up("utensils", v)} />

        {/* Slide 4 – Étapes */}
        <div ref={paneStep.scrollRef} style={{ minWidth: "100%", scrollSnapAlign: "start", overflowY: "auto" }}>
          <div ref={paneStep.contentRef} className="editor-col" style={{ padding: "20px 20px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
            <EditorHead icon="list2" label="Étapes" extra={form.steps.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "var(--text3)" }}>{form.steps.length}</span>} />
            {!isDesktop && form.steps.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--text3)", background: "var(--surface)", border: "1px solid var(--border)", padding: "9px 12px", borderRadius: 12 }}>
                <Icon name="drag" size={14} color="var(--text3)" /> Glisse les étapes pour les réorganiser.
              </div>
            )}
            {noSection && <NewSectionButton onAdd={addSection} />}
            {!stepFreeRun && freeStepBtn(0)}
            {/* Liste À PLAT dans l'ordre réel : en-têtes de section en ligne, ajout par
                bloc, réordonnancement libre (l'étape adopte la section du bloc d'arrivée). */}
            {stepRuns.map(run => {
              const g = run.group;
              const endIdx = run.start + run.items.length;
              return (
                <Fragment key={run.start}>
                  {g != null && <EditorSectionHeader name={g} onRename={t => renameSection(g, t)} onDelete={() => deleteSection(g)} />}
                  {run.items.map((step, j) => {
                    const gi = run.start + j;
                    return (
                      <DraggableStep key={step.id} step={step} index={gi} total={form.steps.length}
                        ingredients={stepIngredients} utensils={form.utensils} recipes={recipes} ingredientDB={ingredientDB} utensilDB={utensilDB}
                        draggable={!isDesktop}
                        isDropTarget={stepDropIdx === gi} onTargetChange={setStepDropIdx}
                        onUpdate={updStep} onTimingChange={setStepTiming} onRemove={remStep} onMove={moveStepGlobal} />
                    );
                  })}
                  {g != null && <button className="editor-add" onClick={() => addStepAt(endIdx, g)}><Icon name="plus" size={16} /> Ajouter une étape</button>}
                  {run === stepFreeRun && freeStepBtn(endIdx)}
                </Fragment>
              );
            })}
            {allSections.filter(n => !form.steps.some(s => (s.group || "") === n)).map(name => (
              <SectionCard key={name} name={name} onRename={t => renameSection(name, t)} onDelete={() => deleteSection(name)}>
                <button className="editor-add" onClick={() => addStepAt(form.steps.length, name)}><Icon name="plus" size={16} /> Ajouter une étape</button>
              </SectionCard>
            ))}
            {!noSection && <NewSectionButton onAdd={addSection} />}
          </div>
        </div>

      </div>
      {chefOpen && <ChefSheet value={form.chef} onChange={v => up("chef", v)} onClose={() => setChefOpen(false)} />}
    </div>
  );
}
