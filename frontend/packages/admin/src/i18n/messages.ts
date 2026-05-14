import { MESSAGE_REGISTRY, getMessageSource } from './message-registry'

import type { MessageKey, MessageNamespace } from './message-registry'

import type { SupportedLocale } from './locale-registry'

type LocaleTree = Record<string, unknown>

const setNestedValue = (target: LocaleTree, path: string, value: unknown) => {
  const segments = path.split('.')
  let current: LocaleTree = target

  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment]
    if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
      current = existing as LocaleTree
      continue
    }

    current[segment] = {}
    current = current[segment] as LocaleTree
  }

  current[segments.at(-1) as string] = value
}

const buildLocaleMessages = (locale: SupportedLocale) => {
  const messages: LocaleTree = {}

  for (const namespace of Object.keys(MESSAGE_REGISTRY) as MessageNamespace[]) {
    const keys = Object.keys(MESSAGE_REGISTRY[namespace]) as MessageKey<typeof namespace>[]
    for (const key of keys) {
      const message = getMessageSource(namespace, key, locale)
      if (message === undefined) continue
      setNestedValue(messages, `${namespace}.${key}`, message)
    }
  }

  return messages
}

export const I18N_MESSAGES: Record<SupportedLocale, LocaleTree> = {
  en: buildLocaleMessages('en'),
  ru: buildLocaleMessages('ru'),
}
