package expo.modules.lockcard

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** The card contents last requested from JS. Kept so the receiver can re-post the exact card. */
data class LockCardPayload(
  val title: String,
  val lines: List<String>,
  val channelId: String,
  val callLabel: String,
  val callNumber: String,
  val color: String?
)

/**
 * Persists the last card payload as JSON in SharedPreferences "mfc_lock_card" so the
 * LockCardReceiver can re-post it after a swipe-away, reboot, or app update. Cleared on hide().
 */
object LockCardStore {
  private const val PREFS = "mfc_lock_card"
  private const val KEY = "payload"

  fun save(context: Context, payload: LockCardPayload) {
    val json = JSONObject().apply {
      put("title", payload.title)
      put("lines", JSONArray(payload.lines))
      put("channelId", payload.channelId)
      put("callLabel", payload.callLabel)
      put("callNumber", payload.callNumber)
      put("color", payload.color ?: JSONObject.NULL)
    }
    prefs(context).edit().putString(KEY, json.toString()).apply()
  }

  fun load(context: Context): LockCardPayload? {
    val raw = prefs(context).getString(KEY, null) ?: return null
    return try {
      val o = JSONObject(raw)
      val arr = o.optJSONArray("lines") ?: JSONArray()
      val lines = ArrayList<String>(arr.length())
      for (i in 0 until arr.length()) lines.add(arr.optString(i))
      LockCardPayload(
        title = o.optString("title"),
        lines = lines,
        channelId = o.optString("channelId"),
        callLabel = o.optString("callLabel"),
        callNumber = o.optString("callNumber"),
        color = if (o.isNull("color")) null else o.optString("color", null)
      )
    } catch (t: Throwable) {
      null
    }
  }

  fun clear(context: Context) {
    prefs(context).edit().remove(KEY).apply()
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
