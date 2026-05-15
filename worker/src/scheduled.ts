import { Context } from 'hono';
import { cleanup } from './common'
import { CONSTANTS } from './constants'
import { getJsonSetting } from './utils';
import { CleanupSettings } from './models';
import { executeCustomSqlCleanup } from './admin_api/cleanup_api';

export async function scheduled(event: ScheduledEvent, env: Bindings, ctx: any) {
    console.log("Scheduled event: ", event);
    const autoCleanupSetting = await getJsonSetting<CleanupSettings>(
        { env: env, } as Context<HonoCustomType>,
        CONSTANTS.AUTO_CLEANUP_KEY
    );
    if (!autoCleanupSetting) {
        console.log("No auto cleanup settings found, skipping cleanup.");
        return;
    }
    console.log("autoCleanupSetting:", JSON.stringify(autoCleanupSetting));
    if (autoCleanupSetting.enableMailsAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "mails",
            autoCleanupSetting.cleanMailsDays
        );
    }
    if (autoCleanupSetting.enableUnknowMailsAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "mails_unknow",
            autoCleanupSetting.cleanUnknowMailsDays
        );
    }
    if (autoCleanupSetting.enableSendBoxAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "sendbox",
            autoCleanupSetting.cleanSendBoxDays
        );
    }
    if (autoCleanupSetting.enableInactiveAddressAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "inactiveAddress",
            autoCleanupSetting.cleanInactiveAddressDays
        );
    }
    if (autoCleanupSetting.enableAddressAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "addressCreated",
            autoCleanupSetting.cleanAddressDays
        );
    }
    if (autoCleanupSetting.enableUnboundAddressAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "unboundAddress",
            autoCleanupSetting.cleanUnboundAddressDays
        );
    }
    if (autoCleanupSetting.enableEmptyAddressAutoCleanup) {
        await cleanup(
            { env: env, } as Context<HonoCustomType>,
            "emptyAddress",
            autoCleanupSetting.cleanEmptyAddressDays
        );
    }
    // Execute custom SQL cleanup tasks
    if (autoCleanupSetting.customSqlCleanupList && autoCleanupSetting.customSqlCleanupList.length > 0) {
        for (const customSql of autoCleanupSetting.customSqlCleanupList) {
            if (customSql.enabled && customSql.sql) {
                const result = await executeCustomSqlCleanup(
                    { env: env, } as Context<HonoCustomType>,
                    customSql
                );
                if (!result.success) {
                    console.error(`Custom SQL cleanup [${customSql.name}] failed: ${result.error}`);
                }
            }
        }
    }

    // Always-on: delete expired tempmail (anonymous) accounts and their data.
    // Tempmail accounts have is_tempmail=1 and tempmail_expires_at < now().
    await cleanupExpiredTempmail(env);
}

const cleanupExpiredTempmail = async (env: Bindings): Promise<void> => {
    try {
        const condition =
            `is_tempmail = 1 AND tempmail_expires_at IS NOT NULL ` +
            `AND datetime(tempmail_expires_at) < datetime('now')`;

        await env.DB.prepare(
            `DELETE FROM raw_mails WHERE address IN (SELECT name FROM address WHERE ${condition})`,
        ).run();
        await env.DB.prepare(
            `DELETE FROM sendbox WHERE address IN (SELECT name FROM address WHERE ${condition})`,
        ).run();
        await env.DB.prepare(
            `DELETE FROM auto_reply_mails WHERE address IN (SELECT name FROM address WHERE ${condition})`,
        ).run();
        await env.DB.prepare(
            `DELETE FROM address_sender WHERE address IN (SELECT name FROM address WHERE ${condition})`,
        ).run();
        await env.DB.prepare(
            `DELETE FROM users_address WHERE address_id IN (SELECT id FROM address WHERE ${condition})`,
        ).run();
        const { meta } = await env.DB.prepare(
            `DELETE FROM address WHERE ${condition}`,
        ).run();
        if (meta?.changes && meta.changes > 0) {
            console.log(`Tempmail cleanup: removed ${meta.changes} expired accounts`);
        }
    } catch (e) {
        console.error("Tempmail cleanup failed:", e);
    }
}
