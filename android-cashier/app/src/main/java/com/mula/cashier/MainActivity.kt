package com.mula.cashier

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        printerBridge = PrinterBridge(this)
        setupWebView()
        binding.toolsButton.setOnClickListener { showToolsMenu() }
        ensureBluetoothPermission()
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
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            addJavascriptInterface(printerBridge, "MulaPrinter")
        }
    }

    private fun loadConfiguredUrl() {
        binding.webView.loadUrl(getPrefs().getString(PREF_URL, DEFAULT_URL) ?: DEFAULT_URL)
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
                    binding.webView.loadUrl(url)
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

    private fun refreshPrinterStatus() {
        val selected = printerBridge.getSelectedPrinter()
        binding.printerStatus.text = if (selected == null) {
            printerBridge.printerStatus()
        } else {
            selected.name
        }
    }

    private fun showToolsMenu() {
        val items = arrayOf("Ubah URL", "Reload halaman", "Pilih printer")
        AlertDialog.Builder(this)
            .setTitle("Tools")
            .setItems(items) { _, which ->
                when (which) {
                    0 -> showUrlDialog()
                    1 -> binding.webView.reload()
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
    }
}

