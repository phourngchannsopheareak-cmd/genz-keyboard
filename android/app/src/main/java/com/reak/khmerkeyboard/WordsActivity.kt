package com.reak.khmerkeyboard

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.WebView

/**
 * Full-screen "My Words" manager. It loads the same bundled ime.html the
 * keyboard uses, opened with #manage, so it shows and edits the exact
 * localStorage the keyboard reads (all WebViews in one app share web
 * storage). A word added here works in the keyboard immediately, and the
 * Copy All button exports everything as JSON.
 */
class WordsActivity : Activity() {

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = true
        web.settings.allowContentAccess = true
        @Suppress("DEPRECATION")
        web.settings.allowFileAccessFromFileURLs = true
        @Suppress("DEPRECATION")
        web.settings.allowUniversalAccessFromFileURLs = true
        web.loadUrl("file:///android_asset/keyboard/ime.html#manage")
        setContentView(web)
    }
}
