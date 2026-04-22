package com.ptabinternalmessagemobile

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import me.leolin.shortcutbadger.ShortcutBadger

class BadgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "BadgeModule"

    @ReactMethod
    fun setBadgeCount(count: Int) {
        try {
            if (count <= 0) {
                ShortcutBadger.removeCount(reactApplicationContext)
            } else {
                ShortcutBadger.applyCount(reactApplicationContext, count)
            }
        } catch (_: Exception) {
            // Badge not supported on this launcher — fail silently.
        }
    }
}
