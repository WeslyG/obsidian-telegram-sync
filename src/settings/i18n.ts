import { getLanguage } from "obsidian";

const ru = {
	"Bot proxy": "Прокси для бота",
	"Connect the Telegram bot through an HTTP, HTTPS, or SOCKS5 proxy. ":
		"Подключите бота Telegram через прокси HTTP, HTTPS или SOCKS5. ",
	Configure: "Настроить",
	"Setup guide": "Руководство по настройке",
	"Message distribution rules": "Правила распределения сообщений",
	"Telegram user features": "Функции аккаунта Telegram",
	"Privacy Policy": "Политика конфиденциальности",
	"Fork maintained by ": "Форк поддерживает ",
	"Bot (required)": "Бот (обязательно)",
	"Connect your telegram bot. It's required for all features.":
		"Подключите бота Telegram для импорта сообщений и файлов.",
	"⏳ connecting...": "⏳ Подключение…",
	connected: "Подключён",
	"❌ disconnected": "❌ Не подключён",
	Restart: "Переподключить",
	Settings: "Настройки",
	Connect: "Подключить",
	"To create a new bot click on -> ": "Чтобы создать бота, откройте ",
	"Optional Telegram account connection for ": "Дополнительно можно подключить аккаунт Telegram для ",
	"older messages, larger files, and transcription": "импорта старых сообщений, больших файлов и расшифровки аудио",
	"Telegram user": "Аккаунт Telegram",
	"Uses a separate direct connection to Telegram. The bot proxy applies to Bot API only.":
		"Аккаунт подключается к Telegram напрямую. Прокси бота используется только для Bot API.",
	"Connecting…": "Подключение…",
	Connected: "Подключён",
	Disconnected: "Не подключён",
	"Log out": "Выйти",
	"Log in": "Войти",
	"Telegram user session revoked.": "Сессия аккаунта Telegram отозвана.",
	"Could not revoke the Telegram session. Retry when connected.":
		"Не удалось отозвать сессию Telegram. Повторите попытку после подключения.",
	Reconnect: "Переподключить",
	"Advanced settings": "Дополнительные настройки",
	"Move up": "Переместить вверх",
	"Move down": "Переместить вниз",
	Edit: "Изменить",
	Delete: "Удалить",
	"The default message distribution rule has been created, as at least one rule must exist!":
		"Создано правило по умолчанию. В списке должно быть хотя бы одно правило.",
	"Add rule": "Добавить правило",
	"Process old messages": "Импортировать старые сообщения",
	"During the plugin loading, unprocessed messages that are older than 24 hours and are not accessible to the bot will be forwarded to the same chat using the connected user's account. This action will enable the bot to detect and process these messages":
		"При запуске плагин пересылает в тот же чат необработанные сообщения старше 24 часов, недоступные боту. Пересылка выполняется через подключённый аккаунт Telegram, чтобы бот мог импортировать сообщения.",
	'Default delimiter "***" between messages': "Разделитель «***» между сообщениями",
	"Turn off for using a custom delimiter, which you can set in the template file":
		"Отключите, чтобы задать свой разделитель в файле шаблона.",
	"Parallel message processing": "Параллельная обработка сообщений",
	"Turn on for faster message and file processing. Caution: may disrupt message order":
		"Ускоряет обработку сообщений и файлов. Порядок сообщений может измениться.",
	"Connection status indicator": "Индикатор подключения",
	"Choose when you want to see the connection status indicator": "Выберите, когда показывать индикатор подключения.",
	"never show, log the errors": "Не показывать, записывать ошибки в журнал",
	"show constantly all states": "Показывать всегда",
	"show only when connection errors": "Показывать только при ошибках подключения",
	"Delete messages from Telegram": "Удалять сообщения из Telegram",
	"The Telegram messages will be deleted after processing them. If disabled, the Telegram messages will be marked as processed":
		"Удаляет сообщения из Telegram после импорта. Если параметр выключен, плагин помечает их как обработанные.",
	"Connection type": "Тип подключения",
	"No proxy": "Без прокси",
	"Proxy address": "Адрес прокси",
	"Hostname or IP address and port.": "Имя хоста или IP-адрес и порт.",
	"Use proxy authentication": "Использовать авторизацию на прокси",
	"Credentials are stored in Obsidian's secret storage on this device.":
		"Данные для входа хранятся в связке ключей Obsidian на этом устройстве.",
	Username: "Имя пользователя",
	Password: "Пароль",
	"Proxy username": "Имя пользователя прокси",
	"Proxy password": "Пароль прокси",
	Save: "Сохранить",
	"Invalid proxy settings.": "Проверьте настройки прокси.",
	"Could not save proxy settings. Proxy authentication requires Obsidian 1.11.4 or later.":
		"Не удалось сохранить настройки прокси. Для авторизации нужна версия Obsidian 1.11.4 или новее.",
	"Could not restore the previous proxy credentials in Obsidian secret storage.":
		"Не удалось восстановить прежние данные прокси в связке ключей Obsidian.",
	"Enter a valid proxy hostname or IP address and port.": "Укажите корректное имя хоста или IP-адрес прокси и порт.",
	"Enter the username and password below the proxy address.": "Введите имя пользователя и пароль под адресом прокси.",
	"Enter a valid HTTP, HTTPS, or SOCKS5 proxy address without a path.":
		"Укажите корректный адрес прокси HTTP, HTTPS или SOCKS5 без пути.",
	"Enter both the proxy username and password.": "Введите имя пользователя и пароль прокси.",
	"SOCKS5 usernames and passwords must be at most 255 bytes each.":
		"Имя пользователя и пароль SOCKS5 должны занимать не более 255 байт каждый.",
	"An HTTP proxy username cannot contain a colon.": "Имя пользователя HTTP-прокси не может содержать двоеточие.",
	"Bot settings": "Настройки бота",
	"Bot token": "Токен бота",
	"Stored in Obsidian's local secret storage.": "Токен хранится в локальной связке ключей Obsidian.",
	"Token is stored": "Токен сохранён",
	"Telegram bot token": "Токен бота Telegram",
	"Remove token": "Удалить токен",
	"Token will be removed when saved": "Токен будет удалён после сохранения",
	"Allowed chats": "Разрешённые чаты",
	"Comma-separated usernames or Telegram chat IDs. Leave empty to block all imports.":
		"Укажите имена пользователей или ID чатов Telegram через запятую. Пустой список блокирует импорт.",
	"Main device id": "ID основного устройства",
	"Select one device when the same vault runs on multiple desktops.":
		"Выберите одно устройство, если открываете это хранилище на нескольких компьютерах.",
	"Use this device": "Использовать это устройство",
	"Bot proxy setup guide": "Руководство по настройке прокси бота",
	"Enter a valid Telegram bot token.": "Введите действующий токен бота Telegram.",
	"Could not save Telegram Sync settings.": "Не удалось сохранить настройки Telegram Sync.",
	"Could not restore the previous bot token in Obsidian secret storage.":
		"Не удалось восстановить прежний токен бота в связке ключей Obsidian.",
	"Settings saved. Telegram Sync could not reconnect.":
		"Настройки сохранены. Telegram Sync не удалось переподключиться.",
	"Editing message distribution rule": "Изменение правила распределения сообщений",
	"Adding message distribution rule": "Новое правило распределения сообщений",
	"🗎 User guide": "🗎 Руководство пользователя",
	"Message filter": "Фильтр сообщений",
	"Conditions by which you would like to filter messages. Leave the field blank if you want to apply this rule to all messages":
		"Укажите условия отбора. Пустой фильтр применяет правило ко всем сообщениям.",
	"example: {{topic=Notes}}{{user=example_user}}": "Пример: {{topic=Notes}}{{user=example_user}}",
	"Template file path": "Путь к файлу шаблона",
	"Specify path to template file you want to apply to new notes": "Укажите файл шаблона для новых заметок.",
	"example: folder/zettelkasten.md": "Пример: folder/zettelkasten.md",
	"Note path template": "Шаблон пути к заметке",
	"Specify path template for storage folders and note names. Leave empty if you don't want to create any notes from filtrated messages":
		"Задайте шаблон папки и имени заметки. Оставьте поле пустым, если создавать заметки не нужно.",
	"File path template": "Шаблон пути к файлу",
	"Specify path template for storage folders and file names. Leave empty if you don't want to save any files from filtrated messages":
		"Задайте шаблон папки и имени файла. Оставьте поле пустым, если сохранять файлы не нужно.",
	Heading: "Заголовок",
	"Specify the heading under which new messages will be inserted":
		"Укажите заголовок, под которым будут добавляться новые сообщения.",
	"example: ### Log": "Пример: ### Журнал",
	"Reversed order": "Обратный порядок",
	'Turn on to have new messages appear at the beginning of the note, or, if a heading is specified, above it. Warning: If "Parallel Message Processing" turn on, it may disrupt message order':
		"Добавляет новые сообщения в начало заметки или над указанным заголовком. Параллельная обработка может изменить порядок сообщений.",
	Submit: "Сохранить",
	"Please, fill at least one field": "Заполните хотя бы одно поле пути.",
	'"Template file path", "Note path template" and "File path template" must not be equal to one another':
		"Путь к файлу шаблона, шаблон пути к заметке и шаблон пути к файлу должны различаться.",
	Cancel: "Отмена",
	"Example: {path}": "Пример: {path}",
	"Note path: {path}": "Путь к заметке: {path}",
	"Template file: {path}": "Файл шаблона: {path}",
	"File path: {path}": "Путь к файлу: {path}",
	"error: wrong filter query!": "Ошибка в выражении фильтра",
	'filter = "all messages"': "Фильтр: все сообщения",
	"Processing old messages settings": "Настройки импорта старых сообщений",
	"Chats for message search": "Чаты для поиска сообщений",
	"Choose chats with your connected bot in which to search for old messages. Only chats with activity in the last 30 days will be available. If no chat is chosen, old message processing will not occur":
		"Выберите чаты с подключённым ботом, где нужно искать старые сообщения. В списке появятся чаты с активностью за последние 30 дней. Если список пуст, старые сообщения не импортируются.",
	"Add chats": "Добавить чаты",
	"1 of 3\nSearching for chats with activity in the last {days} days":
		"1 из 3\nПоиск чатов с активностью за последние {days} дн.",
	"Can't execute searching for chats because can't identify bot username":
		"Поиск чатов недоступен: не удалось определить имя бота.",
	"Could not list Telegram chats.": "Не удалось получить список чатов Telegram.",
	'2 of 3\nFiltering chats by bot "{bot}"': "2 из 3\nОтбор чатов с ботом «{bot}»",
	"Could not check participants in a Telegram chat.": "Не удалось проверить участников чата Telegram.",
	"3 of 3\nDone": "3 из 3\nГотово",
	"Connect a Telegram user": "Подключение аккаунта Telegram",
	"This feature connects directly to Telegram. Create an API ID and hash at ":
		"Аккаунт подключается к Telegram напрямую. Получите API ID и API hash на ",
	"API hash": "Хеш API (API hash)",
	"Telegram two-step password": "Пароль двухэтапной аутентификации Telegram",
	"Enter it only if enabled on your Telegram account.":
		"Введите пароль, если в аккаунте Telegram включена двухэтапная аутентификация.",
	"In Telegram, open Settings → Devices → Link Desktop Device.":
		"В Telegram откройте «Настройки → Устройства → Подключить устройство».",
	"Generate QR code": "Создать QR-код",
	"Connecting to Telegram…": "Подключение к Telegram…",
	"Telegram login QR code": "QR-код для входа в Telegram",
	"Telegram user connection is already in progress.": "Подключение аккаунта Telegram уже выполняется.",
	"Telegram Sync is closing.": "Telegram Sync завершает работу.",
	"Telegram Sync is paused on this device.": "Telegram Sync приостановлен на этом устройстве.",
	"Enter a valid Telegram API ID and API hash.": "Введите корректные API ID и API hash Telegram.",
	"Telegram login cancelled.": "Вход в Telegram отменён.",
	"Could not connect the Telegram user.": "Не удалось подключить аккаунт Telegram.",
	"Sync is paused on this device. To resume it here, select Use this device in the bot settings.":
		"Синхронизация на этом устройстве приостановлена. Чтобы возобновить её, выберите «Использовать это устройство» в настройках бота.",
	"Check your internet or proxy connection and confirm that the official Telegram app works. Then restart Obsidian.":
		"Проверьте подключение к интернету или прокси и убедитесь, что Telegram работает в официальном приложении. Затем перезапустите Obsidian.",
	"Telegram Bot API connection failed.": "Не удалось подключиться к Telegram Bot API.",
	"Invalid filter query.": "Некорректное выражение фильтра.",
	"Empty value for condition type: {type}": "Не указано значение для условия {type}.",
	"Unknown condition type: {type}": "Неизвестный тип условия: {type}.",
	"Unsupported filter operation: {operation}": "Неподдерживаемая операция фильтра: {operation}.",
} as const;

type MessageKey = keyof typeof ru;

export function t(message: MessageKey, values?: Record<string, string | number>): string {
	const template = /^ru(?:[-_]|$)/i.test(getLanguage()) ? ru[message] : message;
	return values ? template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match)) : template;
}

export function proxySettingsError(error: unknown): string {
	const message = error instanceof Error ? error.message : "";
	return Object.hasOwn(ru, message) ? t(message as MessageKey) : t("Invalid proxy settings.");
}
