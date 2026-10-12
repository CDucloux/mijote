package studio.cardamome.launcher;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import studio.cardamome.R;

/**
 * Widget « Au menu » : les repas du jour (ou de demain si aujourd'hui est vide),
 * avec photo, créneau et durée, chacun ouvrant sa recette ; l'en-tête ouvre le
 * planning.
 */
public class MenuWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        if (ids == null || ids.length == 0) return;
        WidgetStore.MenuDay day = WidgetStore.menuDay(ctx);
        for (int id : ids) mgr.updateAppWidget(id, build(ctx, id, day));
        mgr.notifyAppWidgetViewDataChanged(ids, R.id.menu_list);
    }

    private static RemoteViews build(Context ctx, int widgetId, WidgetStore.MenuDay day) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_menu);
        PendingIntent planning = LaunchLinks.pending(ctx, "/meal-plan");
        views.setOnClickPendingIntent(R.id.menu_header, planning);
        views.setOnClickPendingIntent(R.id.menu_empty, planning);
        views.setTextViewText(R.id.menu_date, day.label);
        views.setTextViewText(R.id.menu_empty_text, day.meals == null
                ? "Ouvrez Cardamome une fois pour retrouver vos repas ici."
                : "Rien de prévu pour l'instant.\nTouchez pour composer le menu.");

        Intent adapter = new Intent(ctx, MenuWidgetService.class)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        adapter.setData(Uri.parse(adapter.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.menu_list, adapter);
        views.setEmptyView(R.id.menu_list, R.id.menu_empty);
        views.setPendingIntentTemplate(R.id.menu_list, LaunchLinks.template(ctx, 1));
        return views;
    }
}
