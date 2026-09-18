package studio.cardamome.cooksession;

import com.getcapacitor.PluginCall;

/**
 * Copie native immuable du snapshot de session envoyé par le JS. Mappe le
 * contrat {@code CookSessionSnapshot} (cf. {@code cookSession/snapshot.ts}).
 */
final class CookSnapshot {
    final String recipeTitle;
    final String stepLabel;
    final String stepText;
    final boolean canPrev;
    final boolean canNext;
    final boolean hasTimer;
    final String timerLabel;
    final long timerEndAt;
    final boolean timerRunning;

    private CookSnapshot(String recipeTitle, String stepLabel, String stepText,
                         boolean canPrev, boolean canNext, boolean hasTimer,
                         String timerLabel, long timerEndAt, boolean timerRunning) {
        this.recipeTitle = recipeTitle;
        this.stepLabel = stepLabel;
        this.stepText = stepText;
        this.canPrev = canPrev;
        this.canNext = canNext;
        this.hasTimer = hasTimer;
        this.timerLabel = timerLabel;
        this.timerEndAt = timerEndAt;
        this.timerRunning = timerRunning;
    }

    /** Lit le snapshot depuis les données d'un appel de plugin. */
    static CookSnapshot fromCall(PluginCall call) {
        String recipeTitle = call.getString("recipeTitle", "Recette");
        String stepLabel = call.getString("stepLabel", "");
        String stepText = call.getString("stepText", "");
        boolean canPrev = Boolean.TRUE.equals(call.getBoolean("canPrev", false));
        boolean canNext = Boolean.TRUE.equals(call.getBoolean("canNext", false));

        com.getcapacitor.JSObject timer = call.getObject("timer");
        boolean hasTimer = timer != null;
        String timerLabel = "";
        long timerEndAt = 0L;
        boolean timerRunning = false;
        if (hasTimer) {
            timerLabel = timer.optString("label", "");
            timerEndAt = timer.optLong("endAt", 0L);
            timerRunning = timer.optBoolean("running", false);
        }
        return new CookSnapshot(recipeTitle, stepLabel, stepText, canPrev, canNext,
                hasTimer, timerLabel, timerEndAt, timerRunning);
    }
}
