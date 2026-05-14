import { LocaleMessages } from "./type";

const messages: LocaleMessages = {
    CustomAuthPasswordMsg: "Включена защита приватного сайта паролем — укажите пароль",
    UserTokenExpiredMsg: "Срок действия токена истёк, войдите снова",
    UserAcceesTokenExpiredMsg: "Срок действия access-токена истёк, обновите страницу",
    UserRoleIsNotAdminMsg: "Ваша роль не admin, доступ к этой странице запрещён",
    NeedAdminPasswordMsg: "Для доступа к этой странице нужен пароль администратора",

    KVNotAvailableMsg: "KV недоступен, обратитесь к администратору",
    DBNotAvailableMsg: "База данных недоступна, обратитесь к администратору",
    JWTSecretNotSetMsg: "JWT_SECRET не задан, обратитесь к администратору",
    WebhookNotEnabledMsg: "Webhook не включён, обратитесь к администратору",
    DomainsNotSetMsg: "Домены не настроены, обратитесь к администратору",

    TurnstileCheckFailedMsg: "Проверка человека (Turnstile) не пройдена",
    NewAddressDisabledMsg: "Создание новых адресов отключено, обратитесь к администратору",
    NewAddressAnonymousDisabledMsg: "Создание адресов анонимными пользователями отключено, обратитесь к администратору",
    FailedCreateAddressMsg: "Не удалось создать адрес",
    InvalidAddressMsg: "Некорректный адрес",
    InvalidAddressCredentialMsg: "Неверный токен адреса",
    UserDeleteEmailDisabledMsg: "Удаление адреса/писем пользователем отключено, обратитесь к администратору",

    UserNotFoundMsg: "Пользователь не найден",
    UserAlreadyExistsMsg: "Пользователь уже существует, войдите в систему",
    FailedToRegisterMsg: "Не удалось зарегистрироваться",
    UserRegistrationDisabledMsg: "Регистрация пользователей отключена, обратитесь к администратору",
    UserMailDomainMustInMsg: "Домен почты пользователя должен быть из этого списка",
    UserEmailNotMatchRegexMsg: "Адрес почты не соответствует требуемому формату",
    InvalidVerifyCodeMsg: "Неверный код подтверждения",
    InvalidEmailOrPasswordMsg: "Неверный email или пароль",
    VerifyMailSenderNotSetMsg: "Адрес отправителя писем для верификации не задан, обратитесь к администратору",
    CodeAlreadySentMsg: "Код уже отправлен, подождите",
    InvalidUserDefaultRoleMsg: "Некорректная роль пользователя по умолчанию, обратитесь к администратору",
    FailedUpdateUserDefaultRoleMsg: "Не удалось обновить роль пользователя по умолчанию, обратитесь к администратору",

    Oauth2ClientIDNotFoundMsg: "OAuth2 client ID не задан, обратитесь к администратору",
    Oauth2CliendIDOrCodeMissingMsg: "Отсутствует OAuth2 client ID или code",
    Oauth2FailedGetUserInfoMsg: "Не удалось получить данные пользователя у провайдера OAuth2",
    Oauth2FailedGetAccessTokenMsg: "Не удалось получить access-токен у провайдера OAuth2",
    Oauth2FailedGetUserEmailMsg: "Не удалось получить email пользователя у провайдера OAuth2",

    PasswordChangeDisabledMsg: "Смена пароля отключена",
    NewPasswordRequiredMsg: "Требуется новый пароль",
    InvalidAddressTokenMsg: "Неверный токен адреса",
    FailedUpdatePasswordMsg: "Не удалось обновить пароль",
    PasswordLoginDisabledMsg: "Вход по паролю отключён",
    EmailPasswordRequiredMsg: "Требуются email и пароль",
    AddressNotFoundMsg: "Адрес не найден",

    // Common messages (merged similar ones)
    OperationFailedMsg: "Операция не выполнена",
    RequiredFieldMsg: "Отсутствует обязательное поле",
    InvalidInputMsg: "Некорректные входные данные",

    // Address related
    NameTooShortMsg: "Имя слишком короткое",
    NameTooLongMsg: "Имя слишком длинное",
    InvalidDomainMsg: "Некорректный домен",
    RandomSubdomainNotAllowedMsg: "Случайный поддомен не разрешён для этого домена",
    AddressAlreadyExistsMsg: "Адрес уже существует",
    MaxAddressCountReachedMsg: "Достигнут лимит количества адресов",
    AddressNotBindedMsg: "Адрес не привязан",
    AddressAlreadyBindedMsg: "Адрес уже привязан, сначала отвяжите его",
    TargetUserNotFoundMsg: "Целевой пользователь не найден",

    // Send mail related
    NoBalanceMsg: "Недостаточно баланса",
    AddressBlockedMsg: "Адрес заблокирован",
    SubjectEmptyMsg: "Тема пустая",
    ContentEmptyMsg: "Тело письма пустое",
    AlreadyRequestedMsg: "Запрос уже отправлен",
    EnableResendOrSmtpMsg: "Включите Resend или SMTP для этого домена",
    EnableResendOrSmtpOrSendMailMsg: "Включите Resend, SMTP или SEND_MAIL для этого домена",
    ServerSendMailDailyLimitMsg: "Достигнут суточный лимит отправки писем сервером",
    ServerSendMailMonthlyLimitMsg: "Достигнут месячный лимит отправки писем сервером",
    InvalidToMailMsg: "Некорректный адрес получателя",

    // Admin related
    InvalidAddressIdMsg: "Некорректный address_id",
    EnableKVMsg: "Сначала включите KV",
    EnableSendMailMsg: "Сначала включите SEND_MAIL",
    EnableSendMailForDomainMsg: "Сначала включите SEND_MAIL для этого домена",
    InvalidCleanupConfigMsg: "Некорректные cleanType или cleanDays",
    InvalidCleanTypeMsg: "Некорректный cleanType",
    EnableKVForMailVerifyMsg: "Сначала включите KV, чтобы использовать верификацию по почте",
    VerifyMailDomainInvalidMsg: "Домен VerifyMailSender должен входить в список",
    InvalidMaxAddressCountMsg: "Некорректное maxAddressCount",
    FailedDeleteUserMsg: "Не удалось удалить пользователя",
    InvalidUserIdMsg: "Некорректный user_id",
    InvalidRoleTextMsg: "Некорректный role_text",

    // SQL validation
    SqlEmptyMsg: "SQL-запрос пустой",
    SqlTooLongMsg: "SQL-запрос слишком длинный (максимум 1000 символов)",
    SqlOnlyDeleteMsg: "Разрешены только DELETE-запросы",
    SqlSingleStatementMsg: "Разрешён только один SQL-запрос за раз",
    SqlNoCommentsMsg: "Комментарии в SQL не допускаются",

    // Passkey related
    InvalidPasskeyNameMsg: "Некорректное имя passkey",
    PasskeyNotFoundMsg: "Passkey не найден",
    AuthenticationFailedMsg: "Аутентификация не пройдена",
    RegistrationFailedMsg: "Регистрация не выполнена",

    // Auto reply related
    AutoReplyDisabledMsg: "Автоответчик отключён",
    InvalidAutoReplyMsg: "Некорректные тема или текст автоответа",
    SubjectOrMessageTooLongMsg: "Тема или текст слишком длинные",

    // Bind address related
    NoAddressOrUserTokenMsg: "Отсутствует токен адреса или пользователя",
    InvalidAddressOrUserTokenMsg: "Некорректный токен адреса или пользователя",

    // Pagination related
    InvalidLimitMsg: "Некорректный limit",
    InvalidOffsetMsg: "Некорректный offset",

    // Clear inbox/sent items related
    FailedClearInboxMsg: "Не удалось очистить входящие",
    FailedClearSentItemsMsg: "Не удалось очистить отправленные",

    // Webhook related
    WebhookNotAllowedForUserMsg: "Настройка webhook не разрешена для этого пользователя",

    // IP blacklist related
    InvalidIpBlacklistSettingMsg: "Некорректные настройки чёрного списка IP",
    BlacklistExceedsMaxSizeMsg: "Чёрный список превышает максимальный размер",

    // Telegram bot messages
    TgUnableGetUserInfoMsg: "Не удалось получить данные пользователя",
    TgNoPermissionMsg: "У вас нет прав на использование этого бота",
    TgWelcomeMsg: "Добро пожаловать! Откройте мини-приложение",
    TgCurrentPrefixMsg: "Текущий префикс:",
    TgCurrentDomainsMsg: "Доступные домены:",
    TgAvailableCommandsMsg: "Доступные команды:",
    TgCreateSuccessMsg: "Адрес создан:",
    TgCreateFailedMsg: "Не удалось создать адрес:",
    TgBindSuccessMsg: "Привязка выполнена:",
    TgBindFailedMsg: "Привязка не выполнена:",
    TgUnbindSuccessMsg: "Отвязка выполнена:",
    TgUnbindFailedMsg: "Отвязка не выполнена:",
    TgDeleteSuccessMsg: "Удалено:",
    TgDeleteFailedMsg: "Не удалось удалить:",
    TgAddressListMsg: "Список адресов:",
    TgGetAddressFailedMsg: "Не удалось получить список адресов:",
    TgCleanSuccessMsg: "Очищены недействительные адреса:",
    TgCurrentAddressListMsg: "Текущий список адресов:",
    TgCleanFailedMsg: "Не удалось очистить недействительные адреса:",
    TgNotBoundAddressMsg: "Этот адрес не привязан:",
    TgInvalidAddressMsg: "Некорректный адрес",
    TgNoMoreMailsMsg: "Больше писем нет",
    TgNoMailMsg: "Писем нет",
    TgGetMailFailedMsg: "Не удалось получить письмо:",
    TgParseMailFailedMsg: "Не удалось разобрать письмо:",
    TgViewMailBtnMsg: "Открыть письмо",
    TgPrevBtnMsg: "Назад",
    TgNextBtnMsg: "Далее",
    TgPleaseInputCredentialMsg: "Введите токен",
    TgPleaseInputAddressMsg: "Введите адрес",
    TgAddressMsg: "Адрес:",
    TgPasswordMsg: "Пароль:",
    TgCredentialMsg: "Токен:",
    TgNoSenderMsg: "Отправитель не указан",
    TgMsgTooLongMsg: "Сообщение слишком длинное, откройте в мини-приложении",
    TgParseFailedViewInAppMsg: "Не удалось разобрать, откройте в мини-приложении",
    TgMaxAddressReachedMsg: "Достигнут лимит количества адресов",
    TgMaxAddressReachedCleanMsg: "Достигнут лимит, сначала выполните /cleaninvalidaddress",
    TgInvalidCredentialMsg: "Неверный токен",
    TgAddressNotYoursMsg: "Этот адрес не принадлежит вам",
    TgLangSetSuccessMsg: "Язык установлен:",
    TgCurrentLangMsg: "Текущий язык:",
    TgSelectLangMsg: "Выберите язык:",
    TgNoPermissionViewMailMsg: "Нет прав на просмотр этого письма",
    TgBotTokenRequiredMsg: "Требуется TELEGRAM_BOT_TOKEN",
    TgLangFeatureDisabledMsg: "Функция выбора языка отключена. Используется системный язык по умолчанию.",
}

export default messages;
