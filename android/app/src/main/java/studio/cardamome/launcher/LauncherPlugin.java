package studio.cardamome.launcher;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Pont natif du lanceur : reçoit du JS (façade {@code launcher/plugin}) les
 * raccourcis de l'icône et l'instantané des widgets, à chaque changement du
 * planning ou des courses. Les widgets relisent ensuite cet instantané seuls,
 * sans réseau ni app ouverte ; en retour, l'app relève les articles cochés sur
 * le widget « Courses ». Lit aussi le presse-papiers pour l'import par lien, que
 * la WebView refuse de lire elle-même.
 */
@CapacitorPlugin(name = "Launcher")
public class LauncherPlugin extends Plugin {

    @PluginMethod
    public void sync(PluginCall call) {
        JSObject widget = call.getObject("widget");
        if (widget != null) {
            WidgetStore.save(getContext(), widget.toString());
            WidgetStore.refreshAll(getContext());
        }
        JSArray shortcuts = call.getArray("shortcuts");
        if (shortcuts != null) LauncherShortcuts.publish(getContext(), shortcuts);
        call.resolve();
    }

    @PluginMethod
    public void takeChecks(PluginCall call) {
        JSObject result = new JSObject();
        result.put("checks", WidgetStore.takeChecks(getContext()));
        call.resolve(result);
    }

    /**
     * Texte du presse-papiers. Android ne le livre qu'à l'app au premier plan ;
     * ailleurs (ou vide), on rend une chaîne vide plutôt qu'une erreur.
     */
    @PluginMethod
    public void clipboardText(PluginCall call) {
        JSObject result = new JSObject();
        ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = clipboard == null ? null : clipboard.getPrimaryClip();
        CharSequence text = clip == null || clip.getItemCount() == 0 ? null : clip.getItemAt(0).coerceToText(getContext());
        result.put("text", text == null ? "" : text.toString());
        call.resolve(result);
    }
}
