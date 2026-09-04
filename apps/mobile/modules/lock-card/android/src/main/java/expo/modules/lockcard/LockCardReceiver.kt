package expo.modules.lockcard

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Re-posts the pinned card:
 *  - on our own explicit DISMISSED action, sent from the notification's deleteIntent when the
 *    user swipes the card away while unlocked (Android 14 allows that) -> brings it back at once;
 *  - on BOOT_COMPLETED and MY_PACKAGE_REPLACED, since Android drops an app's notifications on
 *    reboot and on app update.
 *
 * Everything is wrapped in try/catch and logged, never crashing the system broadcast dispatch.
 */
class LockCardReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action
    try {
      val appContext = context.applicationContext
      val payload = LockCardStore.load(appContext) ?: return

      when (action) {
        Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> {
          // Give the system a moment after boot/replace before touching NotificationManager.
          val pending = goAsync()
          Handler(Looper.getMainLooper()).postDelayed({
            try {
              LockCardNotifier.post(appContext, payload)
            } catch (t: Throwable) {
              Log.w("LockCard", "re-post after $action failed", t)
            } finally {
              pending.finish()
            }
          }, 400)
        }
        else -> {
          // ACTION_DISMISSED (our explicit intent) or any other explicit delivery: re-post now.
          LockCardNotifier.post(appContext, payload)
        }
      }
    } catch (t: Throwable) {
      Log.w("LockCard", "receiver failed for action=$action", t)
    }
  }
}
