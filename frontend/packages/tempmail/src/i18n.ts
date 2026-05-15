/**
 * Local i18n catalog for the tempmail Pages site.
 *
 * Tempmail is intentionally self-contained — it does not depend on the admin
 * `MESSAGE_REGISTRY`. Two locales only: en (default) and ru.
 */

export const messages = {
  en: {
    hero: {
      title: 'Temp Mail',
      tagline: 'Free anonymous disposable email — no signup, no tracking.',
    },
    actions: {
      create: 'Create',
      login: 'Login',
      cancel: 'Cancel',
    },
    features: {
      secure: {
        title: 'Secure',
        text: 'Mailboxes are protected by a password generated in your browser and never leave your device unhashed.',
      },
      instant: {
        title: 'Instant',
        text: 'A new mailbox is ready in a single click — no captchas to solve, no email confirmation loops.',
      },
      fast: {
        title: 'Fast',
        text: 'Delivered directly through Cloudflare\'s edge network for sub-second message arrival.',
      },
    },
    preview: {
      title: 'Recently received',
      noSubject: '(no subject)',
    },
    create: {
      title: 'Create an account',
      subtitle: 'Pick a username and domain, then a strong password.',
      username: 'Username',
      usernamePlaceholder: 'johndoe',
      domain: 'Domain',
      password: 'Password',
      noDomains: 'No tempmail domains configured by the administrator.',
      random: 'Random',
      cta: 'Create',
    },
    login: {
      title: 'Log in to your account',
      subtitle: 'Use the email + password you set when creating the account.',
      email: 'Email',
      password: 'Password',
      cta: 'Login',
    },
    inbox: {
      title: 'Inbox',
      noSubject: '(no subject)',
      empty: 'No emails yet',
      emptyHint: 'New emails will appear here automatically.',
      from: 'From',
      date: 'Date',
      attachments: 'Attachments',
      selectMessage: 'Select a message',
      refresh: 'Refresh',
      autoRefresh: 'Auto-refresh',
      logout: 'Log out',
      deleteAccount: 'Delete account',
      deleteAccountTitle: 'Delete this account?',
      deleteAccountConfirm: 'This will permanently remove the mailbox and all messages. This action cannot be undone.',
      expiresAt: 'Expires {time}',
    },
    errors: {
      required: 'Please fill in all required fields',
    },
  },
  ru: {
    hero: {
      title: 'Временная почта',
      tagline: 'Бесплатная одноразовая почта — без регистрации и отслеживания.',
    },
    actions: {
      create: 'Создать',
      login: 'Войти',
      cancel: 'Отмена',
    },
    features: {
      secure: {
        title: 'Безопасно',
        text: 'Почтовый ящик защищён паролем, который генерируется в браузере и никогда не покидает ваше устройство в открытом виде.',
      },
      instant: {
        title: 'Мгновенно',
        text: 'Новый ящик готов за один клик — без капч и подтверждений по почте.',
      },
      fast: {
        title: 'Быстро',
        text: 'Доставка через edge-сеть Cloudflare — письма приходят за доли секунды.',
      },
    },
    preview: {
      title: 'Недавно полученные',
      noSubject: '(без темы)',
    },
    create: {
      title: 'Создать аккаунт',
      subtitle: 'Выберите имя пользователя, домен и надёжный пароль.',
      username: 'Имя пользователя',
      usernamePlaceholder: 'johndoe',
      domain: 'Домен',
      password: 'Пароль',
      noDomains: 'Администратор не настроил ни одного домена для временной почты.',
      random: 'Случайные значения',
      cta: 'Создать',
    },
    login: {
      title: 'Вход в аккаунт',
      subtitle: 'Используйте email и пароль, заданные при создании.',
      email: 'Email',
      password: 'Пароль',
      cta: 'Войти',
    },
    inbox: {
      title: 'Входящие',
      noSubject: '(без темы)',
      empty: 'Писем пока нет',
      emptyHint: 'Новые письма появятся здесь автоматически.',
      from: 'От',
      date: 'Дата',
      attachments: 'Вложения',
      selectMessage: 'Выберите письмо',
      refresh: 'Обновить',
      autoRefresh: 'Авто-обновление',
      logout: 'Выйти',
      deleteAccount: 'Удалить аккаунт',
      deleteAccountTitle: 'Удалить этот аккаунт?',
      deleteAccountConfirm: 'Это безвозвратно удалит ящик и все письма. Действие нельзя отменить.',
      expiresAt: 'Истекает {time}',
    },
    errors: {
      required: 'Заполните все обязательные поля',
    },
  },
} as const
