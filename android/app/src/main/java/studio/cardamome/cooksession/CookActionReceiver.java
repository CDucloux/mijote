package studio.cardamome.cooksession;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import studio.cardamome.MainActivity;

/**
 * Reçoit les taps sur les boutons de la barre du cook mode. Option A : ramène
 * l'app au premier plan (sauf « Terminer », qui n'a pas à rouvrir l'écran) et
 * relaie l'action au JS, qui la rejoue dans le cook mode.
 */
public class CookActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getStringExtra(CookNotification.EXTRA_ACTION);
        if (action == null) return;

        if (!CookNotification.ACTION_STOP.equals(action)) {
            Intent open = new Intent(context, MainActivity.class)
                    .setAction(Intent.ACTION_MAIN)
                    .addCategory(Intent.CATEGORY_LAUNCHER)
                    .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                            | Intent.FLAG_ACTIVITY_SINGLE_TOP
                            | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            context.startActivity(open);
        } else {
            CookNotification.hide(context);
        }

        CookSessionPlugin.emitAction(action);
    }
}
