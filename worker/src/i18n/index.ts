import { LocaleMessages } from "./type";
import en from "./en";
import ru from "./ru";
import { Context } from "hono";

const resolve = (locale: string | null | undefined): LocaleMessages => {
    if (locale === "ru") return ru;
    // fallback / default language is always English
    return en;
}

export default {
    getMessages: (
        locale: string | null | undefined
    ): LocaleMessages => resolve(locale),
    getMessagesbyContext: (
        c: Context<HonoCustomType>
    ): LocaleMessages => {
        const locale = c?.get?.("lang") || c.env?.DEFAULT_LANG;
        return resolve(locale);
    }
}
