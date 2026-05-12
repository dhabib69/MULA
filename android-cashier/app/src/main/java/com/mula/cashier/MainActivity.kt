package com.mula.cashier

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.mula.cashier.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private lateinit var printerBridge: PrinterBridge

    private val btPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { startKitchenAlertService() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        printerBridge = PrinterBridge(this)
        setupWebView()
        binding.toolsButton.setOnClickListener { showToolsMenu() }
        ensureBluetoothPermission()
        ensureNotificationPermission()
        startKitchenAlertService()
        refreshPrinterStatus()
        loadConfiguredUrl()
    }

    override fun onResume() {
        super.onResume()
        refreshPrinterStatus()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        binding.webView.apply {
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String?) {
                    super.onPageFinished(view, url)
                    enforceFreshWebUi(view)
                }
            }
            webChromeClient = WebChromeClient()
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            addJavascriptInterface(printerBridge, "MulaPrinter")
        }
    }

    private fun loadConfiguredUrl() {
        hardReload()
    }

    private fun hardReload() {
        binding.webView.clearCache(true)
        binding.webView.loadUrl(cacheBustedUrl())
    }

    private fun cacheBustedUrl(): String {
        val base = getPrefs().getString(PREF_URL, DEFAULT_URL) ?: DEFAULT_URL
        val separator = if (base.contains("?")) "&" else "?"
        return "${base}${separator}app_v=${APP_WEB_VERSION}&t=${System.currentTimeMillis()}"
    }

    private fun enforceFreshWebUi(view: WebView) {
        view.evaluateJavascript(
            """
            (function(){
              try{
                localStorage.setItem('mula_theme','dark');
                document.documentElement.classList.remove('light-mode');
                var b=document.getElementById('themeToggle');
                if(b)b.textContent='Light';
                if('serviceWorker' in navigator){
                  navigator.serviceWorker.getRegistrations().then(function(rs){
                    rs.forEach(function(r){ r.unregister(); });
                  });
                }
                if(window.caches){
                  caches.keys().then(function(keys){
                    keys.forEach(function(k){ caches.delete(k); });
                  });
                }
              }catch(e){}
            })();
            """.trimIndent(),
            null
        )
    }

    private fun showUrlDialog() {
        val input = EditText(this).apply {
            setText(getPrefs().getString(PREF_URL, DEFAULT_URL) ?: DEFAULT_URL)
            setSelection(text.length)
        }
        AlertDialog.Builder(this)
            .setTitle("Cashier URL")
            .setView(input)
            .setPositiveButton("Save") { _, _ ->
                val url = input.text?.toString()?.trim().orEmpty()
                if (url.isNotEmpty()) {
                    getPrefs().edit().putString(PREF_URL, url).apply()
                    hardReload()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun ensureBluetoothPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        val perms = arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN)
        val missing = perms.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        missing.forEach { btPermissionLauncher.launch(it) }
    }

    private fun ensureNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun startKitchenAlertService() {
        val intent = Intent(this, KitchenAlertService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(this, intent)
        } else {
            startService(intent)
        }
    }

    private fun refreshPrinterStatus() {
        val selected = printerBridge.getSelectedPrinter()
        binding.printerStatus.text = if (selected == null) {
            printerBridge.printerStatus()
        } else {
            selected.name
        }
    }

    private fun showToolsMenu() {
        val items = arrayOf("Ubah URL", "Reload paksa", "Pilih printer")
        AlertDialog.Builder(this)
            .setTitle("Settings")
            .setItems(items) { _, which ->
                when (which) {
                    0 -> showUrlDialog()
                    1 -> hardReload()
                    2 -> showPrinterPicker()
                }
            }
            .show()
    }

    private fun showPrinterPicker() {
        val printers = printerBridge.getPairedPrinters()
        if (printers.isEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("Printer Bluetooth")
                .setMessage("Belum ada printer yang dipair di Android. Pair RP022N dulu dari pengaturan Bluetooth.")
                .setPositiveButton("OK", null)
                .show()
            return
        }
        val labels = printers.map { "${it.name}\n${it.address}" }.toTypedArray()
        val selectedAddress = printerBridge.printerAddress()
        val checked = printers.indexOfFirst { it.address == selectedAddress }.takeIf { it >= 0 } ?: -1
        AlertDialog.Builder(this)
            .setTitle("Pilih Printer")
            .setSingleChoiceItems(labels, checked) { dialog, which ->
                printerBridge.choosePrinter(printers[which].address)
                refreshPrinterStatus()
                dialog.dismiss()
            }
            .setNeutralButton("Clear") { _, _ ->
                printerBridge.clearSelectedPrinter()
                refreshPrinterStatus()
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    private fun getPrefs() = getSharedPreferences("mula_cashier", Context.MODE_PRIVATE)

    companion object {
        private const val PREF_URL = "cashier_url"
        private const val DEFAULT_URL = "https://mula-eatery.web.app/"
        private const val APP_WEB_VERSION = 27
    }
}
