package studio.cardamome;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import studio.cardamome.cooksession.CookSessionPlugin;
import studio.cardamome.launcher.LauncherPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CookSessionPlugin.class);
        registerPlugin(LauncherPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
