package studio.cardamome.cooksession;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import studio.cardamome.MainActivity;
import studio.cardamome.R;

/**
 * Construit et poste la notification « ongoing » du cook mode. Une seule barre
 * à la fois (identifiant fixe). Le décompte du minuteur pilote est délégué au
 * chronomètre système : posé une fois, il s'anime sans réveiller le JS.
 */
final class CookNotification {

    static final String CHANNEL_ID = "cook_session";
    static final int NOTIF_ID = 4201;

    static final String EXTRA_ACTION = "cook_action";
    static final String ACTION_NEXT = "next";
    static final String ACTION_PREV = "prev";
    static final String ACTION_TOGGLE = "toggleTimer";
    static final String ACTION_STOP = "stop";

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
        ensureChannel(ctx);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_cook_notification)
                .setContentTitle(snap.recipeTitle)
                .setContentText(subtitle(snap))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(openAppIntent(ctx));

        if (snap.stepText != null && !snap.stepText.isEmpty()) {
            b.setStyle(new NotificationCompat.BigTextStyle().bigText(snap.stepText));
        }

        // Décompte live du minuteur pilote, animé par l'OS (WebView gelée incluse).
        if (snap.hasTimer && snap.timerRunning && snap.timerEndAt > System.currentTimeMillis()) {
            b.setWhen(snap.timerEndAt).setUsesChronometer(true).setChronometerCountDown(true);
        } else {
            b.setShowWhen(false);
        }

        if (snap.canPrev) {
            b.addAction(0, "Précédent", actionIntent(ctx, ACTION_PREV, 1));
        }
        if (snap.hasTimer) {
            b.addAction(0, snap.timerRunning ? "Pause" : "Reprendre",
                    actionIntent(ctx, ACTION_TOGGLE, 2));
        }
        if (snap.canNext) {
            b.addAction(0, "Suivant", actionIntent(ctx, ACTION_NEXT, 3));
        }
        b.addAction(0, "Terminer", actionIntent(ctx, ACTION_STOP, 4));

        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (nm.areNotificationsEnabled()) {
            try {
                nm.notify(NOTIF_ID, b.build());
            } catch (SecurityException ignored) {
                // Permission POST_NOTIFICATIONS refusée : la barre est un confort.
            }
        }
    }

    /** Retire la barre. */
    static void hide(Context ctx) {
        NotificationManagerCompat.from(ctx).cancel(NOTIF_ID);
    }

    /** Deuxième ligne : position d'étape, complétée du minuteur si présent. */
    private static String subtitle(CookSnapshot snap) {
        if (snap.hasTimer && snap.timerLabel != null && !snap.timerLabel.isEmpty()) {
            return snap.stepLabel + " · " + snap.timerLabel;
        }
        return snap.stepLabel;
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
