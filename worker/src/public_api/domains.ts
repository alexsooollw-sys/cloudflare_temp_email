import { Context } from "hono";
import { getTempmailSettings } from "./settings";

/**
 * GET /public_api/v1/domains
 *
 * Returns the list of domains the admin has white-listed for tempmail account
 * creation, in mail.tm-compatible shape:
 *
 *   {
 *     "domains": [
 *       { "id": "example.com", "domain": "example.com", "isActive": true }
 *     ]
 *   }
 */
const list = async (c: Context<HonoCustomType>) => {
    const settings = await getTempmailSettings(c);
    return c.json({
        domains: settings.allowedDomains.map((d) => ({
            id: d,
            domain: d,
            isActive: true,
        })),
    });
};

export default { list };
