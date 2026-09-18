package studio.cardamome;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import studio.cardamome.cooksession.CookSessionPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CookSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
