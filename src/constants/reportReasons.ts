// Motifs de signalement d'une recette publique (modération), avec un exemple concret
// pour lever l'hésitation entre deux motifs voisins.
export const REPORT_REASONS = [
  { id: "copyright", label: "Droit d'auteur ou plagiat", hint: "Recette ou photo reprise sans l'accord de son auteur" },
  { id: "photo", label: "Photo inappropriée", hint: "Image choquante, trompeuse ou sans rapport avec le plat" },
  { id: "offensive", label: "Contenu offensant ou dangereux", hint: "Propos haineux, pratique risquée pour la santé" },
  { id: "spam", label: "Spam ou hors-sujet", hint: "Publicité, liens douteux, ce n'est pas une recette" },
  { id: "other", label: "Autre chose", hint: "Explique-nous en quelques mots juste en dessous" },
];

const LABEL_BY_ID = new Map(REPORT_REASONS.map(reason => [reason.id, reason.label]));

/** Libellé lisible d'un motif stocké (l'id brut en repli, pour un motif inconnu). */
export function reportReasonLabel(id: string): string { return LABEL_BY_ID.get(id) ?? id; }
