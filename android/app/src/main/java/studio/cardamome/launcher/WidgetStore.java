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
import java.util.Date;
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
    private static final int FALLBACK_COLOR = 0xFF75A63F;

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

    /**
     * Repas du jour, ou {@code null} sans instantané. Un instantané trop vieux
     * pour couvrir aujourd'hui donne une liste vide : mieux vaut « rien de prévu »
     * qu'un menu périmé.
     */
    static JSONArray todayMeals(Context ctx) {
        JSONObject snapshot = load(ctx);
        if (snapshot == null) return null;
        JSONArray days = snapshot.optJSONArray("days");
        String today = todayKey();
        for (int i = 0; days != null && i < days.length(); i++) {
            JSONObject day = days.optJSONObject(i);
            if (day != null && today.equals(day.optString("key"))) {
                JSONArray meals = day.optJSONArray("meals");
                return meals != null ? meals : new JSONArray();
            }
        }
        return new JSONArray();
    }

    /** Redessine tous les widgets posés après une nouvelle synchronisation. */
    static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        MenuWidgetProvider.render(ctx, mgr, mgr.getAppWidgetIds(new ComponentName(ctx, MenuWidgetProvider.class)));
        ShoppingWidgetProvider.render(ctx, mgr, mgr.getAppWidgetIds(new ComponentName(ctx, ShoppingWidgetProvider.class)));
    }

    /** Clé du jour, en UTC comme {@code todayKey} côté JS (clés du planning). */
    static String todayKey() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    /** Date du jour en toutes lettres courtes (« sam. 10 oct. »). */
    static String todayLabel() {
        return new SimpleDateFormat("EEE d MMM", Locale.FRANCE).format(new Date());
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
