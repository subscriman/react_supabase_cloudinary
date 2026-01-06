package com.subscri.manager

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import timber.log.Timber

class TimberModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "TimberModule"
    }

    @ReactMethod
    fun d(tag: String, message: String) {
        Timber.tag(tag).d(message)
    }

    @ReactMethod
    fun i(tag: String, message: String) {
        Timber.tag(tag).i(message)
    }

    @ReactMethod
    fun w(tag: String, message: String) {
        Timber.tag(tag).w(message)
    }

    @ReactMethod
    fun e(tag: String, message: String) {
        Timber.tag(tag).e(message)
    }

    @ReactMethod
    fun v(tag: String, message: String) {
        Timber.tag(tag).v(message)
    }
}