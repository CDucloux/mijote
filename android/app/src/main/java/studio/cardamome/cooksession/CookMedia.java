package studio.cardamome.cooksession;

import android.content.Context;
import android.graphics.Bitmap;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

/**
 * Session média du cook mode. Sa raison d'être : donner à la notification le
 * traitement « lecteur » d'Android (grande pochette, barre de progression, tuile
 * média en haut du volet) et router les contrôles de cette tuile vers le JS.
 *
 * La barre de progression de la tuile média se dérive de l'état de lecture :
 * pour un minuteur, on mappe la durée totale et le temps écoulé (la barre se
 * remplit à mesure du décompte) ; sans minuteur, aucune durée n'est publiée donc
 * pas de barre, la tuile reste une pochette avec ses boutons.
 */
final class CookMedia {

    private static MediaSessionCompat session = null;

    private CookMedia() {}

    /** Crée la session (idempotent) et la rend active. Renvoie son token. */
    static MediaSessionCompat.Token ensure(Context ctx) {
        if (session == null) {
            session = new MediaSessionCompat(ctx.getApplicationContext(), "CardamomeCook");
            session.setCallback(new Callback());
            session.setActive(true);
        }
        return session.getSessionToken();
    }

    /**
     * Aligne métadonnées et état de lecture sur le snapshot courant. À appeler
     * juste avant de (re)poster la notification, session déjà créée.
     *
     * @param snap état courant de la session de cuisine.
     * @param art  pochette décodée, ou {@code null} si pas encore disponible.
     */
    static void apply(CookSnapshot snap, Bitmap art) {
        if (session == null) return;
        long duration = snap.hasTimer ? Math.max(0L, snap.timerTotalMs) : 0L;

        MediaMetadataCompat.Builder meta = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, snap.recipeTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, subtitle(snap))
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration);
        if (art != null) {
            meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art);
        }
        session.setMetadata(meta.build());

        long actions = PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                | PlaybackStateCompat.ACTION_STOP;
        // Le bouton central lecture/pause de la tuile ne pilote que le minuteur :
        // on ne l'expose donc qu'en présence d'un minuteur, jamais « à vide ».
        if (snap.hasTimer) {
            actions |= PlaybackStateCompat.ACTION_PLAY
                    | PlaybackStateCompat.ACTION_PAUSE
                    | PlaybackStateCompat.ACTION_PLAY_PAUSE;
        }

        long now = System.currentTimeMillis();
        long position = 0L;
        int state = PlaybackStateCompat.STATE_PLAYING;
        float speed = 0f;
        if (snap.hasTimer) {
            long remaining = Math.max(0L, snap.timerEndAt - now);
            position = Math.max(0L, Math.min(duration, duration - remaining));
            state = snap.timerRunning ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
            speed = snap.timerRunning ? 1f : 0f;
        }

        PlaybackStateCompat playback = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(state, position, speed, now)
                .build();
        session.setPlaybackState(playback);
    }

    /** Libère la session (fin de session de cuisine). Idempotent. */
    static void release() {
        if (session == null) return;
        session.setActive(false);
        session.release();
        session = null;
    }

    /**
     * Deuxième ligne de la card : numéro d'étape + texte de l'instruction quand on
     * est sur une étape (ex. « Étape 1 / 2 · Verser le café… »). Sur une page méta
     * (mise en place, bases) sans texte, on retombe sur le seul libellé de position.
     * Le minuteur n'est plus repris ici : son décompte vit dans la barre de
     * progression, qui suffit.
     */
    static String subtitle(CookSnapshot snap) {
        if (snap.stepText != null && !snap.stepText.isEmpty()) {
            return snap.stepLabel + " · " + snap.stepText;
        }
        return snap.stepLabel;
    }

    /** Route les contrôles de la tuile média vers le cook mode (via le plugin). */
    private static final class Callback extends MediaSessionCompat.Callback {
        @Override public void onSkipToNext() { CookSessionPlugin.emitAction(CookNotification.ACTION_NEXT); }
        @Override public void onSkipToPrevious() { CookSessionPlugin.emitAction(CookNotification.ACTION_PREV); }
        @Override public void onPlay() { CookSessionPlugin.emitAction(CookNotification.ACTION_TOGGLE); }
        @Override public void onPause() { CookSessionPlugin.emitAction(CookNotification.ACTION_TOGGLE); }
        @Override public void onStop() { CookSessionPlugin.emitAction(CookNotification.ACTION_STOP); }
    }
}
