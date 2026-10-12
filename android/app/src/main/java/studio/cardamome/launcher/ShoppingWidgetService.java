package studio.cardamome.launcher;

import android.content.Context;
import android.content.Intent;
import android.graphics.Paint;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import java.util.ArrayList;
import java.util.List;

import studio.cardamome.R;

/** Lignes de la liste du widget « Courses », relues dans l'instantané partagé. */
public class ShoppingWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    private static final class Factory implements RemoteViewsFactory {
        private final Context ctx;
        private List<WidgetStore.ShopItem> items = new ArrayList<>();

        Factory(Context ctx) {
            this.ctx = ctx;
        }

        @Override
        public void onCreate() {}

        @Override
        public void onDataSetChanged() {
            List<WidgetStore.ShopItem> loaded = WidgetStore.shoppingItems(ctx);
            items = loaded != null ? loaded : new ArrayList<>();
        }

        @Override
        public void onDestroy() {}

        @Override
        public int getCount() {
            return items.size();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews row = new RemoteViews(ctx.getPackageName(), R.layout.widget_shopping_item);
            if (position >= items.size()) return row;
            WidgetStore.ShopItem item = items.get(position);
            row.setTextViewText(R.id.shop_item_name, item.name);
            row.setTextViewText(R.id.shop_item_qty, item.qty);
            row.setImageViewResource(R.id.shop_item_check, item.checked ? R.drawable.widget_check_on : R.drawable.widget_check_off);
            int flags = Paint.ANTI_ALIAS_FLAG | (item.checked ? Paint.STRIKE_THRU_TEXT_FLAG : 0);
            row.setInt(R.id.shop_item_name, "setPaintFlags", flags);
            row.setTextColor(R.id.shop_item_name, ctx.getColor(item.checked ? R.color.widget_text3 : R.color.widget_text));
            row.setOnClickFillInIntent(R.id.shop_item, new Intent().putExtra(ShoppingWidgetProvider.EXTRA_KEY, item.key));
            return row;
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 1;
        }

        @Override
        public long getItemId(int position) {
            return position < items.size() ? items.get(position).key.hashCode() : position;
        }

        @Override
        public boolean hasStableIds() {
            return true;
        }
    }
}
