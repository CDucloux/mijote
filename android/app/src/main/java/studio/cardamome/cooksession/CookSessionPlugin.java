package studio.cardamome.cooksession;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.lang.ref.WeakReference;

/**
 * Pont natif de la barre de notification du cook mode.
 *
 * Côté JS (façade {@code cookSession/plugin}), on pilote une notification
 * « ongoing » qui reflète le pas à pas quand l'app passe en arrière-plan. Les
 * boutons de la notification réveillent l'app et rejouent l'action dans le
 * cook mode via l'événement {@code cookAction} (Option A : pas d'autonomie
 * hors app). Aucun foreground service : la notification vit seule une fois
 * postée, et le décompte du minuteur est animé par l'OS (chronomètre).
 */
@CapacitorPlugin(name = "CookSession")
public class CookSessionPlugin extends Plugin {

    /**
     * Référence faible vers l'instance vivante, pour que le
     * {@link CookActionReceiver} puisse pousser l'action vers le JS sans fuite
     * de contexte si le plugin a été détruit.
     */
    private static WeakReference<CookSessionPlugin> instanceRef = new WeakReference<>(null);

    @Override
    public void load() {
        instanceRef = new WeakReference<>(this);
        CookNotification.ensureChannel(getContext());
    }

    @PluginMethod
    public void start(PluginCall call) {
        CookNotification.show(getContext(), CookSnapshot.fromCall(call));
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        CookNotification.show(getContext(), CookSnapshot.fromCall(call));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        CookNotification.hide(getContext());
        call.resolve();
    }

    /**
     * Relaie vers le JS l'action d'un bouton de la notification. Appelé par le
     * receiver ; sans instance vivante, l'action est perdue côté JS mais l'app
     * est de toute façon ramenée au premier plan par le receiver.
     *
     * @param action identifiant d'action ({@code next}, {@code prev},
     *               {@code toggleTimer}, {@code stop}).
     */
    static void emitAction(String action) {
        CookSessionPlugin plugin = instanceRef.get();
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        plugin.notifyListeners("cookAction", data);
    }
}
