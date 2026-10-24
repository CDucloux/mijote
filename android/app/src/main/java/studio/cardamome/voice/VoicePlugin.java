package studio.cardamome.voice;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;

/**
 * Mains libres du mode cuisine dans l'app Android : la WebView n'a ni dictée ni
 * synthèse vocale (Web Speech API absente), on passe donc par les services du
 * système ({@link SpeechRecognizer} et {@link TextToSpeech}).
 *
 * Côté JS (façade {@code voice/plugin}), une dictée native imite la reconnaissance
 * du navigateur : une phrase par session, relancée par le JS. Événements émis :
 * {@code state} (« listening », « hearing »), {@code result} (transcription
 * provisoire ou définitive), {@code error} (code aligné sur la Web Speech API),
 * {@code end} (fin de session) et {@code speaking} (lecture en cours ou non).
 *
 * Une dictée rend toutes ses hypothèses ({@code alternatives}), et favorise les
 * phrases des commandes reçues du JS (Android 13+) : un mot court dit sans forcer
 * la voix est alors compris du premier coup.
 */
@CapacitorPlugin(
    name = "Voice",
    permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class VoicePlugin extends Plugin {

    /** Durée minimale d'une session de dictée, et silence qui la clôt (ms). */
    private static final long SESSION_MIN_MILLIS = 15000L;
    private static final long SILENCE_MILLIS = 4000L;

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (ttsReady) useBestFrenchVoice();
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) { emitSpeaking(true); }
            @Override public void onDone(String utteranceId) { emitSpeaking(false); }
            @Override public void onError(String utteranceId) { emitSpeaking(false); }
            @Override public void onStop(String utteranceId, boolean interrupted) { emitSpeaking(false); }
        });
    }

    @Override
    protected void handleOnDestroy() {
        main.post(() -> {
            if (recognizer != null) recognizer.destroy();
            recognizer = null;
        });
        if (tts != null) tts.shutdown();
    }

    /** Dictée et synthèse disponibles sur l'appareil. */
    @PluginMethod
    public void available(PluginCall call) {
        JSObject result = new JSObject();
        result.put("recognition", SpeechRecognizer.isRecognitionAvailable(getContext()));
        result.put("tts", tts != null);
        call.resolve(result);
    }

    /** Lance une session de dictée (demande l'accès au micro la première fois). */
    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermission");
            return;
        }
        listen(call);
    }

    @PermissionCallback
    private void microphonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            listen(call);
            return;
        }
        emitError("not-allowed");
        emitEnd();
        call.resolve();
    }

    private void listen(PluginCall call) {
        String lang = call.getString("lang", "fr-FR");
        int maxResults = call.getInt("maxResults", 1);
        ArrayList<String> phrases = phrasesOf(call.getArray("phrases"));
        main.post(() -> {
            if (recognizer == null) {
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(listener);
            }
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, Math.max(1, maxResults));
            // Session tenue ouverte malgré les silences : chaque relance coupe le micro
            // (bip, démarrage du service) et perd les mots dits à ce moment-là. Les
            // commandes partent sur les résultats provisoires, sans attendre la fin.
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, SESSION_MIN_MILLIS);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, SILENCE_MILLIS);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, SILENCE_MILLIS);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !phrases.isEmpty()) {
                intent.putStringArrayListExtra(RecognizerIntent.EXTRA_BIASING_STRINGS, phrases);
            }
            recognizer.startListening(intent);
            call.resolve();
        });
    }

    /** Phrases à favoriser, reçues du JS ; une entrée illisible est écartée. */
    private static ArrayList<String> phrasesOf(JSArray array) {
        ArrayList<String> phrases = new ArrayList<>();
        if (array == null) return phrases;
        for (int i = 0; i < array.length(); i++) {
            Object phrase = array.opt(i);
            if (phrase instanceof String && !((String) phrase).isEmpty()) phrases.add((String) phrase);
        }
        return phrases;
    }

    /** Interrompt la dictée en cours (sans événement : le JS clôt lui-même la session). */
    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            if (recognizer != null) recognizer.cancel();
            call.resolve();
        });
    }

    /** Lit un texte à voix haute, en coupant la lecture en cours. */
    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (!ttsReady || text == null || text.isEmpty()) {
            call.resolve();
            return;
        }
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "cardamome-" + System.nanoTime());
        call.resolve();
    }

    /** Coupe la lecture en cours. */
    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        if (tts != null) tts.stop();
        emitSpeaking(false);
        call.resolve();
    }

    /** Voix française de meilleure qualité disponible (voix neuronales incluses). */
    private void useBestFrenchVoice() {
        tts.setLanguage(Locale.FRANCE);
        Voice best = null;
        try {
            for (Voice voice : tts.getVoices()) {
                Locale locale = voice.getLocale();
                if (locale == null || !"fr".equals(locale.getLanguage())) continue;
                if (voice.getFeatures() != null && voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                if (best == null || score(voice) > score(best)) best = voice;
            }
        } catch (RuntimeException ignored) {
            // Certains moteurs lèvent sur getVoices() : la voix par défaut du français reste.
        }
        if (best != null) tts.setVoice(best);
    }

    private static int score(Voice voice) {
        int score = voice.getQuality();
        if ("FR".equals(voice.getLocale().getCountry())) score += 1;
        return score;
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) { emitState("listening"); }
        @Override public void onBeginningOfSpeech() { emitState("hearing"); }
        @Override public void onRmsChanged(float rmsdB) { }
        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int eventType, Bundle params) { }

        @Override
        public void onPartialResults(Bundle partialResults) {
            emitResult(partialResults, false);
        }

        @Override
        public void onResults(Bundle results) {
            emitResult(results, true);
            emitEnd();
        }

        @Override
        public void onError(int error) {
            emitError(errorCode(error));
            emitEnd();
        }
    };

    /** Code d'erreur aligné sur la Web Speech API, que le JS sait déjà traiter. */
    private static String errorCode(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "no-speech";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "not-allowed";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
            case SpeechRecognizer.ERROR_SERVER:
                return "network";
            case SpeechRecognizer.ERROR_AUDIO:
                return "audio-capture";
            default:
                return "aborted";
        }
    }

    private void emitResult(Bundle bundle, boolean isFinal) {
        ArrayList<String> matches = bundle == null ? null : bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return;
        JSObject data = new JSObject();
        data.put("transcript", matches.get(0));
        data.put("alternatives", new JSArray(matches));
        data.put("isFinal", isFinal);
        notifyListeners("result", data);
    }

    private void emitState(String state) {
        JSObject data = new JSObject();
        data.put("state", state);
        notifyListeners("state", data);
    }

    private void emitError(String code) {
        JSObject data = new JSObject();
        data.put("error", code);
        notifyListeners("error", data);
    }

    private void emitEnd() {
        notifyListeners("end", new JSObject());
    }

    private void emitSpeaking(boolean speaking) {
        JSObject data = new JSObject();
        data.put("speaking", speaking);
        notifyListeners("speaking", data);
    }
}
