import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import { i18nMessages } from "@mfc/shared";
import { secure, KEYS } from "./lib/secure";

export type Lang = "th" | "en";

const device: Lang = getLocales()[0]?.languageCode === "en" ? "en" : "th";

void i18n.use(initReactI18next).init({
  resources: {
    th: { translation: i18nMessages.th },
    en: { translation: i18nMessages.en },
  },
  lng: device,
  fallbackLng: "th",
  interpolation: { escapeValue: false },
});

/** Apply the language the user picked last time (called once at startup). */
export async function loadSavedLanguage(): Promise<void> {
  const saved = await secure.get(KEYS.lang).catch(() => null);
  if (saved === "th" || saved === "en") await i18n.changeLanguage(saved);
}

export async function setLanguage(lang: Lang): Promise<void> {
  await i18n.changeLanguage(lang);
  await secure.set(KEYS.lang, lang);
}

export const currentLang = (): Lang => (i18n.language === "en" ? "en" : "th");

export default i18n;
