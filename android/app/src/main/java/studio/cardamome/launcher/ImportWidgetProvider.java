package studio.cardamome.launcher;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import studio.cardamome.R;

/**
 * Widget « Import intelligent » : une porte d'entrée par mode d'import, chacune
 * ouvrant directement sa page. Statique : rien à relire, seuls les taps se branchent.
 */
public class ImportWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_import);
        views.setOnClickPendingIntent(R.id.import_photo, LaunchLinks.pending(ctx, "/recipes/import-from-picture"));
        views.setOnClickPendingIntent(R.id.import_link, LaunchLinks.pending(ctx, "/recipes/import-from-url"));
        views.setOnClickPendingIntent(R.id.import_text, LaunchLinks.pending(ctx, "/recipes/import-from-text"));
        views.setOnClickPendingIntent(R.id.import_pdf, LaunchLinks.pending(ctx, "/recipes/import-from-pdf"));
        mgr.updateAppWidget(ids, views);
    }
}
