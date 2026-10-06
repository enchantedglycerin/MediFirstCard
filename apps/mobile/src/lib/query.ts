import { AppState } from "react-native";
import { QueryClient, focusManager } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    // Fresh for 30 s. Returning to the app (focusManager below) or to a screen (useRefreshOnFocus)
    // refetches anything older than that, so counts and lists follow the server without a restart.
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
  },
});

// React Native has no window focus events; map the app's foreground/background state onto them.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => sub.remove();
});

/** Refetch the active queries behind these keys: all of them (pull-to-refresh) or only the stale ones. */
export function refreshQueries(keys: readonly string[], onlyStale = false): Promise<unknown> {
  return Promise.all(keys.map((k) => queryClient.refetchQueries({ queryKey: [k], type: "active", ...(onlyStale ? { stale: true } : {}) })));
}
