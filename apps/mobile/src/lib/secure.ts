import * as SecureStore from "expo-secure-store";

// Small typed wrapper over expo-secure-store (values must stay under ~2 KB).
export const secure = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  del: (key: string) => SecureStore.deleteItemAsync(key),
};

export const KEYS = {
  accessToken: "mfc.accessToken",
  refreshToken: "mfc.refreshToken",
  apiBaseUrl: "mfc.apiBaseUrl",
  email: "mfc.email",
  pinHash: "mfc.pinHash",
  pinSalt: "mfc.pinSalt",
  lang: "mfc.lang",
  lockCard: "mfc.lockCard",
  permsAsked: "mfc.permsAsked",
} as const;
