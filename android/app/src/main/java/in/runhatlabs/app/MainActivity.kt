package `in`.runhatlabs.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Must register before super.onCreate() so the bridge sees these plugins during init.
        registerPlugin(SaveFilePlugin::class.java)
        registerPlugin(PermReleasePlugin::class.java)
        registerPlugin(PlayBillingPlugin::class.java)
        super.onCreate(savedInstanceState)

        // Deliberately not touching bridge.webView.webChromeClient here: Capacitor's own
        // BridgeActivity already installs com.getcapacitor.BridgeWebChromeClient during
        // super.onCreate() above, which handles both <input type="file"> choosers
        // (onShowFileChooser — every tool with a file picker needs this) and the getUserMedia
        // CAMERA permission prompt (onPermissionRequest) that the live QR scanner needs.
        // Replacing it with a custom WebChromeClient here silently drops onShowFileChooser.
    }
}
