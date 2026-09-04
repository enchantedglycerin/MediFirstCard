package expo.modules.lockcard

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class LockCardModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LockCard")

    // Store the payload first so the receiver can re-post it later, then post the card.
    // Returns false when notifications are not permitted (post() reports that).
    AsyncFunction("show") { opts: Map<String, Any?> ->
      val context = requireContext()
      val payload = parse(opts)
      LockCardStore.save(context, payload)
      LockCardNotifier.post(context, payload)
    }

    AsyncFunction("hide") {
      val context = requireContext()
      LockCardNotifier.cancel(context)
      LockCardStore.clear(context)
    }

    AsyncFunction("isShown") {
      LockCardNotifier.isShown(requireContext())
    }
  }

  private fun requireContext(): Context =
    appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun parse(opts: Map<String, Any?>): LockCardPayload {
    @Suppress("UNCHECKED_CAST")
    val rawLines = opts["lines"] as? List<Any?> ?: emptyList<Any?>()
    val lines = rawLines.map { it?.toString() ?: "" }
    return LockCardPayload(
      title = opts["title"]?.toString() ?: "",
      lines = lines,
      channelId = opts["channelId"]?.toString() ?: "emergency-card",
      callLabel = opts["callLabel"]?.toString() ?: "",
      callNumber = opts["callNumber"]?.toString() ?: "",
      color = opts["color"]?.toString()
    )
  }
}
