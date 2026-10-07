package `in`.runhatlabs.app

import android.Manifest
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Lets go of the CAMERA permission grant as soon as the live QR scanner (src/tools/qr-tools) is
 * done with it, instead of holding it for the rest of the app's life. Android 13+ only — on older
 * OS versions there is no API for this, so the call is a no-op and the permission simply stays
 * granted until the user revokes it manually in Settings.
 */
@CapacitorPlugin(name = "PermRelease")
class PermReleasePlugin : Plugin() {
    @PluginMethod
    fun releaseCamera(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                context.revokeSelfPermissionsOnKill(listOf(Manifest.permission.CAMERA))
            } catch (_: Exception) {
                // Best-effort — not a functional break if this ever fails.
            }
        }
        call.resolve(JSObject())
    }
}
