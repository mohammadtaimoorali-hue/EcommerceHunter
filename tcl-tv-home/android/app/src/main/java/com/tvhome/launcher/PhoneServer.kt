package com.tvhome.launcher

import android.net.Uri
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.Executors

/**
 * Tiny HTTP server for the phone remote, reachable on the home Wi-Fi only.
 *
 *   GET  /            -> remote.html (the phone UI)
 *   GET  /api/ping    -> 200 when ?pin= matches
 *   GET  /api/apps    -> installed apps (name + package)
 *   POST /api/cmd     -> JSON command with "pin", forwarded to tvBus.receive()
 */
class PhoneServer(private val activity: MainActivity, private val bridge: TvBridge) {

    private var socket: ServerSocket? = null
    private val pool = Executors.newFixedThreadPool(4)
    @Volatile private var running = false

    fun start() {
        running = true
        Thread({
            try {
                val ss = ServerSocket(PORT)
                socket = ss
                while (running) {
                    val client = ss.accept()
                    pool.execute { handle(client) }
                }
            } catch (_: Exception) {
                // Port busy or server stopped; the TV UI keeps working without it.
            }
        }, "phone-server").start()
    }

    fun stop() {
        running = false
        try { socket?.close() } catch (_: Exception) { }
        pool.shutdownNow()
    }

    private fun handle(client: Socket) {
        client.use { s ->
            try {
                s.soTimeout = 10_000
                val input = BufferedInputStream(s.getInputStream())
                val requestLine = readLine(input) ?: return
                val parts = requestLine.split(" ")
                if (parts.size < 2) return
                val method = parts[0]
                val uri = Uri.parse("http://tv" + parts[1])
                var contentLength = 0
                while (true) {
                    val line = readLine(input) ?: break
                    if (line.isEmpty()) break
                    val idx = line.indexOf(':')
                    if (idx > 0 && line.substring(0, idx).trim().equals("Content-Length", ignoreCase = true)) {
                        contentLength = line.substring(idx + 1).trim().toIntOrNull() ?: 0
                    }
                }
                if (contentLength > MAX_BODY) {
                    respond(s.getOutputStream(), 413, "text/plain", "Too large".toByteArray())
                    return
                }
                val body = ByteArray(contentLength)
                var read = 0
                while (read < contentLength) {
                    val n = input.read(body, read, contentLength - read)
                    if (n < 0) break
                    read += n
                }
                route(method, uri, String(body, 0, read, Charsets.UTF_8), s.getOutputStream())
            } catch (_: Exception) { }
        }
    }

    private fun route(method: String, uri: Uri, body: String, out: OutputStream) {
        val path = uri.path ?: "/"
        when {
            method == "GET" && (path == "/" || path == "/remote" || path == "/remote.html") -> {
                val html = activity.assets.open("remote.html").use { it.readBytes() }
                respond(out, 200, "text/html; charset=utf-8", html)
            }
            method == "GET" && path == "/api/ping" -> {
                if (uri.getQueryParameter("pin") == bridge.pin) json(out, 200, "{\"ok\":true}")
                else json(out, 403, "{\"ok\":false}")
            }
            method == "GET" && path == "/api/apps" -> {
                if (uri.getQueryParameter("pin") == bridge.pin) json(out, 200, bridge.appsForPhone())
                else json(out, 403, "[]")
            }
            method == "POST" && path == "/api/cmd" -> {
                val obj = try { JSONObject(body) } catch (_: Exception) { null }
                if (obj == null) { json(out, 400, "{\"ok\":false}"); return }
                if (obj.optString("pin") != bridge.pin) { json(out, 403, "{\"ok\":false}"); return }
                obj.remove("pin")
                // Re-serialised by org.json, so it is always a plain JSON literal.
                activity.callJs("tvBus.receive(${obj})")
                json(out, 200, "{\"ok\":true}")
            }
            else -> respond(out, 404, "text/plain", "Not found".toByteArray())
        }
    }

    private fun json(out: OutputStream, code: Int, text: String) =
        respond(out, code, "application/json; charset=utf-8", text.toByteArray(Charsets.UTF_8))

    private fun respond(out: OutputStream, code: Int, type: String, bytes: ByteArray) {
        val status = when (code) {
            200 -> "OK"; 400 -> "Bad Request"; 403 -> "Forbidden"; 404 -> "Not Found"; 413 -> "Payload Too Large"
            else -> "Error"
        }
        val head = "HTTP/1.1 $code $status\r\n" +
            "Content-Type: $type\r\n" +
            "Content-Length: ${bytes.size}\r\n" +
            "Cache-Control: no-store\r\n" +
            "Connection: close\r\n\r\n"
        out.write(head.toByteArray(Charsets.US_ASCII))
        out.write(bytes)
        out.flush()
    }

    private fun readLine(input: InputStream): String? {
        val buf = ByteArrayOutputStream()
        while (true) {
            val b = input.read()
            if (b == -1) return if (buf.size() == 0) null else buf.toString("UTF-8")
            if (b == '\n'.code) break
            if (b != '\r'.code) buf.write(b)
            if (buf.size() > 8192) return null
        }
        return buf.toString("UTF-8")
    }

    companion object {
        const val PORT = 8765
        private const val MAX_BODY = 256 * 1024
    }
}
