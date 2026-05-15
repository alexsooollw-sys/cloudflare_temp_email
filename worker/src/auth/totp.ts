/**
 * RFC 6238 TOTP / RFC 4648 base32, implemented entirely on Web Crypto so it
 * runs unmodified in Cloudflare Workers (no Node-only deps).
 *
 * Defaults match the de-facto Google Authenticator / Authy / 1Password
 * profile: 30 s step, 6 digits, HMAC-SHA1, ±1 step accept window.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

const base32Encode = (bytes: Uint8Array): string => {
    let bits = 0
    let value = 0
    let out = ""
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i]
        bits += 8
        while (bits >= 5) {
            out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
            bits -= 5
        }
    }
    if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
    return out
}

const base32Decode = (input: string): Uint8Array => {
    const cleaned = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase()
    const bytes: number[] = []
    let bits = 0
    let value = 0
    for (let i = 0; i < cleaned.length; i++) {
        const idx = BASE32_ALPHABET.indexOf(cleaned[i])
        if (idx < 0) throw new Error(`invalid base32 character: ${cleaned[i]}`)
        value = (value << 5) | idx
        bits += 5
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff)
            bits -= 8
        }
    }
    return new Uint8Array(bytes)
}

const hexEncode = (bytes: Uint8Array): string =>
    Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")

/**
 * Generate a new random TOTP secret (160 bits, base32-encoded — the
 * RFC 4226 recommended size).
 */
export const generateTotpSecret = (): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(20))
    return base32Encode(bytes)
}

const counterToBytes = (counter: number): Uint8Array => {
    const bytes = new Uint8Array(8)
    // JS bitwise ops are 32-bit; split high/low to keep values up to 2^53.
    let hi = Math.floor(counter / 0x1_0000_0000)
    let lo = counter >>> 0
    for (let i = 7; i >= 4; i--) { bytes[i] = lo & 0xff; lo >>>= 8 }
    for (let i = 3; i >= 0; i--) { bytes[i] = hi & 0xff; hi >>>= 8 }
    return bytes
}

/**
 * Compute a TOTP code for the given UNIX timestamp (seconds).
 */
export const computeTotp = async (
    base32Secret: string,
    timestampSec: number = Math.floor(Date.now() / 1000),
    period: number = 30,
    digits: number = 6,
): Promise<string> => {
    const keyBytes = base32Decode(base32Secret)
    const counter = Math.floor(timestampSec / period)
    const counterBytes = counterToBytes(counter)
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"],
    )
    const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counterBytes))
    const offset = hmac[hmac.length - 1] & 0x0f
    const truncated =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
    const mod = 10 ** digits
    return (truncated % mod).toString().padStart(digits, "0")
}

/**
 * Verify a code against the secret with a ±1 step tolerance window
 * (default ±30 s) — the standard recommendation for clock-drifty mobile
 * authenticators.
 */
export const verifyTotp = async (
    base32Secret: string,
    code: string,
    {
        period = 30,
        digits = 6,
        window = 1,
        timestampSec = Math.floor(Date.now() / 1000),
    }: { period?: number; digits?: number; window?: number; timestampSec?: number } = {},
): Promise<boolean> => {
    if (!/^\d+$/.test(code) || code.length !== digits) return false
    for (let offset = -window; offset <= window; offset++) {
        const expected = await computeTotp(base32Secret, timestampSec + offset * period, period, digits)
        if (expected === code) return true
    }
    return false
}

/**
 * Build an `otpauth://` URL suitable for QR-code rendering by an
 * authenticator app. `issuer` is shown as the account label; `account`
 * is e.g. the admin username.
 */
export const buildOtpAuthUrl = ({
    issuer,
    account,
    secret,
    period = 30,
    digits = 6,
    algorithm = "SHA1",
}: {
    issuer: string
    account: string
    secret: string
    period?: number
    digits?: number
    algorithm?: "SHA1" | "SHA256" | "SHA512"
}): string => {
    const label = encodeURIComponent(`${issuer}:${account}`)
    const params = new URLSearchParams({
        secret,
        issuer,
        algorithm,
        digits: digits.toString(),
        period: period.toString(),
    })
    return `otpauth://totp/${label}?${params.toString()}`
}

// Exported only for tests.
export const _internal = { base32Encode, base32Decode, hexEncode }
