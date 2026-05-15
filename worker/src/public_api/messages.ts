import { Context } from "hono";

import i18n from "../i18n";
import { commonParseMail } from "../common";
import { resolveRawEmailRow } from "../gzip";
import { requireTempmailAddress } from "./accounts";

const handleError = (
    c: Context<HonoCustomType>,
    e: unknown,
): Response => {
    const err = e as Error & { status?: number };
    return c.text(err.message || "error", (err.status || 500) as 400 | 401 | 404 | 410 | 500);
};

const toParsedRow = async (row: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const raw = typeof row.raw === "string" ? row.raw : "";
    const parsed = raw ? await commonParseMail({ rawEmail: raw }) : undefined;
    const { raw: _raw, ...rest } = row;
    return {
        ...rest,
        sender: parsed?.sender?.trim() ?? "",
        subject: parsed?.subject ?? "",
        text: parsed?.text ?? "",
        html: parsed?.html ?? "",
        attachments: (parsed?.attachments ?? []).map((a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            disposition: a.disposition,
            size: a.content?.length ?? 0,
        })),
    };
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);

/**
 * GET /public_api/v1/me/messages?page=1&limit=20
 */
const list = async (c: Context<HonoCustomType>) => {
    try {
        const addr = await requireTempmailAddress(c);
        const limit = clamp(parseInt(c.req.query("limit") || "20"), 1, 100);
        const page = Math.max(parseInt(c.req.query("page") || "1"), 1);
        const offset = (page - 1) * limit;

        const [countResult, rowsResult] = await Promise.all([
            c.env.DB.prepare(`SELECT count(*) as count FROM raw_mails WHERE address = ?`)
                .bind(addr.name)
                .first<{ count: number }>(),
            c.env.DB.prepare(
                `SELECT * FROM raw_mails WHERE address = ?
                 ORDER BY id DESC LIMIT ? OFFSET ?`,
            )
                .bind(addr.name, limit, offset)
                .all<Record<string, unknown>>(),
        ]);

        const count = countResult?.count ?? 0;
        const rows = (rowsResult.results || []) as Record<string, unknown>[];
        const resolved = await Promise.all(rows.map(resolveRawEmailRow));
        const parsed = await Promise.all(resolved.map(toParsedRow));
        return c.json({
            page,
            limit,
            total: count,
            messages: parsed,
        });
    } catch (e) {
        return handleError(c, e);
    }
};

/**
 * GET /public_api/v1/me/messages/:id — parsed.
 */
const get = async (c: Context<HonoCustomType>) => {
    try {
        const addr = await requireTempmailAddress(c);
        const id = c.req.param("id");
        const row = await c.env.DB.prepare(
            `SELECT * FROM raw_mails WHERE id = ? AND address = ?`,
        )
            .bind(id, addr.name)
            .first();
        if (!row) {
            const msgs = i18n.getMessagesbyContext(c);
            return c.text(msgs.AddressNotFoundMsg, 404);
        }
        const resolved = await resolveRawEmailRow(row);
        return c.json(await toParsedRow(resolved as Record<string, unknown>));
    } catch (e) {
        return handleError(c, e);
    }
};

/**
 * GET /public_api/v1/me/messages/:id/source — raw RFC822.
 */
const source = async (c: Context<HonoCustomType>) => {
    try {
        const addr = await requireTempmailAddress(c);
        const id = c.req.param("id");
        const row = await c.env.DB.prepare(
            `SELECT * FROM raw_mails WHERE id = ? AND address = ?`,
        )
            .bind(id, addr.name)
            .first();
        if (!row) {
            const msgs = i18n.getMessagesbyContext(c);
            return c.text(msgs.AddressNotFoundMsg, 404);
        }
        const resolved = await resolveRawEmailRow(row) as Record<string, unknown>;
        const raw = typeof resolved.raw === "string" ? resolved.raw : "";
        return new Response(raw, {
            status: 200,
            headers: { "content-type": "message/rfc822; charset=utf-8" },
        });
    } catch (e) {
        return handleError(c, e);
    }
};

/**
 * DELETE /public_api/v1/me/messages/:id
 */
const remove = async (c: Context<HonoCustomType>) => {
    try {
        const addr = await requireTempmailAddress(c);
        const id = c.req.param("id");
        const { success } = await c.env.DB.prepare(
            `DELETE FROM raw_mails WHERE id = ? AND address = ?`,
        )
            .bind(id, addr.name)
            .run();
        return c.json({ success });
    } catch (e) {
        return handleError(c, e);
    }
};

export default { list, get, source, remove };
