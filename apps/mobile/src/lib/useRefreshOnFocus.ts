import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { refreshQueries } from "./query";

/**
 * Refetch this screen's stale queries whenever it comes back into view (tab switch, return from a
 * pushed screen). The first focus is skipped because mounting already fetched.
 */
export function useRefreshOnFocus(keys: readonly string[]): void {
  const first = useRef(true);
  const joined = keys.join("\u0000");
  useFocusEffect(
    useCallback(() => {
      if (first.current) { first.current = false; return; }
      void refreshQueries(joined.split("\u0000"), true);
    }, [joined]),
  );
}
