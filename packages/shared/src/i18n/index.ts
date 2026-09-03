import th from "./th.json" with { type: "json" };
import en from "./en.json" with { type: "json" };

export const i18nMessages = { th, en };
export type AppLocale = keyof typeof i18nMessages;
