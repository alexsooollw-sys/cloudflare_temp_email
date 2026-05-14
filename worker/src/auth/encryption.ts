/**
 * AES-GCM helpers for encrypting secrets at rest.
 *
 * The encryption key is derived from `c.env.JWT_SECRET` via PBKDF2 (100k
 * iterations, SHA-256) using the first 16 bytes of SHA-256(JWT_SECRET) as the
 * salt. This ties decryption to the worker's existing secret material — no
 * extra environment variables are needed.
 *
 * Storage format: a single ArrayBuffer of `IV(12 bytes) || ciphertext`. The
 * tag is appended to the ciphertext by Web Crypto.
 *
 * All functions are 100% Web Crypto API — no Node-only imports — so they run
 * in Cloudflare Workers without polyfills.
 */

const PBKDF2_ITERATIONS = 100_000
const KEY_LENGTH_BITS = 256
const IV_LENGTH_BYTES = 12
const SALT_LENGTH_BYTES = 16

type AnyBuffer = ArrayBuffer | Uint8Array

const toUint8 = (buf: AnyBuffer): Uint8Array =>
    buf instanceof Uint8Array ? buf : new Uint8Array(buf)

const sha256 = async (input: string): Promise<Uint8Array> => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
    return new Uint8Array(digest)
}

/**
 * Derive a 256-bit AES-GCM key from a secret string.
 *
 * Salt is deterministic (derived from the secret itself) so the same secret
 * always produces the same key — required for decrypting persisted values
 * across worker restarts.
 */
export const deriveKey = async (secret: string): Promise<CryptoKey> => {
    if (!secret) throw new Error("encryption secret is required")

    const baseKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
    )

    const fullHash = await sha256(secret)
    const salt = fullHash.slice(0, SALT_LENGTH_BYTES)

    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: KEY_LENGTH_BITS },
        false,
        ["encrypt", "decrypt"],
    )
}

/**
 * Encrypt a UTF-8 string. Returns IV (12 bytes) prepended to the ciphertext
 * (which already includes the GCM auth tag). Output is suitable for storing
 * directly as a BLOB.
 */
export const encryptString = async (
    plaintext: string,
    secret: string,
): Promise<ArrayBuffer> => {
    const key = await deriveKey(secret)
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES))
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(plaintext),
    )

    const ctBytes = new Uint8Array(ciphertext)
    const out = new Uint8Array(IV_LENGTH_BYTES + ctBytes.byteLength)
    out.set(iv, 0)
    out.set(ctBytes, IV_LENGTH_BYTES)
    return out.buffer
}

/**
 * Decrypt a buffer produced by `encryptString` back to UTF-8 string.
 */
export const decryptString = async (
    ciphertext: AnyBuffer,
    secret: string,
): Promise<string> => {
    const data = toUint8(ciphertext)
    if (data.byteLength <= IV_LENGTH_BYTES) {
        throw new Error("ciphertext is too short to contain an IV")
    }

    const key = await deriveKey(secret)
    const iv = data.slice(0, IV_LENGTH_BYTES)
    const ct = data.slice(IV_LENGTH_BYTES)

    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ct,
    )
    return new TextDecoder().decode(plaintext)
}
