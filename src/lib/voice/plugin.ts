/**
 * Façade du plugin natif `Voice` : dictée et synthèse vocale du système dans l'app
 * Android, dont la WebView n'a pas la Web Speech API.
 *
 * {@link NativeRecognition} imite l'objet de reconnaissance du navigateur (mêmes
 * propriétés et rappels, une phrase par session) : le mode mains libres l'emploie
 * sans savoir sur quelle plateforme il tourne. {@link nativeSpeech} joue le même
 * rôle pour la lecture à voix haute.
 *
 * @module voice/plugin
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

/** Interface exposée par l'implémentation native (`VoicePlugin.java`). */
interface VoicePlugin {
  start(options: { lang: string }): Promise<void>;
  stop(): Promise<void>;
  speak(options: { text: string }): Promise<void>;
  stopSpeaking(): Promise<void>;
  addListener(eventName: "result" | "state" | "error" | "end" | "speaking", listener: (event: unknown) => void): Promise<unknown>;
}

const Voice = registerPlugin<VoicePlugin>("Voice");

/** Exécution dans la coquille native (Capacitor), où le plugin `Voice` existe. */
export function isNativeVoice(): boolean {
  return Capacitor.isNativePlatform();
}

/** Résultat de dictée au format du navigateur (un seul résultat par session). */
export interface NativeRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

const field = (event: unknown, key: string): unknown =>
  event && typeof event === "object" && key in event ? (event as Record<string, unknown>)[key] : undefined;

/** Dictée en cours : la dernière lancée reçoit les événements natifs. */
const session: { current: NativeRecognition | null } = { current: null };
let bridged = false;
const speechState = { speaking: false };

/** Branche une seule fois les événements natifs, relayés à la dictée en cours. */
function listenOnce(): void {
  if (bridged) return;
  bridged = true;
  const ignore = () => {};
  void Voice.addListener("result", event => {
    const transcript = field(event, "transcript");
    if (typeof transcript !== "string") return;
    session.current?.onresult?.({ resultIndex: 0, results: [{ isFinal: field(event, "isFinal") === true, 0: { transcript } }] });
  }).catch(ignore);
  void Voice.addListener("state", event => {
    const state = field(event, "state");
    if (state === "listening") session.current?.onaudiostart?.();
    else if (state === "hearing") session.current?.onspeechstart?.();
  }).catch(ignore);
  void Voice.addListener("error", event => {
    const error = field(event, "error");
    session.current?.onerror?.({ error: typeof error === "string" ? error : "aborted" });
  }).catch(ignore);
  void Voice.addListener("end", () => session.current?.onend?.()).catch(ignore);
  void Voice.addListener("speaking", event => { speechState.speaking = field(event, "speaking") === true; }).catch(ignore);
}

/**
 * Dictée native au contrat de l'objet de reconnaissance du navigateur. Une seule
 * dictée vit à la fois : la dernière lancée reçoit les événements.
 */
export class NativeRecognition {
  lang = "fr-FR";
  continuous = false;
  interimResults = true;
  onresult: ((event: NativeRecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;

  start(): void {
    listenOnce();
    session.current = this;
    Voice.start({ lang: this.lang }).catch(() => {
      this.onerror?.({ error: "audio-capture" });
      this.onend?.();
    });
  }

  /** Coupe la dictée ; le système ne signale pas toujours la fin, on la signale ici. */
  abort(): void {
    Voice.stop().catch(() => {});
    if (session.current === this) queueMicrotask(() => this.onend?.());
  }
}

/** Lecture à voix haute par le moteur de synthèse du système. */
export const nativeSpeech = {
  /** Une lecture est en cours (suivi par les événements natifs). */
  get speaking(): boolean {
    return speechState.speaking;
  },
  speak(text: string): void {
    listenOnce();
    speechState.speaking = true;
    Voice.speak({ text }).catch(() => { speechState.speaking = false; });
  },
  cancel(): void {
    speechState.speaking = false;
    Voice.stopSpeaking().catch(() => {});
  },
};
