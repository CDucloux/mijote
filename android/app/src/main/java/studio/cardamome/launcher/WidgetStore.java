package studio.cardamome.launcher;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Instantané partagé par les widgets (cf. {@code buildWidgetSnapshot}). Il vit
 * dans les préférences : les widgets se redessinent sans l'app, y compris au
 * passage de minuit grâce aux jours suivants fournis d'avance.
 */
final class WidgetStore {

    private static final String PREFS = "cardamome_launcher";
    private static final String KEY = "widget_snapshot";
    /** Cases cochées sur le widget, pas encore relevées par l'app : clé d'article → bascule. */
    private static final String CHECKS = "widget_checks";
    private static final int FALLBACK_COLOR = 0xFF75A63F;
    private static final long DAY_MS = 24L * 60 * 60 * 1000;

    private WidgetStore() {}

    static void save(Context ctx, String json) {
        prefs(ctx).edit().putString(KEY, json).apply();
    }

    /** Instantané courant, ou {@code null} tant que l'app n'en a poussé aucun. */
    static JSONObject load(Context ctx) {
        String json = prefs(ctx).getString(KEY, null);
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (JSONException e) {
            return null;
        }
    }

    /** Journée affichée par « Au menu » : son libellé et ses repas. */
    static final class MenuDay {
        final String label;
        /** {@code null} tant que l'app n'a poussé aucun instantané. */
        final JSONArray meals;

        MenuDay(String label, JSONArray meals) {
            this.label = label;
            this.meals = meals;
        }
    }

    /**
     * Les repas du jour, ou ceux de demain quand aujourd'hui est vide : le soir
     * venu, c'est demain qu'on prépare. Un instantané trop vieux pour couvrir
     * aujourd'hui donne une liste vide : mieux vaut « rien de prévu » qu'un menu
     * périmé.
     */
    static MenuDay menuDay(Context ctx) {
        JSONObject snapshot = load(ctx);
        if (snapshot == null) return new MenuDay(dayLabel(0), null);
        JSONArray days = snapshot.optJSONArray("days");
        JSONArray today = mealsOf(days, dayKey(0));
        if (today.length() > 0) return new MenuDay(dayLabel(0), today);
        JSONArray tomorrow = mealsOf(days, dayKey(1));
        if (tomorrow.length() > 0) return new MenuDay("Demain", tomorrow);
        return new MenuDay(dayLabel(0), today);
    }

    private static JSONArray mealsOf(JSONArray days, String key) {
        for (int i = 0; days != null && i < days.length(); i++) {
            JSONObject day = days.optJSONObject(i);
            if (day != null && key.equals(day.optString("key"))) {
                JSONArray meals = day.optJSONArray("meals");
                return meals != null ? meals : new JSONArray();
            }
        }
        return new JSONArray();
    }

    /** Un article du widget « Courses », l'état coché sur le widget en surimpression. */
    static final class ShopItem {
        final String key;
        final String name;
        final String qty;
        final boolean checked;

        ShopItem(String key, String name, String qty, boolean checked) {
            this.key = key;
            this.name = name;
            this.qty = qty;
            this.checked = checked;
        }
    }

    /** Articles à acheter, {@code null} tant que l'app n'a poussé aucun instantané. */
    static List<ShopItem> shoppingItems(Context ctx) {
        JSONObject shopping = shopping(ctx);
        if (shopping == null) return null;
        JSONObject checks = checks(ctx);
        JSONArray items = shopping.optJSONArray("items");
        List<ShopItem> out = new ArrayList<>();
        for (int i = 0; items != null && i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            String key = item.optString("key");
            out.add(new ShopItem(key, item.optString("name"), item.optString("qty"), checks.has(key)));
        }
        return out;
    }

    /**
     * Articles restant à acheter, moins ceux cochés sur le widget depuis la
     * dernière synchronisation ; {@code -1} sans instantané.
     */
    static int shoppingRemaining(Context ctx) {
        JSONObject shopping = shopping(ctx);
        if (shopping == null) return -1;
        int checked = 0;
        List<ShopItem> items = shoppingItems(ctx);
        for (ShopItem item : items) if (item.checked) checked++;
        return Math.max(0, shopping.optInt("remaining", 0) - checked);
    }

    /**
     * Coche ou décoche un article depuis le widget, en attendant que l'app relève
     * la bascule ({@link #takeChecks}). L'instantané ne liste que des articles à
     * acheter : décocher revient donc à oublier la bascule.
     */
    static void toggleShopping(Context ctx, String key) {
        JSONObject shopping = shopping(ctx);
        JSONArray items = shopping == null ? null : shopping.optJSONArray("items");
        JSONObject checks = checks(ctx);
        if (checks.has(key)) {
            checks.remove(key);
        } else {
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null || !key.equals(item.optString("key"))) continue;
                try {
                    checks.put(key, new JSONObject().put("checked", true).put("refs", item.optJSONArray("refs")));
                } catch (JSONException e) {
                    return;
                }
                break;
            }
        }
        prefs(ctx).edit().putString(CHECKS, checks.toString()).apply();
    }

    /**
     * Rend les bascules en attente et les oublie : l'app les applique aussitôt,
     * puis pousse un instantané où ces articles ne figurent plus.
     */
    static JSONArray takeChecks(Context ctx) {
        JSONObject checks = checks(ctx);
        JSONArray out = new JSONArray();
        Iterator<String> keys = checks.keys();
        while (keys.hasNext()) {
            JSONObject check = checks.optJSONObject(keys.next());
            if (check != null) out.put(check);
        }
        prefs(ctx).edit().remove(CHECKS).apply();
        return out;
    }

    private static JSONObject shopping(Context ctx) {
        JSONObject snapshot = load(ctx);
        return snapshot == null ? null : snapshot.optJSONObject("shopping");
    }

    private static JSONObject checks(Context ctx) {
        String json = prefs(ctx).getString(CHECKS, null);
        if (json == null) return new JSONObject();
        try {
            return new JSONObject(json);
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    /** Redessine tous les widgets posés après une nouvelle synchronisation. */
    static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        MenuWidgetProvider.render(ctx, mgr, ids(ctx, mgr, MenuWidgetProvider.class));
        ShoppingWidgetProvider.render(ctx, mgr, ids(ctx, mgr, ShoppingWidgetProvider.class));
    }

    static int[] ids(Context ctx, AppWidgetManager mgr, Class<?> provider) {
        return mgr.getAppWidgetIds(new ComponentName(ctx, provider));
    }

    /** Clé du jour J+offset, en UTC comme {@code todayKey} côté JS (clés du planning). */
    private static String dayKey(int offset) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(System.currentTimeMillis() + offset * DAY_MS));
    }

    /** Date du jour J+offset en toutes lettres courtes (« sam. 10 oct. »). */
    private static String dayLabel(int offset) {
        return new SimpleDateFormat("EEE d MMM", Locale.FRANCE).format(new Date(System.currentTimeMillis() + offset * DAY_MS));
    }

    static int parseColor(String hex) {
        try {
            return Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            return FALLBACK_COLOR;
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
