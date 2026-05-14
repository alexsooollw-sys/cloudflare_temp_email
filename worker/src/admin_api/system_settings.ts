import { Context } from "hono";

import i18n from "../i18n";
import { CONSTANTS, type SystemSettingCategory } from "../constants";
import {
    deleteSystemSetting,
    getSystemSetting,
    listSystemSettings,
    saveSystemSetting,
    type SystemSettingRow,
} from "../utils";

const isCategory = (value: unknown): value is SystemSettingCategory =>
    typeof value === "string" &&
    (CONSTANTS.SYSTEM_SETTINGS_CATEGORIES as readonly string[]).includes(value);

type SettingPayload = {
    key: string;
    value: unknown;
    category: string;
    encrypted: boolean;
    has_encrypted_value: boolean;
    updated_at: string | null;
};

const buildPayload = (row: SystemSettingRow): SettingPayload => {
    const hasEncrypted = !!row.encrypted_value;
    let value: unknown = null;
    if (hasEncrypted) {
        value = "***";
    } else if (row.value !== null && row.value !== undefined) {
        try {
            value = JSON.parse(row.value);
        } catch {
            value = row.value;
        }
    }
    return {
        key: row.key,
        value,
        category: row.category ?? "general",
        encrypted: hasEncrypted,
        has_encrypted_value: hasEncrypted,
        updated_at: row.updated_at,
    };
};

const list = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    const category = c.req.query("category");
    if (category && !isCategory(category)) {
        return c.text(msgs.InvalidInputMsg, 400);
    }
    try {
        const rows = await listSystemSettings(c, category);
        return c.json({
            categories: CONSTANTS.SYSTEM_SETTINGS_CATEGORIES,
            settings: rows.map(buildPayload),
        });
    } catch (error) {
        console.error("system_settings.list failed", error);
        return c.text(msgs.OperationFailedMsg, 500);
    }
};

const save = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    let body: { key?: unknown; value?: unknown; category?: unknown; encrypted?: unknown };
    try {
        body = await c.req.json();
    } catch {
        return c.text(msgs.InvalidInputMsg, 400);
    }
    const { key, value, category, encrypted } = body;
    if (typeof key !== "string" || !key) return c.text(msgs.InvalidInputMsg, 400);
    if (!isCategory(category)) return c.text(msgs.InvalidInputMsg, 400);
    if (typeof encrypted !== "boolean") return c.text(msgs.InvalidInputMsg, 400);
    if (encrypted && value === "***") {
        // sentinel from list payload — no change requested for this secret
        return c.json({ success: true, key, unchanged: true });
    }
    try {
        await saveSystemSetting(c, key, value, { encrypted, category });
        return c.json({ success: true, key });
    } catch (error) {
        console.error("system_settings.save failed", error);
        return c.text(msgs.OperationFailedMsg, 500);
    }
};

const remove = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    const key = c.req.param("key");
    if (!key) return c.text(msgs.InvalidInputMsg, 400);
    try {
        await deleteSystemSetting(c, key);
        return c.json({ success: true });
    } catch (error) {
        console.error("system_settings.remove failed", error);
        return c.text(msgs.OperationFailedMsg, 500);
    }
};

/**
 * Test a setting before saving it. Useful for verifying tokens / webhook URLs
 * are valid without persisting an invalid value.
 *
 *   { type: 'telegram', payload: { token: '...' } } → checks bot via getMe
 *   { type: 'webhook',  payload: { url: '...', headers?: {} } } → POST {} and
 *       expects a 2xx response
 *   { type: 'secret',   payload: { key: '...' } }   → confirms decrypt works
 *       for an already-stored encrypted setting (returns first/last 3 chars only)
 */
const test = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    let body: { type?: unknown; payload?: unknown };
    try {
        body = await c.req.json();
    } catch {
        return c.text(msgs.InvalidInputMsg, 400);
    }
    const { type, payload } = body;
    if (typeof type !== "string" || !payload || typeof payload !== "object") {
        return c.text(msgs.InvalidInputMsg, 400);
    }

    try {
        if (type === "telegram") {
            const token = (payload as { token?: string }).token;
            if (!token) return c.text(msgs.InvalidInputMsg, 400);
            const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
            const json = await resp.json() as { ok?: boolean; result?: { username?: string } };
            if (!resp.ok || !json.ok) {
                return c.json({ success: false, error: "telegram getMe rejected token" }, 200);
            }
            return c.json({ success: true, bot: json.result?.username ?? null });
        }

        if (type === "webhook") {
            const { url, headers } = payload as { url?: string; headers?: Record<string, string> };
            if (!url) return c.text(msgs.InvalidInputMsg, 400);
            const resp = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json", ...(headers ?? {}) },
                body: "{}",
            });
            return c.json({ success: resp.ok, status: resp.status });
        }

        if (type === "secret") {
            const { key } = payload as { key?: string };
            if (!key) return c.text(msgs.InvalidInputMsg, 400);
            const value = await getSystemSetting<string>(c, key);
            if (value === undefined) {
                return c.json({ success: false, error: "not found" }, 200);
            }
            const str = typeof value === "string" ? value : JSON.stringify(value);
            const masked =
                str.length <= 6
                    ? "***"
                    : `${str.slice(0, 3)}...${str.slice(-3)}`;
            return c.json({ success: true, preview: masked, length: str.length });
        }

        return c.text(msgs.InvalidInputMsg, 400);
    } catch (error) {
        console.error("system_settings.test failed", error);
        return c.json({ success: false, error: (error as Error).message }, 200);
    }
};

export default { list, save, remove, test };
