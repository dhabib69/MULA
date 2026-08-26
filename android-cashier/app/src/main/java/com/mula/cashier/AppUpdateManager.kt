package com.mula.cashier

import android.app.Activity
import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Environment
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

class AppUpdateManager(private val activity: Activity) {
    private val executor = Executors.newSingleThreadExecutor()
    private var downloadId = -1L
    private var pendingFile: File? = null
    private var pendingSha256: String? = null
    private var receiverRegistered = false

    private val downloadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
            if (intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L) != downloadId) return
            verifyAndInstall()
        }
    }

    init {
        ContextCompat.registerReceiver(activity, downloadReceiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), ContextCompat.RECEIVER_NOT_EXPORTED)
        receiverRegistered = true
    }

    fun checkForUpdate() {
        executor.execute {
            try {
                val connection = URL(UPDATE_MANIFEST_URL).openConnection() as HttpURLConnection
                connection.connectTimeout = 5000
                connection.readTimeout = 8000
                connection.requestMethod = "GET"
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                connection.disconnect()
                val json = JSONObject(body)
                val remoteCode = json.optInt("versionCode", 0)
                val remoteName = json.optString("versionName", "baru")
                val apkUrl = json.optString("apkUrl", "")
                val sha256 = json.optString("sha256", "").lowercase()
                val apkFileName = json.optString("apkFileName", "mula-cashier-v$remoteCode.apk")
                if (remoteCode <= CURRENT_VERSION_CODE || !isTrustedUrl(apkUrl) || sha256.length != 64) return@execute
                activity.runOnUiThread { showUpdateDialog(remoteCode, remoteName, apkUrl, apkFileName, sha256) }
            } catch (_: Exception) { }
        }
    }

    private fun showUpdateDialog(code: Int, name: String, apkUrl: String, fileName: String, sha256: String) {
        android.app.AlertDialog.Builder(activity)
            .setTitle("Update MULA tersedia")
            .setMessage("Versi $name tersedia. Update sekarang untuk mendapatkan fitur terbaru?")
            .setNegativeButton("Nanti", null)
            .setPositiveButton("Update sekarang") { _, _ -> downloadUpdate(code, apkUrl, fileName, sha256) }
            .show()
    }

    private fun downloadUpdate(code: Int, apkUrl: String, fileName: String, sha256: String) {
        try {
            val file = File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName)
            file.parentFile?.mkdirs()
            pendingFile = file
            pendingSha256 = sha256
            val request = DownloadManager.Request(Uri.parse(apkUrl))
                .setTitle("MULA Cashier v$code")
                .setDescription("Mengunduh update MULA")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, fileName)
            downloadId = (activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            Toast.makeText(activity, "Update sedang diunduh…", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(activity, "Update gagal dimulai: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun verifyAndInstall() {
        val file = pendingFile ?: return
        val expected = pendingSha256 ?: return
        if (!file.exists()) { Toast.makeText(activity, "File update tidak ditemukan", Toast.LENGTH_LONG).show(); return }
        executor.execute {
            try {
                if (!sha256(file).equals(expected, ignoreCase = true)) { file.delete(); throw IllegalStateException("checksum tidak cocok") }
                activity.runOnUiThread {
                    val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
                    val installIntent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/vnd.android.package-archive")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    activity.startActivity(installIntent)
                }
            } catch (e: Exception) { activity.runOnUiThread { Toast.makeText(activity, "Update ditolak: ${e.message}", Toast.LENGTH_LONG).show() } }
        }
    }

    private fun isTrustedUrl(value: String): Boolean = try {
        val uri = Uri.parse(value)
        uri.scheme == "https" && (uri.host == TRUSTED_HOST || (uri.host == DOWNLOAD_HOST && uri.path?.startsWith("/dhabib69/MULA/releases/download/") == true))
    } catch (_: Exception) { false }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(8192)
            var count: Int
            while (input.read(buffer).also { count = it } > 0) digest.update(buffer, 0, count)
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    fun close() {
        if (receiverRegistered) { activity.unregisterReceiver(downloadReceiver); receiverRegistered = false }
        executor.shutdownNow()
    }

    companion object {
        private const val CURRENT_VERSION_CODE = 6
        private const val UPDATE_MANIFEST_URL = "https://mula-eatery.web.app/downloads/version.json"
        private const val TRUSTED_HOST = "mula-eatery.web.app"
        private const val DOWNLOAD_HOST = "github.com"
    }
}