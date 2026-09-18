package studio.cardamome.cooksession;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Chargement de la pochette (photo de recette) pour la notification média du
 * cook mode. Gère un cache d'une entrée (la barre n'affiche qu'une recette à la
 * fois) et déporte le décodage réseau / base64 sur un thread de fond.
 *
 * Deux sources possibles, alignées sur {@code recipe.image} côté JS : une data
 * URI ({@code data:image/...;base64,...}, recettes importées non enregistrées)
 * ou une URL distante Firebase Storage. Tout échec est silencieux : la
 * notification s'affiche alors sans pochette.
 */
final class CookArt {

    /** Côté le plus long de la pochette décodée : borne la mémoire et le temps. */
    private static final int MAX_EDGE = 512;

    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private static String cachedUrl = "";
    private static Bitmap cachedBitmap = null;
    private static String loadingUrl = "";
    private static String failedUrl = "";

    private CookArt() {}

    /** Callback invoqué sur le thread principal quand une pochette est prête. */
    interface Ready {
        void onArt(Bitmap bitmap);
    }

    /**
     * Pochette déjà en cache pour cette URL, ou {@code null} si absente / autre
     * recette. Lecture synchrone sans I/O, utilisable au moment de bâtir la notif.
     */
    static Bitmap cached(String url) {
        if (url == null || url.isEmpty()) return null;
        return url.equals(cachedUrl) ? cachedBitmap : null;
    }

    /** Réinitialise le cache (fin de session) : la prochaine recette repart neuf. */
    static void clear() {
        cachedUrl = "";
        cachedBitmap = null;
        loadingUrl = "";
        failedUrl = "";
    }

    /**
     * Demande le chargement de la pochette de {@code url}. No-op si déjà en cache,
     * déjà en cours, ou déjà en échec pour cette même URL. Sinon décode en fond
     * puis notifie {@code ready} sur le thread principal (une seule fois).
     */
    static void load(String url, Ready ready) {
        if (url == null || url.isEmpty()) return;
        if (url.equals(cachedUrl) && cachedBitmap != null) return;
        if (url.equals(loadingUrl) || url.equals(failedUrl)) return;
        loadingUrl = url;
        IO.execute(() -> {
            Bitmap bmp = decode(url);
            MAIN.post(() -> {
                if (!url.equals(loadingUrl)) return; // une demande plus récente a pris le relais
                loadingUrl = "";
                if (bmp == null) { failedUrl = url; return; }
                cachedUrl = url;
                cachedBitmap = bmp;
                ready.onArt(bmp);
            });
        });
    }

    private static Bitmap decode(String url) {
        try {
            if (url.startsWith("data:")) return decodeDataUri(url);
            return decodeRemote(url);
        } catch (Exception e) {
            return null;
        }
    }

    private static Bitmap decodeDataUri(String url) {
        int comma = url.indexOf(',');
        if (comma < 0) return null;
        byte[] bytes = Base64.decode(url.substring(comma + 1), Base64.DEFAULT);
        return downscale(BitmapFactory.decodeByteArray(bytes, 0, bytes.length));
    }

    private static Bitmap decodeRemote(String url) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        conn.setInstanceFollowRedirects(true);
        try (InputStream in = conn.getInputStream()) {
            return downscale(BitmapFactory.decodeStream(in));
        } finally {
            conn.disconnect();
        }
    }

    /** Réduit la pochette pour que son côté le plus long ne dépasse pas {@link #MAX_EDGE}. */
    private static Bitmap downscale(Bitmap src) {
        if (src == null) return null;
        int w = src.getWidth();
        int h = src.getHeight();
        int longEdge = Math.max(w, h);
        if (longEdge <= MAX_EDGE) return src;
        float ratio = (float) MAX_EDGE / longEdge;
        Bitmap scaled = Bitmap.createScaledBitmap(src, Math.round(w * ratio), Math.round(h * ratio), true);
        if (scaled != src) src.recycle();
        return scaled;
    }
}
