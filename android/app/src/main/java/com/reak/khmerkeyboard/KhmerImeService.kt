package com.reak.khmerkeyboard

import android.annotation.SuppressLint
import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.webkit.JavascriptInterface
import android.webkit.WebView

/**
 * The system keyboard. Its input view is a WebView that loads the same
 * keyboard UI we build for the web (ime.html), bundled into the app's assets.
 * When the web side commits Khmer text, we type it into whatever app is
 * focused through the current InputConnection.
 */
class KhmerImeService : InputMethodService() {

    private val main = Handler(Looper.getMainLooper())
    private var webView: WebView? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreateInputView(): View {
        val web = WebView(this)
        webView = web
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true // localStorage for custom + learned words
        web.settings.allowFileAccess = true
        web.settings.allowContentAccess = true
        @Suppress("DEPRECATION")
        web.settings.allowFileAccessFromFileURLs = true
        @Suppress("DEPRECATION")
        web.settings.allowUniversalAccessFromFileURLs = true
        web.setBackgroundColor(0xFF201D19.toInt())
        web.addJavascriptInterface(Bridge(), "AndroidIME")

        // A keyboard view has no natural height, so the WebView would collapse
        // to zero and show nothing. Give it a fixed height that matches the web
        // content (prediction bar + keyboard), close to a real phone keyboard.
        val dm = resources.displayMetrics
        val height = (300 * dm.density).toInt()
        web.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            height
        )
        web.minimumHeight = height

        web.loadUrl("file:///android_asset/keyboard/ime.html")
        return web
    }

    private fun commitText(text: String) {
        main.post { currentInputConnection?.commitText(text, 1) }
    }

    inner class Bridge {
        @JavascriptInterface
        fun commit(text: String) = commitText(text)

        @JavascriptInterface
        fun space() = commitText(" ")

        @JavascriptInterface
        fun enter() {
            main.post {
                // Most chat apps treat a newline as "send"; commit one.
                currentInputConnection?.commitText("\n", 1)
            }
        }

        @JavascriptInterface
        fun backspace() {
            main.post {
                val ic = currentInputConnection ?: return@post
                val selected = ic.getSelectedText(0)
                if (!selected.isNullOrEmpty()) ic.commitText("", 1)
                else ic.deleteSurroundingText(1, 0)
            }
        }

        @JavascriptInterface
        fun switchKeyboard() {
            main.post {
                val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
                imm.showInputMethodPicker()
            }
        }

        // The web page reports its content height (in CSS px); resize the
        // keyboard to fit it on any device.
        @JavascriptInterface
        fun resize(px: String) {
            val cssPx = px.toFloatOrNull() ?: return
            main.post {
                val wv = webView ?: return@post
                val h = (cssPx * resources.displayMetrics.density).toInt()
                if (h <= 0) return@post
                val lp = wv.layoutParams ?: ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, h
                )
                lp.height = h
                wv.layoutParams = lp
                wv.minimumHeight = h
                wv.requestLayout()
            }
        }
    }
}
