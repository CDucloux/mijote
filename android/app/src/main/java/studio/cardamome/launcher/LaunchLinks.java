package studio.cardamome.launcher;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import studio.cardamome.MainActivity;

/**
 * Liens d'ouverture vers un écran de l'app. Le natif ne connaît que des chemins
 * fournis par le JS ; il les enveloppe dans un lien que {@code useLaunchLinks}
 * rejoue dans le routeur (via {@code getLaunchUrl} ou {@code appUrlOpen}).
 */
final class LaunchLinks {

    /** Miroir de {@code LAUNCH_PREFIX} (src/lib/launcher/deepLink.ts). */
    static final String PREFIX = "cardamome://open";

    private LaunchLinks() {}

    /** Intent explicite vers l'activité principale, porteur du chemin visé. */
    static Intent intent(Context ctx, String path) {
        return new Intent(Intent.ACTION_VIEW, Uri.parse(PREFIX + path), ctx, MainActivity.class);
    }

    /**
     * PendingIntent d'un tap de widget. L'URI participe à l'égalité des intents :
     * chaque chemin obtient donc son propre PendingIntent, sans s'écraser.
     */
    static PendingIntent pending(Context ctx, String path) {
        Intent open = intent(ctx, path)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
