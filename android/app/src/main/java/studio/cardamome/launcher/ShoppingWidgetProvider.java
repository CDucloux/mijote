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
 * Widget « Courses » : le nombre d'articles restant à acheter en gros, les
 * premiers articles en dessous. Tout le widget ouvre la liste de courses.
 */
public class ShoppingWidgetProvider extends AppWidgetProvider {

    private static final int[] ROWS = { R.id.shop_row_0, R.id.shop_row_1, R.id.shop_row_2, R.id.shop_row_3 };
    private static final int[] NAMES = { R.id.shop_name_0, R.id.shop_name_1, R.id.shop_name_2, R.id.shop_name_3 };
    private static final int[] QTYS = { R.id.shop_qty_0, R.id.shop_qty_1, R.id.shop_qty_2, R.id.shop_qty_3 };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        if (ids == null || ids.length == 0) return;
        mgr.updateAppWidget(ids, build(ctx));
    }

    private static RemoteViews build(Context ctx) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_shopping);
        views.setOnClickPendingIntent(android.R.id.background, LaunchLinks.pending(ctx, "/shopping-lists"));

        JSONObject snapshot = WidgetStore.load(ctx);
        JSONObject shopping = snapshot == null ? null : snapshot.optJSONObject("shopping");
        int remaining = shopping == null ? 0 : shopping.optInt("remaining", 0);
        JSONArray items = shopping == null ? null : shopping.optJSONArray("items");

        views.setViewVisibility(R.id.shop_count, remaining > 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.shop_count, String.valueOf(remaining));
        views.setTextViewText(R.id.shop_count_label, shopping == null
                ? "Ouvrez Cardamome une fois pour voir votre liste ici."
                : remaining == 0 ? "Tout est acheté."
                : remaining == 1 ? "article à acheter" : "articles à acheter");

        for (int i = 0; i < ROWS.length; i++) {
            JSONObject item = items != null && i < items.length() ? items.optJSONObject(i) : null;
            if (item == null) {
                views.setViewVisibility(ROWS[i], View.GONE);
                continue;
            }
            views.setViewVisibility(ROWS[i], View.VISIBLE);
            views.setTextViewText(NAMES[i], item.optString("name"));
            views.setTextViewText(QTYS[i], item.optString("qty"));
        }
        return views;
    }
}
