/**
 * Local i18n catalog for the mail.* Pages site (login + mailbox view).
 */

export const messages = {
  en: {
    login: {
      title: 'Log in to mail',
      email: 'Email',
      password: 'Password',
      cta: 'Log in',
      error: 'Login failed',
    },
    nav: {
      main: 'Main',
      changePassword: 'Change password',
      support: 'Support',
      logout: 'Log out',
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
    },
    changePassword: {
      title: 'Change password',
      newPassword: 'New password',
      confirmPassword: 'Confirm password',
      mismatch: 'Passwords do not match',
      cta: 'Update password',
      success: 'Password updated',
    },
    actions: {
      cancel: 'Cancel',
    },
    errors: {
      required: 'Please fill in all required fields',
    },
  },
  ru: {
    login: {
      title: 'Вход в почту',
      email: 'Email',
      password: 'Пароль',
      cta: 'Войти',
      error: 'Не удалось войти',
    },
    nav: {
      main: 'Главная',
      changePassword: 'Сменить пароль',
      support: 'Поддержка',
      logout: 'Выйти',
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
    },
    changePassword: {
      title: 'Сменить пароль',
      newPassword: 'Новый пароль',
      confirmPassword: 'Подтвердите пароль',
      mismatch: 'Пароли не совпадают',
      cta: 'Обновить пароль',
      success: 'Пароль обновлён',
    },
    actions: {
      cancel: 'Отмена',
    },
    errors: {
      required: 'Заполните все обязательные поля',
    },
  },
} as const
