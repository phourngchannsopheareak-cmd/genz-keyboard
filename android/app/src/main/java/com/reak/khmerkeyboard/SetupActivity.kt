package com.reak.khmerkeyboard

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * Simple launcher screen. It cannot enable the keyboard for the user (Android
 * requires them to do that in Settings), so it just gives two buttons that
 * jump straight to the right places, plus a box to test typing.
 */
class SetupActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val d = resources.displayMetrics.density
        val pad = (18 * d).toInt()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
            setBackgroundColor(Color.parseColor("#141312"))
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        fun text(value: String, size: Float, color: String, topPad: Int = pad / 2) {
            root.addView(TextView(this).apply {
                text = value
                textSize = size
                setTextColor(Color.parseColor(color))
                setPadding(0, topPad, 0, pad / 3)
            })
        }

        fun button(value: String, onClick: () -> Unit) {
            root.addView(Button(this).apply {
                text = value
                setOnClickListener { onClick() }
            })
        }

        text("Genz Keyboard", 24f, "#E8A93D", 0)
        text("Type Khmerlish, get Khmer. Two steps to turn it on:", 15f, "#F2EDE4")

        button("1.  Turn on the keyboard") {
            startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
        }
        button("2.  Switch to it") {
            (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager)
                .showInputMethodPicker()
        }

        text("Then tap the box below and type  jg tv pteas", 14f, "#8a8578")

        root.addView(EditText(this).apply {
            hint = "type here to test…"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            setTextColor(Color.parseColor("#F2EDE4"))
            setHintTextColor(Color.parseColor("#8a8578"))
            minLines = 3
        })

        setContentView(ScrollView(this).apply { addView(root) })
    }
}
