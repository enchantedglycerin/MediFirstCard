package expo.modules.lockcard

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Builds and posts the pinned emergency card.
 *
 * Android 14 note: FLAG_ONGOING_EVENT notifications became user-dismissable while the device is
 * unlocked on API 34+; they remain non-dismissable on the lock screen and are exempt from
 * "Clear all". So on Android 14 a rescuer can never remove it from the lock screen, and even
 * when the owner swipes it away while unlocked the deleteIntent fires LockCardReceiver, which
 * re-posts it immediately. FLAG_NO_CLEAR additionally keeps it out of "Clear all" on older OS.
 */
object LockCardNotifier {
  const val ID = 4471
  const val ACTION_DISMISSED = "expo.modules.lockcard.DISMISSED"
  private const val DEFAULT_COLOR = 0xFFC62828.toInt()
  private const val TAG = "LockCard"

  // areNotificationsEnabled() is checked before every notify(), but lint's flow analysis cannot
  // prove that across the helper, so suppress the POST_NOTIFICATIONS MissingPermission check.
  @SuppressLint("MissingPermission")
  fun post(context: Context, payload: LockCardPayload): Boolean {
    ensureChannel(context, payload.channelId)

    // On API 33+ this reflects the POST_NOTIFICATIONS runtime grant as well as channel/app state.
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false

    val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentPending = launchIntent?.let {
      PendingIntent.getActivity(context, 0, it, flags)
    }

    val dismissIntent = Intent(ACTION_DISMISSED).setClass(context, LockCardReceiver::class.java)
    val deletePending = PendingIntent.getBroadcast(context, 0, dismissIntent, flags)

    val callIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + payload.callNumber))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val callPending = PendingIntent.getActivity(
      context, 1, callIntent, PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(context, payload.channelId)
      .setSmallIcon(resolveSmallIcon(context))
      .setContentTitle(payload.title)
      .setContentText(payload.lines.firstOrNull())
      .setStyle(NotificationCompat.BigTextStyle().bigText(payload.lines.joinToString("\n")))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setShowWhen(false)
      .setColor(parseColor(payload.color))
      .setDeleteIntent(deletePending)
      .addAction(0, payload.callLabel, callPending)

    if (contentPending != null) builder.setContentIntent(contentPending)

    val notification = builder.build()
    // Keep the card out of "Clear all" and mark it ongoing at the platform-flag level for
    // OS versions where the builder flags alone are not enough.
    notification.flags = notification.flags or Notification.FLAG_NO_CLEAR or Notification.FLAG_ONGOING_EVENT

    return try {
      NotificationManagerCompat.from(context).notify(ID, notification)
      true
    } catch (t: Throwable) {
      Log.w(TAG, "notify failed", t)
      false
    }
  }

  fun cancel(context: Context) {
    try {
      NotificationManagerCompat.from(context).cancel(ID)
    } catch (t: Throwable) {
      Log.w(TAG, "cancel failed", t)
    }
  }

  fun isShown(context: Context): Boolean {
    return try {
      // minSdk is >= 24, so NotificationManager.activeNotifications (API 23+) is always available.
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.activeNotifications.any { it.id == ID }
    } catch (t: Throwable) {
      false
    }
  }

  private fun ensureChannel(context: Context, channelId: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    // Re-creating a channel that already exists (e.g. the expo-notifications "emergency-card"
    // channel of the same id) is a no-op, so this is safe to call every time.
    val channel = NotificationChannel(channelId, "Emergency card", NotificationManager.IMPORTANCE_HIGH).apply {
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setSound(null, null)
      enableVibration(false)
      vibrationPattern = null
      setShowBadge(false)
    }
    nm.createNotificationChannel(channel)
  }

  private fun resolveSmallIcon(context: Context): Int {
    // "notification_icon" is the drawable the expo-notifications config plugin generates from
    // app.json's expo-notifications.icon; fall back to the app launcher icon if it is absent.
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else context.applicationInfo.icon
  }

  private fun parseColor(color: String?): Int {
    if (color.isNullOrBlank()) return DEFAULT_COLOR
    return try {
      Color.parseColor(color)
    } catch (t: Throwable) {
      DEFAULT_COLOR
    }
  }
}
