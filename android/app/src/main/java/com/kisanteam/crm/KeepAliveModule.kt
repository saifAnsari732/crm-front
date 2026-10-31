package com.kisanteam.crm

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class KeepAliveModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private var wakeLock: PowerManager.WakeLock? = null

  override fun getName(): String {
    return "KeepAliveModule"
  }

  @ReactMethod
  fun startKeepAlive(promise: Promise? = null) {
    try {
      if (wakeLock == null) {
        val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
        wakeLock = powerManager?.newWakeLock(
          PowerManager.PARTIAL_WAKE_LOCK,
          "KisanTeam:DutyActiveWakeLock"
        )?.apply {
          setReferenceCounted(false)
        }
      }
      if (wakeLock?.isHeld != true) {
        // Hold WakeLock for up to 24 hours (cleared upon punch out)
        wakeLock?.acquire(24 * 60 * 60 * 1000L)
        Log.d("KeepAliveModule", "🛡️ CPU Partial WakeLock acquired successfully! Screen-off tracking protected.")
      }
      promise?.resolve(true)
    } catch (e: Exception) {
      Log.e("KeepAliveModule", "Failed to acquire wake lock: ${e.message}")
      promise?.resolve(false)
    }
  }

  @ReactMethod
  fun stopKeepAlive(promise: Promise? = null) {
    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
        Log.d("KeepAliveModule", "🛑 CPU Partial WakeLock released.")
      }
      promise?.resolve(true)
    } catch (e: Exception) {
      Log.e("KeepAliveModule", "Failed to release wake lock: ${e.message}")
      promise?.resolve(false)
    }
  }

  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val isIgnoring = powerManager?.isIgnoringBatteryOptimizations(reactApplicationContext.packageName) ?: false
        promise.resolve(isIgnoring)
      } else {
        promise.resolve(true)
      }
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun requestIgnoreBatteryOptimizations(promise: Promise? = null) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val isIgnoring = powerManager?.isIgnoringBatteryOptimizations(reactApplicationContext.packageName) ?: false
        if (!isIgnoring) {
          val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:${reactApplicationContext.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
          }
          reactApplicationContext.startActivity(intent)
          promise?.resolve(true)
          return
        }
      }
      promise?.resolve(true)
    } catch (e: Exception) {
      Log.e("KeepAliveModule", "Failed to request battery exemption: ${e.message}")
      // Fallback to opening battery optimization settings
      try {
        val fallbackIntent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactApplicationContext.startActivity(fallbackIntent)
        promise?.resolve(true)
      } catch (fErr: Exception) {
        promise?.resolve(false)
      }
    }
  }
}
