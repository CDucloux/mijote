/**
 * Choix de la voix de lecture du mode mains libres parmi celles du navigateur.
 *
 * Les navigateurs exposent des voix de qualité très inégale : les voix locales
 * historiques (Microsoft Hortense, Paul) sont robotiques, alors que les voix
 * neuronales (Edge « … Online (Natural) », Safari « Premium » / « Améliorée »)
 * ou celles de Google dans Chrome sonnent bien plus humain. On classe donc les
 * voix françaises par indices de qualité portés par leur nom.
 *
 * @module cookSession/speechVoice
 */

/** Sous-ensemble de `SpeechSynthesisVoice` utile au choix. */
export interface VoiceCandidate {
  name: string;
  lang: string;
}

const NEURAL = /natural|neural|naturel|premium|enhanced|amelioree|améliorée|siri/i;

function voiceScore(voice: VoiceCandidate): number {
  const lang = voice.lang.toLowerCase().replace("_", "-");
  if (!lang.startsWith("fr")) return -1;
  let score = lang === "fr-fr" ? 1 : 0;
  if (NEURAL.test(voice.name)) score += 10;
  else if (/online/i.test(voice.name)) score += 8;
  else if (/google/i.test(voice.name)) score += 6;
  return score;
}

/**
 * Voix française la plus naturelle disponible.
 * @param voices - Voix du navigateur (`speechSynthesis.getVoices()`).
 * @returns La meilleure voix française, ou `null` s'il n'y en a aucune.
 */
export function pickFrenchVoice<T extends VoiceCandidate>(voices: readonly T[]): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const voice of voices) {
    const score = voiceScore(voice);
    if (score > bestScore) { best = voice; bestScore = score; }
  }
  return best;
}
