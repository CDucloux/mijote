package studio.cardamome.cooksession;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Build;
import android.support.v4.media.session.MediaSessionCompat;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.util.ArrayList;
import java.util.List;

import studio.cardamome.MainActivity;
import studio.cardamome.R;

/**
 * Construit et poste la notification « lecteur » du cook mode, façon appli
 * musicale : grande pochette (photo de recette), barre de progression du
 * minuteur, et contrôles Précédent / Pause / Suivant. S'appuie sur une
 * {@link CookMedia session média} pour obtenir la tuile média d'Android et sa
 * barre de progression. Une seule barre à la fois (identifiant fixe). La
 * pochette se charge en fond ({@link CookArt}) et déclenche un rafraîchissement
 * dès qu'elle est prête.
 */
final class CookNotification {

    static final String CHANNEL_ID = "cook_session";
    static final int NOTIF_ID = 4201;

    static final String EXTRA_ACTION = "cook_action";
    static final String ACTION_NEXT = "next";
    static final String ACTION_PREV = "prev";
    static final String ACTION_TOGGLE = "toggleTimer";
    static final String ACTION_STOP = "stop";

    /** Teinte de repli de la tuile média quand aucune pochette n'est disponible. */
    private static final int ACCENT = 0xFF6F8F4E;

    private static Context appContext = null;
    private static CookSnapshot lastSnap = null;

    private CookNotification() {}

    /** Crée le canal de notification dédié (idempotent). Importance basse : une
     * barre de statut silencieuse, pas une alerte. */
    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager mgr = ctx.getSystemService(NotificationManager.class);
        if (mgr == null || mgr.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Cuisine en cours", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Barre de suivi du mode pas à pas");
        channel.setShowBadge(false);
        mgr.createNotificationChannel(channel);
    }

    /** Poste (ou remplace) la barre avec l'état fourni. */
    static void show(Context ctx, CookSnapshot snap) {
        appContext = ctx.getApplicationContext();
        lastSnap = snap;
        ensureChannel(appContext);

        MediaSessionCompat.Token token = CookMedia.ensure(appContext);
        Bitmap art = CookArt.cached(snap.imageUrl);
        CookMedia.apply(snap, art);

        NotificationCompat.Builder b = new NotificationCompat.Builder(appContext, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_cook_notification)
                .setContentTitle(snap.recipeTitle)
                .setContentText(CookMedia.subtitle(snap))
                .setLargeIcon(art)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setColorized(true)
                .setColor(ACCENT)
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(openAppIntent(appContext));

        int[] compact = addActions(appContext, b, snap);

        b.setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(token)
                .setShowActionsInCompactView(compact));

        NotificationManagerCompat nm = NotificationManagerCompat.from(appContext);
        if (nm.areNotificationsEnabled()) {
            try {
                nm.notify(NOTIF_ID, b.build());
            } catch (SecurityException ignored) {
                // Permission POST_NOTIFICATIONS refusée : la barre est un confort.
            }
        }

        // Pochette pas encore décodée : on la charge en fond puis on re-poste la
        // barre enrichie (le snapshot courant peut avoir changé entre-temps).
        if (art == null && snap.imageUrl != null && !snap.imageUrl.isEmpty()) {
            CookArt.load(snap.imageUrl, bmp -> {
                if (appContext != null && lastSnap != null) show(appContext, lastSnap);
            });
        }
    }

    /** Retire la barre et libère la session média. */
    static void hide(Context ctx) {
        NotificationManagerCompat.from(ctx).cancel(NOTIF_ID);
        CookMedia.release();
        CookArt.clear();
        lastSnap = null;
    }

    /**
     * Ajoute les boutons de transport et renvoie les index à montrer en vue
     * compacte (max 3). Ordre : Précédent, Pause/Reprendre (si minuteur), Suivant,
     * Terminer. La compacte privilégie Précédent, Pause/Reprendre et Suivant.
     */
    private static int[] addActions(Context ctx, NotificationCompat.Builder b, CookSnapshot snap) {
        List<Integer> compact = new ArrayList<>();
        int idx = 0;

        if (snap.canPrev) {
            b.addAction(R.drawable.ic_media_prev, "Précédent", actionIntent(ctx, ACTION_PREV, 1));
            compact.add(idx++);
        }
        if (snap.hasTimer) {
            int icon = snap.timerRunning ? R.drawable.ic_media_pause : R.drawable.ic_media_play;
            b.addAction(icon, snap.timerRunning ? "Pause" : "Reprendre", actionIntent(ctx, ACTION_TOGGLE, 2));
            compact.add(idx++);
        }
        if (snap.canNext) {
            b.addAction(R.drawable.ic_media_next, "Suivant", actionIntent(ctx, ACTION_NEXT, 3));
            compact.add(idx++);
        }
        int stopIdx = idx;
        b.addAction(R.drawable.ic_media_stop, "Terminer", actionIntent(ctx, ACTION_STOP, 4));
        if (compact.size() < 3) compact.add(stopIdx);

        int[] out = new int[Math.min(3, compact.size())];
        for (int i = 0; i < out.length; i++) out[i] = compact.get(i);
        return out;
    }

    private static PendingIntent openAppIntent(Context ctx) {
        Intent intent = new Intent(ctx, MainActivity.class)
                .setAction(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_LAUNCHER)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return PendingIntent.getActivity(ctx, 0, intent, immutable(0));
    }

    private static PendingIntent actionIntent(Context ctx, String action, int requestCode) {
        Intent intent = new Intent(ctx, CookActionReceiver.class).putExtra(EXTRA_ACTION, action);
        return PendingIntent.getBroadcast(ctx, requestCode, intent, immutable(0));
    }

    /** Ajoute {@code FLAG_IMMUTABLE} (exigé API 31+) aux flags fournis. */
    private static int immutable(int flags) {
        return flags | PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0);
    }
}
