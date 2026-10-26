package com.tvhome.launcher

import android.app.SearchManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.util.Base64
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Locale
import kotlin.random.Random

/** Methods the web page can call as window.Android.* */
class TvBridge(private val activity: MainActivity) {

    private val pm: PackageManager = activity.packageManager
    private val prefs = activity.getSharedPreferences("tvhome", Context.MODE_PRIVATE)
    @Volatile private var appsJson: String? = null
    @Volatile private var appsLite: String = "[]"
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    init {
        tts = TextToSpeech(activity) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) tts?.language = Locale.getDefault()
        }
    }

    /** PIN the phone remote must send. Created once and kept. */
    val pin: String
        get() {
            var p = prefs.getString("pin", null)
            if (p == null) {
                p = String.format(Locale.US, "%04d", Random.nextInt(0, 10000))
                prefs.edit().putString("pin", p).apply()
            }
            return p
        }

    fun invalidateApps() {
        appsJson = null
    }

    /** Lightweight list (no icons) for the phone remote. */
    fun appsForPhone(): String {
        if (appsJson == null) getApps()
        return appsLite
    }

    @JavascriptInterface
    fun getApps(): String {
        appsJson?.let { return it }
        val seen = LinkedHashMap<String, ResolveInfo>()
        val tvIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER)
        val phoneIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        for (intent in listOf(tvIntent, phoneIntent)) {
            for (ri in pm.queryIntentActivities(intent, 0)) {
                val pkg = ri.activityInfo.packageName
                if (pkg == activity.packageName || seen.containsKey(pkg)) continue
                seen[pkg] = ri
            }
        }
        val full = JSONArray()
        val lite = JSONArray()
        for ((pkg, ri) in seen) {
            val label = ri.loadLabel(pm)?.toString() ?: pkg
            val obj = JSONObject().put("pkg", pkg).put("label", label)
            lite.put(JSONObject().put("pkg", pkg).put("label", label))
            try {
                val banner = ri.activityInfo.loadBanner(pm) ?: pm.getApplicationBanner(pkg)
                if (banner != null) obj.put("banner", toDataUrl(banner, 320, 180))
                else obj.put("icon", toDataUrl(ri.loadIcon(pm), 128, 128))
            } catch (_: Exception) { }
            full.put(obj)
        }
        appsLite = lite.toString()
        val json = full.toString()
        appsJson = json
        return json
    }

    @JavascriptInterface
    fun launchApp(pkg: String): Boolean {
        val intent = pm.getLeanbackLaunchIntentForPackage(pkg)
            ?: pm.getLaunchIntentForPackage(pkg)
            ?: if (pkg == "com.android.tv.settings") Intent(Settings.ACTION_SETTINGS) else null
        return start(intent)
    }

    @JavascriptInterface
    fun youtubeSearch(query: String): Boolean {
        val pkg = "com.google.android.youtube.tv"
        val search = Intent(Intent.ACTION_SEARCH).setPackage(pkg).putExtra(SearchManager.QUERY, query)
        if (search.resolveActivity(pm) != null) return start(search)
        val view = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(query)))
        view.setPackage(pkg)
        if (view.resolveActivity(pm) != null) return start(view)
        return false
    }

    @JavascriptInterface
    fun openUrl(url: String, pkg: String): Boolean {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        if (pkg.isNotEmpty()) intent.setPackage(pkg)
        if (intent.resolveActivity(pm) == null) intent.setPackage(null)
        return start(intent)
    }

    @JavascriptInterface
    fun openSystemSettings() {
        start(Intent(Settings.ACTION_SETTINGS))
    }

    @JavascriptInterface
    fun startVoice() {
        activity.runOnUiThread { activity.startVoice() }
    }

    @JavascriptInterface
    fun speak(text: String) {
        if (ttsReady) tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "tvhome")
    }

    @JavascriptInterface
    fun stopSpeaking() {
        tts?.stop()
    }

    @JavascriptInterface
    fun getPhoneInfo(): String =
        JSONObject()
            .put("ip", localIp() ?: "your-tv-ip")
            .put("port", PhoneServer.PORT)
            .put("pin", pin)
            .toString()

    fun shutdown() {
        tts?.shutdown()
    }

    private fun start(intent: Intent?): Boolean {
        if (intent == null) return false
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            activity.runOnUiThread {
                try { activity.startActivity(intent) } catch (_: Exception) { }
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun toDataUrl(d: Drawable, w: Int, h: Int): String {
        val bmp = if (d is BitmapDrawable && d.bitmap != null) {
            Bitmap.createScaledBitmap(d.bitmap, w, h, true)
        } else {
            val b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val c = Canvas(b)
            d.setBounds(0, 0, w, h)
            d.draw(c)
            b
        }
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
        return "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    companion object {
        fun localIp(): String? {
            try {
                for (nif in NetworkInterface.getNetworkInterfaces()) {
                    if (!nif.isUp || nif.isLoopback) continue
                    for (addr in nif.inetAddresses) {
                        if (addr is Inet4Address && addr.isSiteLocalAddress) return addr.hostAddress
                    }
                }
            } catch (_: Exception) { }
            return null
        }
    }
}
