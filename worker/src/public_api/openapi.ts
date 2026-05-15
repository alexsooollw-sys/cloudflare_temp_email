/**
 * Hand-rolled OpenAPI 3.1 description for /public_api/v1/*.
 *
 * We deliberately avoid pulling in @hono/zod-openapi (which would require
 * rewriting every public_api endpoint declaration). Instead, we keep the
 * schema next to the handlers and update both together.
 *
 * Served as JSON at /public_api/openapi.json and consumed by the
 * Swagger UI page at /public_api/docs.
 */

import { Context } from "hono"

import { CONSTANTS } from "../constants"

const TempmailDomain = {
    type: "object",
    required: ["id", "domain", "isActive"],
    properties: {
        id: { type: "string" },
        domain: { type: "string" },
        isActive: { type: "boolean" },
    },
} as const

const ParsedAttachment = {
    type: "object",
    required: ["filename", "mimeType", "size"],
    properties: {
        filename: { type: "string" },
        mimeType: { type: "string" },
        disposition: { type: "string", nullable: true },
        size: { type: "integer" },
    },
} as const

const ParsedMessage = {
    type: "object",
    required: ["id", "created_at", "sender", "subject", "text", "html", "attachments"],
    properties: {
        id: { type: "integer" },
        source: { type: "string", nullable: true },
        created_at: { type: "string" },
        sender: { type: "string" },
        subject: { type: "string" },
        text: { type: "string" },
        html: { type: "string" },
        attachments: { type: "array", items: ParsedAttachment },
    },
} as const

const TextResponse = {
    description: "Plaintext error message",
    content: { "text/plain": { schema: { type: "string" } } },
}

export const buildOpenApiSpec = (c: Context<HonoCustomType>) => {
    const url = new URL(c.req.raw.url)
    const baseServer = `${url.protocol}//${url.host}`

    return {
        openapi: "3.1.0",
        info: {
            title: "cloudflare_temp_email — Public API",
            version: CONSTANTS.VERSION,
            description:
                "Anonymous mailbox API used by the tempmail.* Pages site. " +
                "All endpoints under `/public_api/v1/*`. The `/me/*` family " +
                "requires `Authorization: Bearer <jwt>` returned from `/accounts` or `/token`.",
            license: { name: "MIT" },
        },
        servers: [{ url: baseServer }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
            schemas: {
                TempmailDomain,
                ParsedAttachment,
                ParsedMessage,
            },
        },
        paths: {
            "/public_api/v1/domains": {
                get: {
                    summary: "List allowed tempmail domains",
                    tags: ["public"],
                    responses: {
                        "200": {
                            description: "Allowed domains",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            domains: { type: "array", items: TempmailDomain },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            "/public_api/v1/accounts": {
                post: {
                    summary: "Create an anonymous mailbox",
                    description:
                        "Rate-limited per IP. Password must be the SHA-256 hex digest " +
                        "of the user's plaintext password — the server stores and " +
                        "compares the hash directly.",
                    tags: ["public", "accounts"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["address", "password"],
                                    properties: {
                                        address: { type: "string", example: "johndoe@example.com" },
                                        password: { type: "string", description: "SHA-256 hex of plaintext" },
                                        captcha_token: { type: "string", nullable: true },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Account created",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        required: ["id", "address", "token", "expires_at"],
                                        properties: {
                                            id: { type: "integer" },
                                            address: { type: "string" },
                                            token: { type: "string", description: "Bearer JWT" },
                                            expires_at: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                        "400": TextResponse,
                        "429": TextResponse,
                    },
                },
            },
            "/public_api/v1/token": {
                post: {
                    summary: "Login to an existing tempmail mailbox",
                    tags: ["public", "accounts"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["address", "password"],
                                    properties: {
                                        address: { type: "string" },
                                        password: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Token issued",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            token: { type: "string" },
                                            address: { type: "string" },
                                            expires_at: { type: "string", nullable: true },
                                        },
                                    },
                                },
                            },
                        },
                        "401": TextResponse,
                        "404": TextResponse,
                    },
                },
            },
            "/public_api/v1/me": {
                get: {
                    summary: "Profile of the authenticated tempmail account",
                    tags: ["accounts"],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": {
                            description: "Profile",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            id: { type: "integer" },
                                            address: { type: "string" },
                                            expires_at: { type: "string", nullable: true },
                                            created_at: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                        "401": TextResponse,
                        "404": TextResponse,
                    },
                },
                delete: {
                    summary: "Delete the authenticated mailbox and all of its data",
                    tags: ["accounts"],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": {
                            description: "Deleted",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: { success: { type: "boolean" } },
                                    },
                                },
                            },
                        },
                        "401": TextResponse,
                    },
                },
            },
            "/public_api/v1/me/messages": {
                get: {
                    summary: "List inbox messages",
                    tags: ["messages"],
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
                        { name: "limit", in: "query", required: false, schema: { type: "integer", default: 20 } },
                    ],
                    responses: {
                        "200": {
                            description: "Inbox page",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            page: { type: "integer" },
                                            limit: { type: "integer" },
                                            total: { type: "integer" },
                                            messages: { type: "array", items: ParsedMessage },
                                        },
                                    },
                                },
                            },
                        },
                        "401": TextResponse,
                    },
                },
            },
            "/public_api/v1/me/messages/{id}": {
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "integer" } },
                ],
                get: {
                    summary: "Get a single parsed message",
                    tags: ["messages"],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": {
                            description: "Parsed message",
                            content: {
                                "application/json": { schema: ParsedMessage },
                            },
                        },
                        "401": TextResponse,
                        "404": TextResponse,
                    },
                },
                delete: {
                    summary: "Delete a single message",
                    tags: ["messages"],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": {
                            description: "Deleted",
                            content: {
                                "application/json": {
                                    schema: { type: "object", properties: { success: { type: "boolean" } } },
                                },
                            },
                        },
                        "401": TextResponse,
                        "404": TextResponse,
                    },
                },
            },
            "/public_api/v1/me/messages/{id}/source": {
                parameters: [
                    { name: "id", in: "path", required: true, schema: { type: "integer" } },
                ],
                get: {
                    summary: "Raw RFC822 source of a message",
                    tags: ["messages"],
                    security: [{ bearerAuth: [] }],
                    responses: {
                        "200": {
                            description: "Raw RFC822",
                            content: { "message/rfc822": { schema: { type: "string" } } },
                        },
                        "401": TextResponse,
                        "404": TextResponse,
                    },
                },
            },
            "/public_api/v1/public/recent_messages": {
                get: {
                    summary: "Public preview of recent inbound subjects (no body, no recipient)",
                    description:
                        "Disabled when `tempmail.enable_public_preview` is false — the response " +
                        "still resolves with `enabled: false` and an empty list.",
                    tags: ["public"],
                    responses: {
                        "200": {
                            description: "Preview list",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            enabled: { type: "boolean" },
                                            messages: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "integer" },
                                                        from: { type: "string", nullable: true },
                                                        subject: { type: "string", nullable: true },
                                                        timestamp: { type: "string" },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        tags: [
            { name: "public", description: "No-auth endpoints (rate-limited)" },
            { name: "accounts", description: "Per-mailbox auth + lifecycle" },
            { name: "messages", description: "Inbox / single-message" },
        ],
    }
}

const openApiHandler = (c: Context<HonoCustomType>) => {
    return c.json(buildOpenApiSpec(c))
}

export default openApiHandler
