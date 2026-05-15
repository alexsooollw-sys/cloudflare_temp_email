/**
 * SHA-256 hex digest. Identical to the existing admin frontend's
 * hashPassword() — the public_api/accounts endpoint compares against this
 * exact representation.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
