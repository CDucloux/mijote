/**
 * Helpers de chemin partagés de la structure Firestore éclatée.
 *
 * Les références sont résolues depuis un `workspace` (`ws.segments` = préfixe du
 * namespace actif : `users/{uid}` en solo, `households/{hid}` en foyer). Un uid brut
 * (string) reste accepté pour rétro-compat ponctuelle.
 *
 * @module firebase/paths
 */
import { doc, collection, type DocumentReference, type CollectionReference } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import { type Workspace } from "@/lib/household/workspace.js";

/** Workspace actif, ou uid brut (rétro-compat). */
export type WorkspaceRef = Workspace | string;

/** Segments du namespace actif (`users/{uid}` en solo, `households/{hid}` en foyer). */
export const segmentsOf = (ws: WorkspaceRef): string[] => (typeof ws === "string" ? ["users", ws] : ws.segments);

/** Réf. d'un document méta (`{namespace}/meta/{name}`) du workspace : `collections`, `mealPlan`, `stock`, etc. */
export const metaDoc = (ws: WorkspaceRef, name: string): DocumentReference => doc(db, [...segmentsOf(ws), "meta", name].join("/"));
/** Réf. de la collection des recettes du workspace (un document par recette). */
export const recipesCol = (ws: WorkspaceRef): CollectionReference => collection(db, [...segmentsOf(ws), "recipes"].join("/"));
