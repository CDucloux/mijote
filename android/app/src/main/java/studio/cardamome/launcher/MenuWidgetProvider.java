package studio.cardamome.launcher;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import studio.cardamome.R;

/**
 * Widget « Au menu » : les repas planifiés du jour, chacun ouvrant sa recette,
 * le reste du widget ouvrant le planning. Le créneau reprend sa couleur du
 * planning ; un repas composé n'affiche son créneau qu'une fois.
 */
public class MenuWidgetProvider extends AppWidgetProvider {

    private static final int[] ROWS = { R.id.menu_row_0, R.id.menu_row_1, R.id.menu_row_2 };
    private static final int[] SLOTS = { R.id.menu_slot_0, R.id.menu_slot_1, R.id.menu_slot_2 };
    private static final int[] TITLES = { R.id.menu_title_0, R.id.menu_title_1, R.id.menu_title_2 };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        if (ids == null || ids.length == 0) return;
        mgr.updateAppWidget(ids, build(ctx));
    }

    private static RemoteViews build(Context ctx) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_menu);
        views.setTextViewText(R.id.menu_date, WidgetStore.todayLabel());
        views.setOnClickPendingIntent(android.R.id.background, LaunchLinks.pending(ctx, "/meal-plan"));

        JSONArray meals = WidgetStore.todayMeals(ctx);
        int count = meals == null ? 0 : Math.min(meals.length(), ROWS.length);
        String previousSlot = null;
        for (int i = 0; i < ROWS.length; i++) {
            JSONObject meal = i < count ? meals.optJSONObject(i) : null;
            if (meal == null) {
                views.setViewVisibility(ROWS[i], View.GONE);
                continue;
            }
            String slot = meal.optString("slot");
            views.setViewVisibility(ROWS[i], View.VISIBLE);
            views.setTextViewText(SLOTS[i], slot.equals(previousSlot) ? "" : slot);
            views.setTextColor(SLOTS[i], WidgetStore.parseColor(meal.optString("color")));
            views.setTextViewText(TITLES[i], meal.optString("title"));
            views.setOnClickPendingIntent(ROWS[i], LaunchLinks.pending(ctx, meal.optString("path", "/meal-plan")));
            previousSlot = slot;
        }

        boolean empty = count == 0;
        views.setViewVisibility(R.id.menu_empty, empty ? View.VISIBLE : View.GONE);
        if (empty) {
            views.setTextViewText(R.id.menu_empty, meals == null
                    ? "Ouvrez Cardamome une fois pour voir vos repas ici."
                    : "Rien de prévu aujourd'hui. Touchez pour planifier.");
        }
        return views;
    }
}
