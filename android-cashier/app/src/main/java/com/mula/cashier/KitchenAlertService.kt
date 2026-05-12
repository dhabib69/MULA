package com.mula.cashier

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener

class KitchenAlertService : Service() {
    private var listener: ValueEventListener? = null
    private val seen = mutableSetOf<String>()
    private var baselineReady = false

    override fun onCreate() {
        super.onCreate()
        createChannels()
        restoreSeen()
        startForeground(ONGOING_ID, ongoingNotification())
        initFirebase()
    }

    override fun onDestroy() {
        listener?.let {
            FirebaseDatabase.getInstance(DATABASE_URL).getReference("tableOrders").removeEventListener(it)
        }
        persistSeen()
        super.onDestroy()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onBind(intent: Intent?): IBinder? = null

    private fun initFirebase() {
        if (FirebaseApp.getApps(this).isEmpty()) {
            val opts = FirebaseOptions.Builder()
                .setApiKey(API_KEY)
                .setApplicationId(APP_ID)
                .setProjectId(PROJECT_ID)
                .setDatabaseUrl(DATABASE_URL)
                .build()
            FirebaseApp.initializeApp(this, opts)
        }
        val auth = FirebaseAuth.getInstance()
        if (auth.currentUser != null) {
            startListening()
        } else {
            auth.signInAnonymously().addOnCompleteListener { startListening() }
        }
    }

    private fun startListening() {
        val ref = FirebaseDatabase.getInstance(DATABASE_URL).getReference("tableOrders")
        listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val activeNow = mutableListOf<Triple<String, String, Long>>()
                for (order in snapshot.children) {
                    val status = order.child("status").getValue(String::class.java) ?: continue
                    if (status != "active") continue
                    val tid = order.key ?: continue
                    val stamp = order.child("kitchenQueuedAt").getValue(Long::class.java)
                        ?: order.child("paidAt").getValue(Long::class.java)
                        ?: order.child("createdAt").getValue(Long::class.java)
                        ?: 0L
                    val key = "$tid:$stamp"
                    val label = order.child("tableLabel").getValue(String::class.java) ?: tid
                    val total = order.child("total").getValue(Long::class.java) ?: 0L
                    activeNow.add(Triple(key, label, total))
                }
                if (!baselineReady) {
                    activeNow.forEach { seen.add(it.first) }
                    baselineReady = true
                    persistSeen()
                    return
                }
                for ((key, label, total) in activeNow) {
                    if (!seen.add(key)) continue
                    showKitchenNotification(key, label, total)
                }
                persistSeen()
            }

            override fun onCancelled(error: DatabaseError) {}
        }
        ref.addValueEventListener(listener as ValueEventListener)
    }

    private fun showKitchenNotification(orderId: String, label: String, total: Long) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            this,
            100 + orderId.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, ALERT_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Order baru masuk dapur")
            .setContentText("$label - Rp ${String.format("%,d", total).replace(',', '.')}")
            .setStyle(NotificationCompat.BigTextStyle().bigText("$label butuh dimasak. Buka MULA lalu tap Selesai saat masakan selesai."))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setDefaults(NotificationCompat.DEFAULT_SOUND or NotificationCompat.DEFAULT_VIBRATE)
            .build()
        NotificationManagerCompat.from(this).notify(orderId.hashCode(), notification)
    }

    private fun ongoingNotification() =
        NotificationCompat.Builder(this, SERVICE_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("MULA Dapur aktif")
            .setContentText("Notifikasi order dapur berjalan di background.")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val sound = Settings.System.DEFAULT_NOTIFICATION_URI ?: Uri.EMPTY
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val alert = NotificationChannel(ALERT_CHANNEL, "MULA Dapur Order", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Suara untuk order baru yang masuk ke dapur"
            enableVibration(true)
            setSound(sound, attrs)
        }
        val service = NotificationChannel(SERVICE_CHANNEL, "MULA Dapur Service", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Status background listener dapur"
            setSound(null, null)
        }
        manager.createNotificationChannel(alert)
        manager.createNotificationChannel(service)
    }

    private fun restoreSeen() {
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getStringSet(KEY_SEEN, emptySet()) ?: emptySet()
        seen.clear()
        seen.addAll(raw)
        baselineReady = prefs.getBoolean(KEY_BASELINE_READY, false)
    }

    private fun persistSeen() {
        val compact = seen.toList().takeLast(300).toSet()
        seen.clear()
        seen.addAll(compact)
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet(KEY_SEEN, compact).putBoolean(KEY_BASELINE_READY, baselineReady).apply()
    }

    companion object {
        private const val DATABASE_URL = "https://mula-eatery-default-rtdb.asia-southeast1.firebasedatabase.app"
        private const val PROJECT_ID = "mula-eatery"
        private const val API_KEY = "AIzaSyDUVQT1Y1YZAmFLTr6NQNFkLvXyjbgbBr0"
        private const val APP_ID = "1:000000000000:android:mula_cashier"
        private const val ALERT_CHANNEL = "mula_kitchen_alerts"
        private const val SERVICE_CHANNEL = "mula_kitchen_service"
        private const val ONGOING_ID = 2201
        private const val PREFS = "mula_kitchen_alerts"
        private const val KEY_SEEN = "seen_orders"
        private const val KEY_BASELINE_READY = "baseline_ready"
    }
}
