package studio.cardamome.launcher;

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
 * sans réseau ni app ouverte.
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
}
