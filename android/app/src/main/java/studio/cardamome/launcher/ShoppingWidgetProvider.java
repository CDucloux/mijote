package studio.cardamome.launcher;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import studio.cardamome.R;

/**
 * Widget « Courses » : la liste qui défile, restants d'abord puis achetés barrés,
 * chaque article se cochant ou se décochant d'un tap sans ouvrir l'app (cf.
 * {@link WidgetStore#toggleShopping}). L'en-tête ouvre la liste de courses.
 */
public class ShoppingWidgetProvider extends AppWidgetProvider {

    static final String ACTION_TOGGLE = "studio.cardamome.launcher.TOGGLE_SHOPPING_ITEM";
    static final String EXTRA_KEY = "key";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (ACTION_TOGGLE.equals(intent.getAction())) {
            String key = intent.getStringExtra(EXTRA_KEY);
            if (key == null) return;
            WidgetStore.toggleShopping(ctx, key);
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = WidgetStore.ids(ctx, mgr, ShoppingWidgetProvider.class);
            if (ids.length == 0) return;
            // Mise à jour partielle : la liste garde son défilement sous le pouce.
            RemoteViews header = new RemoteViews(ctx.getPackageName(), R.layout.widget_shopping);
            bindHeader(ctx, header);
            mgr.partiallyUpdateAppWidget(ids, header);
            mgr.notifyAppWidgetViewDataChanged(ids, R.id.shop_list);
            return;
        }
        super.onReceive(ctx, intent);
    }

    static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        if (ids == null || ids.length == 0) return;
        for (int id : ids) mgr.updateAppWidget(id, build(ctx, id));
        mgr.notifyAppWidgetViewDataChanged(ids, R.id.shop_list);
    }

    private static RemoteViews build(Context ctx, int widgetId) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_shopping);
        PendingIntent open = LaunchLinks.pending(ctx, "/shopping-lists");
        views.setOnClickPendingIntent(R.id.shop_header, open);
        views.setOnClickPendingIntent(R.id.shop_empty, open);
        bindHeader(ctx, views);

        Intent adapter = new Intent(ctx, ShoppingWidgetService.class)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        adapter.setData(Uri.parse(adapter.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.shop_list, adapter);
        views.setEmptyView(R.id.shop_list, R.id.shop_empty);
        views.setPendingIntentTemplate(R.id.shop_list, toggleTemplate(ctx));
        return views;
    }

    /** Compteur et libellés, qui suivent chaque case cochée. */
    private static void bindHeader(Context ctx, RemoteViews views) {
        int remaining = WidgetStore.shoppingRemaining(ctx);
        views.setViewVisibility(R.id.shop_count, remaining > 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.shop_count, String.valueOf(remaining));
        views.setTextViewText(R.id.shop_subtitle, remaining < 0 ? "Votre liste, à portée de pouce"
                : remaining == 0 ? "Tout est dans le panier"
                : remaining == 1 ? "Plus qu'un article à acheter" : "Articles à acheter");
        views.setTextViewText(R.id.shop_empty_text, remaining < 0
                ? "Ouvrez Cardamome une fois pour retrouver votre liste ici."
                : "Rien à acheter pour l'instant.\nTouchez pour ajouter un article.");
    }

    /** Gabarit des taps sur la liste ; chaque ligne y ajoute la clé de son article. */
    private static PendingIntent toggleTemplate(Context ctx) {
        Intent toggle = new Intent(ctx, ShoppingWidgetProvider.class).setAction(ACTION_TOGGLE);
        // Mutable par nécessité : le lanceur y glisse la clé de la ligne touchée.
        int mutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        return PendingIntent.getBroadcast(ctx, 0, toggle, PendingIntent.FLAG_UPDATE_CURRENT | mutable);
    }
}
