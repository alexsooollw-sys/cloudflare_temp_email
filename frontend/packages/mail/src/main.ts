import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'

import {
  buildAllVuetifyThemes,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  getThemeKey,
} from '@cte/shared/theme/vuetify'

import 'vuetify/styles'
import App from './App.vue'
import Login from './views/Login.vue'
import Mailbox from './views/Mailbox.vue'
import { messages } from './i18n'

const vuetify = createVuetify({
  theme: {
    defaultTheme: getThemeKey(DEFAULT_MODE, DEFAULT_ACCENT),
    themes: buildAllVuetifyThemes(),
  },
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  defaults: {
    VBtn: { rounded: 'lg', variant: 'flat' },
    VCard: { rounded: 'xl' },
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
  },
})

const browserLocale = (typeof navigator !== 'undefined' && navigator.language?.startsWith('ru')) ? 'ru' : 'en'
const storedLocale = (typeof localStorage !== 'undefined' && localStorage.getItem('cte:mail:locale')) || ''
const initialLocale = (storedLocale === 'ru' || storedLocale === 'en') ? storedLocale : browserLocale

const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages,
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Login },
    { path: '/inbox', component: Mailbox },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

createApp(App).use(vuetify).use(i18n).use(router).mount('#app')
