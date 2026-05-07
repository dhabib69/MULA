package com.mula.cashier

import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.os.Build
import android.webkit.JavascriptInterface
import android.widget.Toast
import java.io.IOException
import java.util.Base64
import java.util.UUID

class PrinterBridge(private val activity: Activity) {
    data class PrinterSummary(val name: String, val address: String)

    private val adapter: BluetoothAdapter? = BluetoothAdapter.getDefaultAdapter()
    private var socket: BluetoothSocket? = null
    private var deviceAddress: String? = null
    private var lastError: String = ""
    private val prefs = activity.getSharedPreferences("mula_cashier", Context.MODE_PRIVATE)

    init {
        deviceAddress = prefs.getString(PREF_PRINTER_ADDRESS, null)
    }

    @JavascriptInterface
    fun printBase64(base64: String): Boolean {
        return try {
            lastError = ""
            val bytes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Base64.getDecoder().decode(base64)
            } else {
                android.util.Base64.decode(base64, android.util.Base64.DEFAULT)
            }
            val socket = ensureSocket() ?: return false
            socket.outputStream.write(bytes)
            socket.outputStream.flush()
            true
        } catch (e: Exception) {
            lastError = "Print gagal: ${e.message ?: "unknown"}"
            toast(lastError)
            closeSocket()
            false
        }
    }

    @JavascriptInterface
    fun isAvailable(): Boolean = adapter != null

    @JavascriptInterface
    fun printerName(): String = getSelectedPrinter()?.name.orEmpty()

    @JavascriptInterface
    fun printerAddress(): String = getSelectedPrinter()?.address.orEmpty()

    @JavascriptInterface
    fun printerStatus(): String {
        val adapter = adapter ?: return "Bluetooth adapter tidak tersedia"
        if (!adapter.isEnabled) return "Bluetooth belum aktif"
        val selected = getSelectedPrinter()
        return when {
            selected == null -> "Printer: belum dipilih"
            socket?.isConnected == true -> "Printer: ${selected.name} terhubung"
            else -> "Printer: ${selected.name} siap"
        }
    }

    @JavascriptInterface
    fun nativeOnlyMode(): Boolean = true

    @JavascriptInterface
    fun lastError(): String = lastError

    @SuppressLint("MissingPermission")
    fun getPairedPrinters(): List<PrinterSummary> {
        val bonded = adapter?.bondedDevices ?: emptySet()
        return bonded
            .sortedWith(compareBy<BluetoothDevice> { !looksLikeReceiptPrinter(it.name) }.thenBy { it.name ?: it.address })
            .map { PrinterSummary(it.name ?: it.address, it.address) }
    }

    fun choosePrinter(address: String?): Boolean {
        val normalized = address?.trim().orEmpty()
        if (normalized.isEmpty()) return false
        deviceAddress = normalized
        prefs.edit().putString(PREF_PRINTER_ADDRESS, normalized).apply()
        closeSocket()
        return true
    }

    fun clearSelectedPrinter() {
        deviceAddress = null
        prefs.edit().remove(PREF_PRINTER_ADDRESS).apply()
        closeSocket()
    }

    fun getSelectedPrinter(): PrinterSummary? {
        val bonded = adapter?.bondedDevices ?: emptySet()
        val target = findTargetDevice(bonded) ?: return null
        return PrinterSummary(target.name ?: target.address, target.address)
    }

    @SuppressLint("MissingPermission")
    private fun ensureSocket(): BluetoothSocket? {
        val adapter = adapter ?: run {
            lastError = "Bluetooth adapter tidak tersedia"
            toast(lastError)
            return null
        }
        if (!adapter.isEnabled) {
            lastError = "Bluetooth belum aktif"
            toast(lastError)
            return null
        }
        socket?.takeIf { it.isConnected }?.let { return it }

        val target = findTargetDevice(adapter.bondedDevices) ?: run {
            lastError = "Printer belum dipilih atau belum dipair"
            toast(lastError)
            return null
        }
        deviceAddress = target.address
        prefs.edit().putString(PREF_PRINTER_ADDRESS, target.address).apply()
        val spp = UUID.fromString(SPP_UUID)
        return try {
            adapter.cancelDiscovery()
            val next = target.createRfcommSocketToServiceRecord(spp)
            next.connect()
            socket = next
            next
        } catch (e: IOException) {
            try {
                val fallback = target.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType).invoke(target, 1) as BluetoothSocket
                fallback.connect()
                socket = fallback
                fallback
            } catch (inner: Exception) {
                lastError = "Tidak bisa connect ke ${target.name ?: "printer"}"
                toast(lastError)
                closeSocket()
                null
            }
        }
    }

    private fun findTargetDevice(devices: Set<BluetoothDevice>): BluetoothDevice? {
        deviceAddress?.let { known ->
            devices.firstOrNull { it.address == known }?.let { return it }
        }
        return devices.firstOrNull { looksLikeReceiptPrinter(it.name) }
    }

    private fun looksLikeReceiptPrinter(name: String?): Boolean {
        val upper = name?.uppercase().orEmpty()
        return upper.contains("RP02") || upper.contains("RP022") || upper.contains("RPP02") || upper.contains("POS") || upper.contains("PRINTER")
    }

    private fun closeSocket() {
        try {
            socket?.close()
        } catch (_: IOException) {
        }
        socket = null
    }

    private fun toast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    companion object {
        private const val PREF_PRINTER_ADDRESS = "printer_address"
        private const val SPP_UUID = "00001101-0000-1000-8000-00805F9B34FB"
    }
}
