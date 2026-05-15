import { Context } from "hono";

import { getTempmailSettings } from "./settings";

/**
 * GET /public_api/v1/public/recent_messages — landing-page preview.
 *
 * Returns recent message metadata across all tempmail mailboxes (no body, no
 * recipient address, no content). Used only as a "look the service really
 * receives mail" demo on the tempmail landing page.
 *
 * Disabled by default unless `tempmail.enable_public_preview` is true.
 */
const recent = async (c: Context<HonoCustomType>) => {
    const settings = await getTempmailSettings(c);
    if (!settings.enablePublicPreview) {
        return c.json({ messages: [], enabled: false });
    }

    const limit = Math.min(settings.publicPreviewCount, 50);
    const rows = await c.env.DB.prepare(
        `SELECT r.id, r.source, r.created_at, r.metadata
         FROM raw_mails r
         INNER JOIN address a ON a.name = r.address
         WHERE a.is_tempmail = 1
         ORDER BY r.id DESC
         LIMIT ?`,
    )
        .bind(limit)
        .all<{ id: number; source: string | null; created_at: string; metadata: string | null }>();

    const items = (rows.results || []).map((row) => {
        let subject: string | null = null;
        if (row.metadata) {
            try {
                const meta = JSON.parse(row.metadata);
                if (typeof meta?.subject === "string") subject = meta.subject;
            } catch {
                // ignore unparsable metadata
            }
        }
        return {
            id: row.id,
            from: row.source ?? null,
            subject,
            timestamp: row.created_at,
        };
    });

    return c.json({ messages: items, enabled: true });
};

export default { recent };
