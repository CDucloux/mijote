package studio.cardamome.launcher;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import studio.cardamome.R;

/**
 * Lignes du widget « Au menu ». Les photos se chargent ici, hors du fil principal :
 * c'est la seule raison d'être de cette liste plutôt que de lignes fixes.
 */
public class MenuWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext());
    }

    private static final class Row {
        final JSONObject meal;
        /** Créneau à afficher : vide pour la suite d'un repas composé. */
        final String slot;
        final Bitmap thumb;

        Row(JSONObject meal, String slot, Bitmap thumb) {
            this.meal = meal;
            this.slot = slot;
            this.thumb = thumb;
        }
    }

    private static final class Factory implements RemoteViewsFactory {
        private final Context ctx;
        private List<Row> rows = new ArrayList<>();

        Factory(Context ctx) {
            this.ctx = ctx;
        }

        @Override
        public void onCreate() {}

        @Override
        public void onDataSetChanged() {
            JSONArray meals = WidgetStore.menuDay(ctx).meals;
            List<Row> next = new ArrayList<>();
            Set<String> urls = new HashSet<>();
            String previousSlot = null;
            for (int i = 0; meals != null && i < meals.length(); i++) {
                JSONObject meal = meals.optJSONObject(i);
                if (meal == null) continue;
                String slot = meal.optString("slot");
                String image = meal.optString("image");
                if (!image.isEmpty()) urls.add(image);
                next.add(new Row(meal, slot.equals(previousSlot) ? "" : slot, WidgetThumbs.get(ctx, image)));
                previousSlot = slot;
            }
            WidgetThumbs.prune(ctx, urls);
            rows = next;
        }

        @Override
        public void onDestroy() {}

        @Override
        public int getCount() {
            return rows.size();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            RemoteViews view = new RemoteViews(ctx.getPackageName(), R.layout.widget_menu_item);
            if (position >= rows.size()) return view;
            Row row = rows.get(position);
            int color = WidgetStore.parseColor(row.meal.optString("color"));
            view.setTextViewText(R.id.menu_item_slot, row.slot);
            view.setViewVisibility(R.id.menu_item_slot, row.slot.isEmpty() ? View.GONE : View.VISIBLE);
            view.setTextColor(R.id.menu_item_slot, color);
            view.setTextViewText(R.id.menu_item_title, row.meal.optString("title"));
            String meta = row.meal.optString("meta");
            view.setTextViewText(R.id.menu_item_meta, meta);
            view.setViewVisibility(R.id.menu_item_meta, meta.isEmpty() ? View.GONE : View.VISIBLE);
            if (row.thumb != null) {
                view.setImageViewBitmap(R.id.menu_item_photo, row.thumb);
                view.setViewVisibility(R.id.menu_item_photo, View.VISIBLE);
                view.setViewVisibility(R.id.menu_item_glyph, View.GONE);
            } else {
                view.setViewVisibility(R.id.menu_item_photo, View.GONE);
                view.setViewVisibility(R.id.menu_item_glyph, View.VISIBLE);
                view.setInt(R.id.menu_item_glyph, "setColorFilter", color);
            }
            view.setOnClickFillInIntent(R.id.menu_item, LaunchLinks.fillIn(row.meal.optString("path", "/meal-plan")));
            return view;
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
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }
    }
}
