/**
 * Mail (mail.domain.com) — talks to the existing worker `/api/*` endpoints
 * exposed when `ENABLE_ADDRESS_PASSWORD=true`.
 *
 *   POST /api/address_login          → { jwt, address }
 *   POST /api/address_change_password (Bearer jwt)
 *   GET  /api/parsed_mails?limit=&offset=
 *   GET  /api/parsed_mail/:id
 *   DELETE /api/mails/:id
 */

import { ref, watchEffect } from 'vue'
import { useStorage } from '@vueuse/core'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export const mailToken = useStorage<string>('cte:mail:jwt', '')
export const mailAddress = useStorage<string>('cte:mail:address', '')

export const isLoggedIn = ref(!!mailToken.value)
watchEffect(() => { isLoggedIn.value = !!mailToken.value })

export type RequestOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
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
    accept: 'application/json',
    ...(opts.headers || {}),
  }
  let body: BodyInit | undefined
  if (opts.body !== undefined && opts.body !== null) {
    headers['content-type'] = headers['content-type'] || 'application/json'
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
  }
  const url = `${API_BASE}${path.startsWith('/') ? path : '/' + path}`
  if (mailToken.value && path.startsWith('/api/') && !path.startsWith('/api/address_login')) {
    headers['authorization'] = `Bearer ${mailToken.value}`
  }
  const resp = await fetch(url, { method: opts.method || 'GET', headers, body, signal: opts.signal })
  const text = await resp.text()
  if (!resp.ok) {
    if (resp.status === 401) logout()
    let msg = text || resp.statusText
    try {
      const parsed = JSON.parse(text)
      msg = parsed?.message || parsed?.error || msg
    } catch { /* keep text */ }
    throw new ApiError(resp.status, msg)
  }
  if (!text) return undefined as T
  try { return JSON.parse(text) as T } catch { return text as unknown as T }
}

export const logout = (): void => {
  mailToken.value = ''
  mailAddress.value = ''
}

// ──────────────── typed wrappers ────────────────────────────────────────────

export type LoginResponse = { jwt: string; address: string }
export type ParsedAttachment = {
  filename: string
  mimeType: string
  disposition: string | null
  size: number
}
export type ParsedMail = {
  id: number
  source?: string | null
  created_at: string
  sender: string
  subject: string
  text: string
  html: string
  attachments: ParsedAttachment[]
}
export type ListMailsResponse = { results: ParsedMail[]; count: number }

export const api = {
  login: (body: { email: string; password: string; cf_token?: string }) =>
    apiFetch<LoginResponse>('/api/address_login', { method: 'POST', body }),
  changePassword: (body: { new_password: string }) =>
    apiFetch<{ success: boolean }>('/api/address_change_password', { method: 'POST', body }),
  listMails: (limit = 20, offset = 0) =>
    apiFetch<ListMailsResponse>(`/api/parsed_mails?limit=${limit}&offset=${offset}`),
  getMail: (id: number) => apiFetch<ParsedMail>(`/api/parsed_mail/${id}`),
  deleteMail: (id: number) => apiFetch<{ success: boolean }>(`/api/mails/${id}`, { method: 'DELETE' }),
  openSettings: () => apiFetch<{ adminContact?: string; statusUrl?: string; title?: string }>(
    '/open_api/settings',
  ),
}
