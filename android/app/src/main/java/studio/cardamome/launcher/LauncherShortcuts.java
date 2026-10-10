package studio.cardamome.launcher;

import android.content.Context;

import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

import studio.cardamome.R;

/**
 * Raccourcis dynamiques de l'icône (appui long). Leur choix et leurs libellés
 * viennent du JS ({@code buildShortcuts}) ; ici on ne fait que les publier.
 */
final class LauncherShortcuts {

    private LauncherShortcuts() {}

    /** Remplace tous les raccourcis dynamiques par la liste fournie, dans l'ordre. */
    static void publish(Context ctx, JSONArray items) {
        int max = ShortcutManagerCompat.getMaxShortcutCountPerActivity(ctx);
        List<ShortcutInfoCompat> shortcuts = new ArrayList<>();
        for (int i = 0; i < items.length() && shortcuts.size() < max; i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            String id = item.optString("id");
            String path = item.optString("path");
            String shortLabel = item.optString("shortLabel");
            if (id.isEmpty() || path.isEmpty() || shortLabel.isEmpty()) continue;
            shortcuts.add(new ShortcutInfoCompat.Builder(ctx, id)
                    .setShortLabel(shortLabel)
                    .setLongLabel(item.optString("longLabel", shortLabel))
                    .setIcon(IconCompat.createWithResource(ctx, iconRes(item.optString("icon"))))
                    .setIntent(LaunchLinks.intent(ctx, path))
                    .setRank(shortcuts.size())
                    .build());
        }
        try {
            ShortcutManagerCompat.setDynamicShortcuts(ctx, shortcuts);
        } catch (IllegalStateException | IllegalArgumentException e) {
            // Quota de mises à jour atteint ou lanceur capricieux : les raccourcis
            // précédents restent en place, la prochaine synchro retentera.
        }
    }

    /** Miroir du type {@code ShortcutIcon} (src/lib/launcher/shortcuts.ts). */
    private static int iconRes(String icon) {
        switch (icon) {
            case "meal": return R.drawable.ic_shortcut_meal;
            case "cart": return R.drawable.ic_shortcut_cart;
            case "camera": return R.drawable.ic_shortcut_camera;
            case "calendar": return R.drawable.ic_shortcut_calendar;
            default: return R.drawable.ic_shortcut_book;
        }
    }
}
