package app.vitaschola;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KeystoreStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
