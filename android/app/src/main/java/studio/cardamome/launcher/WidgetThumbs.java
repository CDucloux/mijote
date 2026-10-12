package studio.cardamome.launcher;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.util.Set;

/**
 * Vignettes photo du widget « Au menu ». Un widget n'affiche pas d'URL : la photo
 * est téléchargée une fois, recadrée en carré aux coins arrondis, puis gardée en
 * cache. Appels bloquants, à faire hors du fil principal (fabrique de la liste).
 */
final class WidgetThumbs {

    /** Côté de la vignette en pixels : net en 56dp jusqu'en xxhdpi, léger pour le binder. */
    private static final int SIZE = 160;
    private static final float RADIUS = SIZE * 0.22f;
    private static final int MAX_BYTES = 8 * 1024 * 1024;
    private static final int TIMEOUT_MS = 6000;

    private WidgetThumbs() {}

    /** La vignette de {@code url}, ou {@code null} si elle reste introuvable. */
    static Bitmap get(Context ctx, String url) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return null;
        File file = fileFor(ctx, url);
        if (file.exists()) {
            Bitmap cached = BitmapFactory.decodeFile(file.getPath());
            if (cached != null) return cached;
        }
        Bitmap thumb = download(url);
        if (thumb == null) return null;
        try (FileOutputStream out = new FileOutputStream(file)) {
            thumb.compress(Bitmap.CompressFormat.PNG, 100, out);
        } catch (IOException ignored) {
            // Pas de cache cette fois : la vignette s'affiche quand même.
        }
        return thumb;
    }

    /** Oublie les vignettes des repas qui ne sont plus affichés. */
    static void prune(Context ctx, Set<String> keepUrls) {
        File[] files = dir(ctx).listFiles();
        if (files == null) return;
        for (File file : files) {
            boolean kept = false;
            for (String url : keepUrls) kept |= file.getName().equals(nameFor(url));
            if (!kept) file.delete();
        }
    }

    private static Bitmap download(String url) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);
            if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
            byte[] bytes = readCapped(conn.getInputStream());
            return bytes == null ? null : rounded(decodeSampled(bytes));
        } catch (IOException | RuntimeException e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static byte[] readCapped(InputStream in) throws IOException {
        try (InputStream stream = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = stream.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                if (out.size() > MAX_BYTES) return null;
            }
            return out.toByteArray();
        }
    }

    /** Décode à la taille utile : une photo 4000px pleine résolution ferait sauter le binder. */
    private static Bitmap decodeSampled(byte[] bytes) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        int sample = 1;
        while (Math.min(bounds.outWidth, bounds.outHeight) / (sample * 2) >= SIZE) sample *= 2;
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
    }

    /** Recadrage centré en carré, coins arrondis (un ImageView de widget ne sait pas clipper). */
    private static Bitmap rounded(Bitmap source) {
        if (source == null) return null;
        float scale = (float) SIZE / Math.min(source.getWidth(), source.getHeight());
        Matrix matrix = new Matrix();
        matrix.setScale(scale, scale);
        matrix.postTranslate((SIZE - source.getWidth() * scale) / 2f, (SIZE - source.getHeight() * scale) / 2f);
        BitmapShader shader = new BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP);
        shader.setLocalMatrix(matrix);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        paint.setShader(shader);
        Bitmap out = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
        new Canvas(out).drawRoundRect(new RectF(0, 0, SIZE, SIZE), RADIUS, RADIUS, paint);
        source.recycle();
        return out;
    }

    private static File fileFor(Context ctx, String url) {
        return new File(dir(ctx), nameFor(url));
    }

    private static String nameFor(String url) {
        return Integer.toHexString(url.hashCode()) + ".png";
    }

    private static File dir(Context ctx) {
        File dir = new File(ctx.getCacheDir(), "widget_thumbs");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }
}
