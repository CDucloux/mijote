package studio.cardamome.cooksession;

import com.getcapacitor.PluginCall;

/**
 * Copie native immuable du snapshot de session envoyé par le JS. Mappe le
 * contrat {@code CookSessionSnapshot} (cf. {@code cookSession/snapshot.ts}).
 */
final class CookSnapshot {
    final String recipeTitle;
    final String imageUrl;
    final String stepLabel;
    final String stepText;
    final int pageIndex;
    final int pageCount;
    final boolean canPrev;
    final boolean canNext;
    final boolean hasTimer;
    final String timerLabel;
    final long timerEndAt;
    final long timerTotalMs;
    final boolean timerRunning;

    private CookSnapshot(String recipeTitle, String imageUrl, String stepLabel, String stepText,
                         int pageIndex, int pageCount, boolean canPrev, boolean canNext,
                         boolean hasTimer, String timerLabel, long timerEndAt, long timerTotalMs,
                         boolean timerRunning) {
        this.recipeTitle = recipeTitle;
        this.imageUrl = imageUrl;
        this.stepLabel = stepLabel;
        this.stepText = stepText;
        this.pageIndex = pageIndex;
        this.pageCount = pageCount;
        this.canPrev = canPrev;
        this.canNext = canNext;
        this.hasTimer = hasTimer;
        this.timerLabel = timerLabel;
        this.timerEndAt = timerEndAt;
        this.timerTotalMs = timerTotalMs;
        this.timerRunning = timerRunning;
    }

    /** Lit le snapshot depuis les données d'un appel de plugin. */
    static CookSnapshot fromCall(PluginCall call) {
        String recipeTitle = call.getString("recipeTitle", "Recette");
        String imageUrl = call.getString("imageUrl", "");
        String stepLabel = call.getString("stepLabel", "");
        String stepText = call.getString("stepText", "");
        int pageIndex = call.getInt("pageIndex", 0);
        int pageCount = call.getInt("pageCount", 0);
        boolean canPrev = Boolean.TRUE.equals(call.getBoolean("canPrev", false));
        boolean canNext = Boolean.TRUE.equals(call.getBoolean("canNext", false));

        com.getcapacitor.JSObject timer = call.getObject("timer");
        boolean hasTimer = timer != null;
        String timerLabel = "";
        long timerEndAt = 0L;
        long timerTotalMs = 0L;
        boolean timerRunning = false;
        if (hasTimer) {
            timerLabel = timer.optString("label", "");
            timerEndAt = timer.optLong("endAt", 0L);
            timerTotalMs = timer.optLong("totalMs", 0L);
            timerRunning = timer.optBoolean("running", false);
        }
        return new CookSnapshot(recipeTitle, imageUrl, stepLabel, stepText, pageIndex, pageCount,
                canPrev, canNext, hasTimer, timerLabel, timerEndAt, timerTotalMs, timerRunning);
    }
}
