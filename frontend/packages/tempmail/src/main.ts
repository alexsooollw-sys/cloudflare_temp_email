import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'

import { buildAllVuetifyThemes, DEFAULT_ACCENT, getThemeKey, DEFAULT_MODE } from '@cte/shared/theme/vuetify'

import 'vuetify/styles'
import App from './App.vue'
import Landing from './views/Landing.vue'

const vuetify = createVuetify({
  theme: {
    defaultTheme: getThemeKey(DEFAULT_MODE, DEFAULT_ACCENT),
    themes: buildAllVuetifyThemes(),
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  defaults: {
    VBtn: { rounded: 'lg', variant: 'flat' },
    VCard: { rounded: 'xl' },
    VTextField: { variant: 'outlined', density: 'comfortable' },
  },
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      title: 'Temp Mail',
      tagline: 'Free anonymous disposable email — no signup required.',
      create: 'Create',
      login: 'Login',
      comingSoon: 'The full anonymous tempmail UI ships in Stage 2.',
    },
    ru: {
      title: 'Временная почта',
      tagline: 'Бесплатная одноразовая почта без регистрации.',
      create: 'Создать',
      login: 'Войти',
      comingSoon: 'Полный интерфейс tempmail появится на Этапе 2.',
    },
  },
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Landing },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

createApp(App).use(vuetify).use(i18n).use(router).mount('#app')
