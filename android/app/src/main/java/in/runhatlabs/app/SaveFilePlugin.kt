package `in`.runhatlabs.app

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileInputStream

/**
 * Saves a file the web app already wrote to the app's cache directory (via @capacitor/filesystem,
 * see src/lib/download.ts) to a location the user picks, through the Storage Access Framework —
 * no storage permission needed. Falls back to the system Share sheet on the rare device where no
 * document-picker app is available.
 */
@CapacitorPlugin(name = "SaveFile")
class SaveFilePlugin : Plugin() {

    // @capacitor/filesystem's getUri() returns a "file://..." URI string, not a plain path.
    private fun toFilesystemPath(sourcePath: String): String =
        if (sourcePath.startsWith("file:")) Uri.parse(sourcePath).path ?: sourcePath else sourcePath

    @PluginMethod
    fun save(call: PluginCall) {
        val sourcePath = call.getString("sourcePath")
        val name = call.getString("name") ?: "file"
        val mimeType = call.getString("mimeType") ?: "application/octet-stream"
        if (sourcePath == null) {
            call.reject("sourcePath required")
            return
        }
        val sourceFile = File(toFilesystemPath(sourcePath))
        if (!sourceFile.exists()) {
            call.reject("Source file not found")
            return
        }

        val createIntent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mimeType
            putExtra(Intent.EXTRA_TITLE, name)
        }
        try {
            // Deliberately not pre-checking createIntent.resolveActivity() first: on Android 11+,
            // that query is itself subject to package-visibility filtering and ACTION_CREATE_DOCUMENT
            // is not on the automatic-exemption list, so it unreliably reports "no picker available"
            // even when one exists — which would silently force every save onto the share-sheet
            // fallback below. Just try to launch it and fall back only on an actual failure.
            startActivityForResult(call, createIntent, "handleSaveResult")
        } catch (_: ActivityNotFoundException) {
            shareInstead(call, sourceFile, mimeType)
        }
    }

    @ActivityCallback
    private fun handleSaveResult(call: PluginCall, result: ActivityResult) {
        val sourcePath = call.getString("sourcePath")!!
        val sourceFile = File(toFilesystemPath(sourcePath))
        try {
            if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) {
                val ret = JSObject()
                ret.put("saved", false)
                call.resolve(ret)
                return
            }
            val targetUri = result.data!!.data!!
            context.contentResolver.openOutputStream(targetUri)?.use { out ->
                FileInputStream(sourceFile).use { input ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                    }
                }
            }
            val ret = JSObject()
            ret.put("saved", true)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Could not write file: ${e.message}")
        } finally {
            sourceFile.delete()
        }
    }

    private fun shareInstead(call: PluginCall, sourceFile: File, mimeType: String) {
        try {
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", sourceFile)
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(shareIntent, null).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
            // The cache file is left for the receiving app to read via FileProvider. There is no
            // reliable "the other app finished reading it" signal here, so unlike the SAF path
            // above it is not deleted immediately — the OS reclaims app cache space as needed.
            val ret = JSObject()
            ret.put("saved", true)
            ret.put("shared", true)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("No app available to save or share this file: ${e.message}")
        }
    }
}
