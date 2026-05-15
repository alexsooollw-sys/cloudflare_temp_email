import { Hono } from "hono";

import accounts from "./accounts";
import domains from "./domains";
import messages from "./messages";
import publicPreview from "./public_preview";
import docs from "./docs";
import openApi from "./openapi";

/**
 * Tempmail / public REST API mounted under /public_api/v1/*.
 *
 * Auth model:
 *   - /domains, /accounts, /token, /public/*, /docs, /openapi.json — no auth
 *   - everything else — Bearer JWT (jwtPayload populated by worker.ts middleware)
 */
export const api = new Hono<HonoCustomType>();

api.get("/public_api/v1/domains", domains.list);
api.get("/public_api/v1/public/recent_messages", publicPreview.recent);

api.post("/public_api/v1/accounts", accounts.create);
api.post("/public_api/v1/token", accounts.login);

api.get("/public_api/v1/me", accounts.me);
api.delete("/public_api/v1/me", accounts.deleteMe);

api.get("/public_api/v1/me/messages", messages.list);
api.get("/public_api/v1/me/messages/:id", messages.get);
api.get("/public_api/v1/me/messages/:id/source", messages.source);
api.delete("/public_api/v1/me/messages/:id", messages.remove);

// API docs (publicly accessible)
api.get("/public_api/openapi.json", openApi);
api.get("/public_api/docs", docs);
