package com.tvhome.launcher

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.speech.RecognizerIntent
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Hosts the web-based home screen in a full-screen WebView and connects it to
 * Android: launching apps, speech recognition, text-to-speech, remote buttons
 * and the phone-remote server.
 */
class MainActivity : ComponentActivity() {

    lateinit var webView: WebView
        private set
    private lateinit var bridge: TvBridge
    private var server: PhoneServer? = null
    private var pageReady = false

    private val voiceLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val text = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull()
                .orEmpty()
            callJs("tvBus.onVoice(${JSONObject.quote(text)})")
        }

    // Refresh the app list when apps are installed or removed.
    private val packageReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            bridge.invalidateApps()
            callJs("tvBus.appsChanged()")
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        hideSystemBars()

        // Serve the bundled web folder from a real https origin so ES modules,
        // fetch() and localStorage all behave like a normal website.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        bridge = TvBridge(this)
        webView = WebView(this).apply {
            setBackgroundColor(0xFF0B1020.toInt())
            isFocusable = true
            isFocusableInTouchMode = true
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            addJavascriptInterface(bridge, "Android")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assetLoader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    // Keep the home screen in place; open any other link outside.
                    return request.url.host != WebViewAssetLoader.DEFAULT_DOMAIN
                }

                override fun onPageFinished(view: WebView, url: String) {
                    pageReady = true
                }
            }
        }
        setContentView(webView)
        webView.loadUrl("https://${WebViewAssetLoader.DEFAULT_DOMAIN}/assets/index.html")
        webView.requestFocus()

        // Back never leaves the launcher; it closes overlays inside the page.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                callJs("tvBus.back()")
            }
        })

        server = PhoneServer(this, bridge).also { it.start() }

        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_ADDED)
            addAction(Intent.ACTION_PACKAGE_REMOVED)
            addAction(Intent.ACTION_PACKAGE_CHANGED)
            addDataScheme("package")
        }
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(packageReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(packageReceiver, filter)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Pressing Home while we are already in front: go back to the main screen.
        callJs("tvBus.key('home')")
    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()
        if (pageReady) callJs("tvBus.onResume()")
    }

    override fun onDestroy() {
        server?.stop()
        bridge.shutdown()
        try { unregisterReceiver(packageReceiver) } catch (_: Exception) { }
        webView.destroy()
        super.onDestroy()
    }

    /** Remote buttons the WebView does not understand become page shortcuts. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val action = when (event.keyCode) {
                KeyEvent.KEYCODE_PROG_RED -> "draw"
                KeyEvent.KEYCODE_PROG_GREEN, KeyEvent.KEYCODE_SEARCH, KeyEvent.KEYCODE_VOICE_ASSIST -> "assistant"
                KeyEvent.KEYCODE_PROG_YELLOW, KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_SETTINGS -> "settings"
                KeyEvent.KEYCODE_PROG_BLUE -> "ambient"
                else -> null
            }
            if (action != null) {
                callJs("tvBus.key('$action')")
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    fun startVoice() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Ask anything")
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        try {
            voiceLauncher.launch(intent)
        } catch (e: Exception) {
            // No speech recogniser on this TV.
            callJs("tvBus.onVoice('')")
        }
    }

    /** Runs JavaScript in the page on the UI thread. */
    fun callJs(script: String) {
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript("window.tvBus && $script", null)
            }
        }
    }

    private fun hideSystemBars() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
    }
}
