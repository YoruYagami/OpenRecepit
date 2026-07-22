package app.scontrini.trasferta;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SharedFilePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // launchMode=singleTask: a share while the app is alive arrives here.
        // Store it so SharedFilePlugin.consume() picks it up on resume.
        setIntent(intent);
    }
}
