/**
 * Tiny fetch wrapper around the worker's /public_api/v1/* endpoints.
 *
 * - Reads VITE_API_BASE; falls back to same-origin (Pages middleware proxies).
 * - Automatically attaches Bearer token from the store when present.
 * - Throws Error(text) on non-2xx so call sites can `catch (e) { message.error(e.message) }`.
 */

import { ref } from 'vue'
import { useStorage } from '@vueuse/core'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export const tempmailToken = useStorage<string>('cte:tempmail:token', '')
export const tempmailAddress = useStorage<string>('cte:tempmail:address', '')
export const tempmailExpiresAt = useStorage<string>('cte:tempmail:expires_at', '')

const buildUrl = (path: string): string => {
  if (!path.startsWith('/')) path = '/' + path
  return `${API_BASE}${path}`
}

export type RequestOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  authenticated?: boolean
  signal?: AbortSignal
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export const apiFetch = async <T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> => {
  const headers: Record<string, string> = {
    'accept': 'application/json',
    ...(opts.headers || {}),
  }
  let body: BodyInit | undefined
  if (opts.body !== undefined && opts.body !== null) {
    headers['content-type'] = headers['content-type'] || 'application/json'
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
  }
  const wantAuth = opts.authenticated !== false && path.includes('/me')
  if (wantAuth && tempmailToken.value) {
    headers['authorization'] = `Bearer ${tempmailToken.value}`
  }

  const resp = await fetch(buildUrl(path), {
    method: opts.method || 'GET',
    headers,
    body,
    signal: opts.signal,
  })
  const text = await resp.text()
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 410) {
      logout()
    }
    let message = text || resp.statusText
    try {
      const parsed = JSON.parse(text)
      if (parsed?.message) message = parsed.message
      else if (parsed?.error) message = parsed.error
    } catch { /* keep text as-is */ }
    throw new ApiError(resp.status, message)
  }
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

export const logout = (): void => {
  tempmailToken.value = ''
  tempmailAddress.value = ''
  tempmailExpiresAt.value = ''
}

export const isLoggedIn = ref(!!tempmailToken.value)

// keep the reactive `isLoggedIn` ref in sync with storage
import { watchEffect } from 'vue'
watchEffect(() => { isLoggedIn.value = !!tempmailToken.value })

// ──────────────── typed endpoint wrappers ───────────────────────────────────

export type Domain = { id: string; domain: string; isActive: boolean }
export type CreateResponse = { id: number; address: string; token: string; expires_at: string }
export type LoginResponse = { token: string; address: string; expires_at: string | null }
export type MeResponse = { id: number; address: string; expires_at: string | null; created_at: string }
export type ParsedAttachment = {
  filename: string
  mimeType: string
  disposition: string | null
  size: number
}
export type ParsedMessage = {
  id: number
  source?: string | null
  created_at: string
  sender: string
  subject: string
  text: string
  html: string
  attachments: ParsedAttachment[]
}
export type ListMessagesResponse = {
  page: number
  limit: number
  total: number
  messages: ParsedMessage[]
}
export type PublicPreview = {
  enabled: boolean
  messages: Array<{ id: number; from: string | null; subject: string | null; timestamp: string }>
}

export const api = {
  domains: () => apiFetch<{ domains: Domain[] }>('/public_api/v1/domains'),
  create: (body: { address: string; password: string; captcha_token?: string }) =>
    apiFetch<CreateResponse>('/public_api/v1/accounts', { method: 'POST', body }),
  login: (body: { address: string; password: string }) =>
    apiFetch<LoginResponse>('/public_api/v1/token', { method: 'POST', body }),
  me: () => apiFetch<MeResponse>('/public_api/v1/me'),
  deleteMe: () => apiFetch<{ success: boolean }>('/public_api/v1/me', { method: 'DELETE' }),
  listMessages: (page: number, limit: number) =>
    apiFetch<ListMessagesResponse>(`/public_api/v1/me/messages?page=${page}&limit=${limit}`),
  getMessage: (id: number) => apiFetch<ParsedMessage>(`/public_api/v1/me/messages/${id}`),
  deleteMessage: (id: number) =>
    apiFetch<{ success: boolean }>(`/public_api/v1/me/messages/${id}`, { method: 'DELETE' }),
  recentPreview: () =>
    apiFetch<PublicPreview>('/public_api/v1/public/recent_messages', { authenticated: false }),
}
