/**
 * Mains libres du mode cuisine : écoute des commandes vocales, lecture à voix
 * haute et écran maintenu allumé.
 *
 * S'appuie sur la Web Speech API (dictée et synthèse vocale du navigateur) :
 * disponible dans Chrome, Edge et Safari, absente de Firefox et de la WebView
 * Android de l'app installée. `supported` le dit ; sans support, la bascule
 * explique pourquoi au lieu d'activer le mode.
 * Le micro reste ouvert pendant la lecture à voix haute (on peut l'interrompre
 * d'un « suivant ») : les mots-clés présents dans le texte lu sont ignorés tant
 * qu'il est lu, pour que la synthèse captée ne soit pas prise pour une commande
 * (cf. `parseVoiceTail`).
 *
 * @module useVoiceControl
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseVoiceTail, type VoiceCommand } from "@/lib/cookSession/voiceCommands.js";

// La Web Speech API n'est pas typée par lib.dom : on décrit le strict nécessaire.
interface RecognitionAlternative { transcript: string }
interface RecognitionResult { readonly isFinal: boolean; readonly 0: RecognitionAlternative }
interface RecognitionEvent { readonly resultIndex: number; readonly results: ArrayLike<RecognitionResult> }
interface RecognitionErrorEvent { readonly error: string }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const LANG = "fr-FR";
/** Une même commande répétée dans ce délai est ignorée (doublon de dictée). */
const DUPLICATE_MS = 1200;
/** Après la lecture, le micro peut encore rendre un écho pendant ce délai (latence de dictée). */
const ECHO_GRACE_MS = 2000;
/** Une dictée close aussi vite sans rien entendre est un échec de démarrage. */
const FAST_END_MS = 1000;
/** Échecs de démarrage d'affilée tolérés avant de couper le mode. */
const MAX_FAST_ENDS = 5;
/** Erreurs de dictée sans gravité : silence prolongé, arrêt volontaire. */
const BENIGN_ERRORS = new Set(["no-speech", "aborted"]);
/** Durée d'affichage de la dernière phrase entendue, et nombre de ses derniers mots montrés. */
const HEARD_MS = 3000;
const HEARD_WORDS = 6;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/** État de la dictée : en démarrage, micro qui capte, voix en cours de transcription. */
export type VoiceStatus = "starting" | "listening" | "hearing";

/** Options de {@link useVoiceControl}. */
export interface UseVoiceControlOptions {
  /** Appelée à chaque commande reconnue. */
  onCommand: (command: VoiceCommand) => void;
  /** Message à afficher quand le micro est refusé ou indisponible. */
  onError?: (message: string) => void;
  /** Suspend l'écoute sans quitter le mode (feuille ouverte, écran de fin). */
  paused?: boolean;
}

/** État et actions exposés par {@link useVoiceControl}. */
export interface UseVoiceControlResult {
  /** Le navigateur sait écouter et lire à voix haute. */
  supported: boolean;
  /** Le mode mains libres est activé. */
  active: boolean;
  /** Dernière phrase entendue (quelques secondes), pour montrer ce qui a été compris. */
  heard: string | null;
  /** Où en est la dictée : lancée, micro ouvert, voix détectée (`null` hors mode). */
  status: VoiceStatus | null;
  toggle: () => void;
  /** Lit un texte à voix haute (interrompt la lecture en cours). */
  speak: (text: string) => void;
}

/**
 * Active et pilote le mode mains libres du pas à pas.
 * @param options - Commande reçue, erreurs et suspension, cf. {@link UseVoiceControlOptions}.
 * @returns L'état du mode et ses actions, cf. {@link UseVoiceControlResult}.
 */
export function useVoiceControl({ onCommand, onError, paused = false }: UseVoiceControlOptions): UseVoiceControlResult {
  const [supported] = useState(() => recognitionCtor() !== null && typeof window !== "undefined" && "speechSynthesis" in window);
  const [active, setActive] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("starting");
  // Démarrage de la session de dictée en cours, et échecs de démarrage d'affilée.
  const sessionRef = useRef({ startedAt: 0, gotAudio: false, fastEnds: 0 });
  const recognitionRef = useRef<Recognition | null>(null);
  const runningRef = useRef(false);
  const lastRef = useRef({ kind: "", at: 0 });
  // Mots déjà analysés par résultat de dictée (index du résultat → nombre de mots) :
  // une transcription provisoire grandit, on n'en relit que la fin nouvelle.
  const consumedRef = useRef(new Map<number, number>());
  // Lecture en cours : texte lu et dernier instant où la synthèse parlait. On ne
  // s'appuie pas sur `onend` de la synthèse, que Chrome omet sur les textes longs.
  const spokenRef = useRef({ text: "", lastAt: 0 });
  // Retient la phrase lue : Chrome oublie l'énoncé (et sa fin) s'il est ramassé par le GC.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // Rappels lus au moment de l'événement : la reconnaissance vit plus longtemps qu'un rendu.
  const onCommandRef = useRef(onCommand);
  const onErrorRef = useRef(onError);
  const listeningRef = useRef(false);
  useLayoutEffect(() => {
    onCommandRef.current = onCommand;
    onErrorRef.current = onError;
    listeningRef.current = active && !paused;
  });

  const listen = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !listeningRef.current || runningRef.current) return;
    try {
      recognition.start();
      runningRef.current = true;
      sessionRef.current.startedAt = Date.now();
      sessionRef.current.gotAudio = false;
    } catch {
      // Déjà lancée, ou en cours d'arrêt : son `onend` la relancera.
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = LANG;
    // Une phrase par session, relancée aussitôt : le mode continu ne renvoie rien
    // dans certains navigateurs (Edge), le mode phrase par phrase marche partout.
    recognition.continuous = false;
    // Résultats provisoires : la commande part dès qu'elle est entendue, sans attendre
    // la fin de phrase (que certains navigateurs ne posent qu'après un long silence).
    recognition.interimResults = true;
    recognition.onaudiostart = () => {
      sessionRef.current.gotAudio = true;
      sessionRef.current.fastEnds = 0;
      setStatus("listening");
    };
    recognition.onspeechstart = () => setStatus("hearing");
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const transcript = result[0].transcript.trim();
        // Seule la fin s'affiche : une dictée longue serait tronquée par son début.
        if (transcript) setHeard(transcript.split(/\s+/).slice(-HEARD_WORDS).join(" "));
        const spoken = spokenRef.current;
        const reading = window.speechSynthesis.speaking || Date.now() - spoken.lastAt < ECHO_GRACE_MS;
        const { command, words } = parseVoiceTail(transcript, consumedRef.current.get(i) ?? 0, reading ? spoken.text : null);
        if (!command) continue;
        consumedRef.current.set(i, words);
        const now = Date.now();
        if (command.kind === lastRef.current.kind && now - lastRef.current.at < DUPLICATE_MS) continue;
        lastRef.current = { kind: command.kind, at: now };
        onCommandRef.current(command);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        onErrorRef.current?.("Micro refusé : autorise-le dans le navigateur pour le mode mains libres.");
        setActive(false);
      } else if (event.error === "network" || event.error === "audio-capture") {
        onErrorRef.current?.("Mains libres indisponible : micro ou connexion introuvable.");
        setActive(false);
      } else if (!BENIGN_ERRORS.has(event.error)) {
        onErrorRef.current?.(`Mains libres : la dictée a échoué (${event.error}).`);
      }
    };
    // La dictée s'arrête d'elle-même après un silence : on la relance tant que le mode est actif.
    recognition.onend = () => {
      runningRef.current = false;
      consumedRef.current.clear(); // une nouvelle session renumérote ses résultats
      const session = sessionRef.current;
      if (!session.gotAudio && Date.now() - session.startedAt < FAST_END_MS && ++session.fastEnds >= MAX_FAST_ENDS) {
        onErrorRef.current?.("Mains libres : la dictée s'arrête dès son lancement dans ce navigateur. Essaie Chrome.");
        setActive(false);
        return;
      }
      setStatus("starting");
      setTimeout(listen, 150);
    };
    recognitionRef.current = recognition;
    listen();
    // Suit la synthèse vocale pour dater la fin de la lecture (filtre d'écho).
    const poll = setInterval(() => {
      if (window.speechSynthesis.speaking) spokenRef.current.lastAt = Date.now();
    }, 250);
    return () => {
      clearInterval(poll);
      recognition.onend = null;
      recognition.abort();
      runningRef.current = false;
      recognitionRef.current = null;
      window.speechSynthesis.cancel();
    };
  }, [active, listen]);

  useEffect(() => {
    if (!active) return;
    if (paused) {
      recognitionRef.current?.abort();
      window.speechSynthesis.cancel();
    } else listen();
  }, [active, paused, listen]);

  // Dernière phrase entendue, affichée un court instant (l'utilisateur voit ce qui a été compris).
  useEffect(() => {
    if (heard === null) return;
    const timer = setTimeout(() => setHeard(null), HEARD_MS);
    return () => clearTimeout(timer);
  }, [heard]);

  // Écran maintenu allumé tant que le mode est actif (re-demandé au retour au premier plan).
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then(sentinel => { lock = sentinel; }, () => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, [active]);

  const speak = useCallback((text: string) => {
    if (!supported || !text) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG;
    const voice = synth.getVoices().find(v => v.lang.toLowerCase().startsWith("fr"));
    if (voice) utterance.voice = voice;
    utteranceRef.current = utterance;
    spokenRef.current = { text, lastAt: Date.now() };
    synth.speak(utterance);
  }, [supported]);

  const toggle = useCallback(() => {
    if (supported) setActive(on => !on);
    else onErrorRef.current?.("Le mode mains libres a besoin de Chrome, Edge ou Safari.");
  }, [supported]);

  return { supported, active, heard: active ? heard : null, status: active ? status : null, toggle, speak };
}
