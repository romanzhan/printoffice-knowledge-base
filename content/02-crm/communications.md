# Коммуникации и задачи

Подсистема CRM для обмена сообщениями с клиентами и сотрудниками, ведения единой истории взаимодействий по заказу, постановки задач менеджерам и рассылки уведомлений. Включает чат-центр с разделением на внутреннюю и клиентскую ветки, мультиканальность (Макс, Telegram, WhatsApp, email, SMS) и шаблоны типовых ответов.

## Каналы связи

В карточке заказа доступны несколько внешних каналов, сообщения из которых CRM автоматически подтягивает (через API ботов и email-парсер) и привязывает к заказу.

| Канал | Назначение | Интеграция |
|-------|-----------|------------|
| Email | B2B: счета, договоры, УПД, коммерческие предложения. B2C: чеки, подтверждения, уведомления | SMTP / SendGrid / Яндекс.Почта |
| Telegram / WhatsApp / Макс | B2C: быстрые заказы — принять заказ, отправить чек, уведомить о готовности. B2B: коммуникация по макетам, правкам, согласованиям | Bot API / WhatsApp Business API |
| Телефон (звонки) | B2C: быстрые консультации, уточнение адреса и времени. B2B: обсуждение крупных заказов | Запись звонков, привязка к заказу |
| Офис (личное присутствие) | Только B2C: моментальные заказы, оплата на месте, выдача | Терминал самообслуживания (киоск) |
| SMS | Уведомления о статусе/готовности | — |
| Внутренний чат (`internal_chat`) | Переписка между сотрудниками | — |

В модели сообщений канал хранится в поле `channel ENUM('email', 'telegram', 'whatsapp', 'sms', 'internal_chat')`.

## Две ветки переписки

В карточке заказа располагаются две вкладки чата, между которыми можно переключаться.

### Чат с клиентом
- Отображаются сообщения из Макс, Telegram, WhatsApp, email, связанные с этим заказом.
- CRM автоматически подтягивает входящие сообщения через API ботов и email-парсер.
- Менеджер может писать клиенту прямо из CRM: набранный текст отправляется через выбранный канал.
- Клиент не видит внутренних комментариев.

### Внутренние комментарии
- Видят только сотрудники.
- Сообщение можно адресовать конкретному сотруднику (например, `@Паша`).
- Адресату приходит уведомление в рабочий чат (Макс, Telegram).

Разделение веток на уровне БД обеспечивается полем `direction ENUM('incoming', 'outgoing', 'internal')` в таблице `communications` и типом отправителя `sender_type ENUM('client', 'manager', 'system')` в таблице `messages`.

## Переключение канала

Менеджер выбирает канал отправки прямо в интерфейсе чата; одно и то же сообщение может уйти клиенту через любой подключённый канал. Список каналов отправки фиксируется в данных (например, поле `sent_via JSON` хранит `['email', 'telegram', 'whatsapp']`). Для каждого шаблона задаётся перечень поддерживаемых каналов в поле `channels JSON`.

## Бот (обработка входящих)

Настройка бота выполняется в разделе «Бот» в админке.

- Бот отвечает на стандартные вопросы: график работы, адреса офисов, как проехать, условия оплаты и доставки.
- Может выяснять формальности («Какой формат?», «Тираж?») и создавать предварительный заказ; функцию можно отключить.
- Входящие сообщения парсятся: извлекается телефон, адрес, никнейм → автоматически создаётся или находится клиент и привязывается к заказу.
- Автоматическое создание заказа по сообщению: например, при сообщении «Хочу листовки А5, 100 шт» бот задаёт уточняющие вопросы, затем создаёт заказ в статусе «Новый» и уведомляет менеджера.

## Архитектура базы данных

Коммуникации построены вокруг центральной таблицы `communications`, к которой привязаны все сущности.

### Схема связей

```text
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│    clients      │   │     orders      │   │    managers     │
│   (клиенты)     │◄──┤    (заказы)     │──►│  (менеджеры)    │
└─────────────────┘   └─────────────────┘   └─────────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
        ┌──────────────────────────────────────────────────┐
        │   ЦЕНТРАЛЬНАЯ ТАБЛИЦА                              │
        │   communications                                  │
        │   • Связывает всё воедино                         │
        │   • Хранит историю всех взаимодействий            │
        │   • Каждая запись имеет тип, направление, статус  │
        └──────────────────────────────────────────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   proposals     │   │   messages      │   │   tasks         │
│  (предложения)  │   │  (сообщения)    │   │  (задачи)       │
└─────────────────┘   └─────────────────┘   └─────────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   versions      │   │   channels      │   │  notifications  │
│(версии расчётов)│   │ (каналы связи)  │   │  (уведомления)  │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

Третий уровень схемы — детализация центральных сущностей: `versions` (история версий расчётов в составе подсистемы предложений), `channels` (каналы связи) и `notifications` (уведомления). Сущность `channels` отдельной таблицей не реализуется — канал хранится в поле `messages.channel ENUM(...)` (см. раздел «Каналы связи»); `versions` и `proposals` относятся к подсистеме коммерческих предложений и описаны в соответствующем документе.

> Примечание о нумерации. В исходной модели `architecture.md` таблицы пронумерованы сквозным списком из семи позиций: `1. communications`, `2. proposals`, `3. versions`, `4. messages`, `5. tasks`, `6. templates`, `7. notifications`. Позиции 2 (`proposals`) и 3 (`proposal_versions`) относятся к подсистеме коммерческих предложений и вынесены в отдельный документ, поэтому в данном файле описаны только пять таблиц подсистемы коммуникаций. Ниже они перенумерованы по порядку (1–5); в скобках указан исходный номер из `architecture.md`, чтобы при сверке с первоисточником было видно соответствие.

### 1. communications (ядро системы) — исходный № 1

Главная таблица: в неё пишется каждое событие по заказу.

```sql
CREATE TABLE communications (
    id INT PRIMARY KEY AUTO_INCREMENT,

    -- Ключевые связи (к чему относится)
    client_id INT NOT NULL,        -- Клиент (обязательно)
    order_id INT,                  -- Заказ (может быть NULL для общих вопросов)
    manager_id INT,                -- Менеджер (кто создал/обработал)

    -- Тип коммуникации (что это за событие)
    comm_type ENUM(
        'proposal_sent',        -- Отправлено предложение
        'proposal_viewed',      -- Клиент посмотрел
        'proposal_accepted',    -- Согласовано
        'proposal_rejected',    -- Отклонено
        'proposal_modified',    -- Изменено менеджером
        'message_received',     -- Сообщение от клиента
        'message_sent',         -- Сообщение менеджера
        'price_changed',        -- Изменилась цена
        'status_changed',       -- Изменился статус
        'file_uploaded',        -- Загружен файл
        'task_created',         -- Создана задача
        'payment_received',     -- Получена оплата
        'system_notification'   -- Системное уведомление
    ) NOT NULL,

    -- Направление
    direction ENUM('incoming', 'outgoing', 'internal') DEFAULT 'internal',

    -- Содержимое
    content TEXT,         -- Текст сообщения/комментарий
    content_json JSON,    -- Структурированные данные (для предложений)

    -- Статус
    status ENUM(
        'draft',      -- Черновик
        'sent',       -- Отправлено
        'delivered',  -- Доставлено
        'viewed',     -- Просмотрено
        'responded',  -- Получен ответ
        'expired',    -- Истекло
        'cancelled'   -- Отменено
    ) DEFAULT 'draft',

    -- Временные метки
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Дополнительно
    metadata JSON,                       -- Любые дополнительные данные
    is_important BOOLEAN DEFAULT false,  -- Пометить как важное
    is_read BOOLEAN DEFAULT false,       -- Прочитано ли менеджером

    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (manager_id) REFERENCES managers(id),

    INDEX idx_client (client_id),
    INDEX idx_order (order_id),
    INDEX idx_created (created_at),
    INDEX idx_type (comm_type),
    INDEX idx_status (status)
);
```

### 2. messages (сообщения) — исходный № 4

Хранит все сообщения в чатах с клиентами.

```sql
CREATE TABLE messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    communication_id INT,

    -- Связь с предложением (если сообщение по конкретному КП)
    proposal_id INT,

    -- Текст сообщения
    message_text TEXT NOT NULL,
    message_html TEXT,   -- Для форматированных сообщений

    -- Медиафайлы
    attachments JSON,    -- [{url, name, size, type}]

    -- Данные отправителя/получателя
    sender_type ENUM('client', 'manager', 'system') NOT NULL,
    sender_id INT,       -- ID клиента или менеджера
    recipient_type ENUM('client', 'manager', 'system'),
    recipient_id INT,

    -- Канал
    channel ENUM('email', 'telegram', 'whatsapp', 'sms', 'internal_chat') NOT NULL,

    -- Внешние ID (для интеграции с мессенджерами)
    external_message_id VARCHAR(255),  -- ID в Telegram/WhatsApp
    external_chat_id VARCHAR(255),     -- ID чата

    -- Статус доставки
    delivery_status ENUM(
        'pending', 'sent', 'delivered', 'read', 'failed'
    ) DEFAULT 'pending',

    -- Временные метки
    sent_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (communication_id) REFERENCES communications(id),
    FOREIGN KEY (proposal_id) REFERENCES proposals(id),

    INDEX idx_sender (sender_type, sender_id),
    INDEX idx_channel (channel),
    INDEX idx_external (external_message_id)
);
```

### 3. communication_tasks (задачи для менеджеров) — исходный № 5

Автоматически создаваемые задачи по коммуникациям.

```sql
CREATE TABLE communication_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    communication_id INT,

    -- Тип задачи
    task_type ENUM(
        'review_proposal',  -- Проверить предложение
        'follow_up',        -- Связаться через N часов
        'price_check',      -- Проверить цену
        'client_call',      -- Позвонить клиенту
        'send_documents',   -- Отправить документы
        'clarify_details'   -- Уточнить детали
    ) NOT NULL,

    -- Описание
    description TEXT,

    -- Приоритет
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',

    -- Назначено
    assigned_to INT,   -- ID менеджера
    assigned_by INT,   -- Кто создал

    -- Сроки
    due_at TIMESTAMP,            -- Когда выполнить
    completed_at TIMESTAMP NULL,

    -- Статус
    status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',

    -- Результат
    result TEXT,                     -- Что сделано
    result_communication_id INT,     -- Какая коммуникация создана в результате

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (communication_id) REFERENCES communications(id),
    FOREIGN KEY (assigned_to) REFERENCES managers(id),
    FOREIGN KEY (assigned_by) REFERENCES managers(id),

    INDEX idx_assigned (assigned_to, status),
    INDEX idx_due (due_at)
);
```

**Параметры задачи:** тип (`task_type`), приоритет (`low / normal / high / urgent`), исполнитель (`assigned_to`), дедлайн (`due_at`), статус выполнения и результат.

### 4. message_templates (шаблоны ответов) — исходный № 6

Для быстрой отправки типовых сообщений без участия программиста.

```sql
CREATE TABLE message_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,   -- Название шаблона
    code VARCHAR(100) UNIQUE,     -- Уникальный код

    -- Категория
    category ENUM(
        'proposal',    -- По предложениям
        'payment',     -- По оплате
        'production',  -- По производству
        'general'      -- Общие
    ) NOT NULL,

    -- Содержимое
    subject VARCHAR(255),  -- Тема (для email)
    body TEXT NOT NULL,    -- Текст сообщения
    body_html TEXT,        -- HTML-версия

    -- Переменные
    variables JSON,        -- Список доступных переменных

    -- Для каких каналов подходит
    channels JSON,         -- ['email', 'telegram', 'whatsapp']

    -- Автоматическое использование
    auto_apply_conditions JSON,  -- При каких условиях предлагать

    is_active BOOLEAN DEFAULT true,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_category (category),
    INDEX idx_code (code)
);
```

### 5. notifications (уведомления) — исходный № 7

Внутрисистемные уведомления для менеджеров и администраторов.

```sql
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    communication_id INT,

    -- Кому
    user_id INT NOT NULL,  -- ID менеджера
    user_type ENUM('manager', 'admin') DEFAULT 'manager',

    -- Тип уведомления
    type ENUM(
        'new_proposal',       -- Новое предложение
        'proposal_accepted',  -- Клиент согласился
        'proposal_rejected',  -- Клиент отказал
        'new_message',        -- Новое сообщение
        'task_assigned',      -- Назначена задача
        'price_changed',      -- Цена изменилась
        'system_alert'        -- Системное
    ) NOT NULL,

    -- Заголовок и текст
    title VARCHAR(255),
    message TEXT,

    -- Ссылка (куда перейти)
    link VARCHAR(255),

    -- Статус
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (communication_id) REFERENCES communications(id),

    INDEX idx_user (user_id, is_read),
    INDEX idx_created (created_at)
);
```

> Примечание. Таблицы `proposals` (предложения) и `proposal_versions` (история версий расчётов) также завязаны на `communications`, но относятся к подсистеме коммерческих предложений и описываются в соответствующем документе. Здесь они упомянуты как смежные сущности через поля `proposal_id` и `communication_id`.

## Многоканальная отправка коммерческого предложения

Современный подход к отправке КП — не «отправить файл», а «поделиться ссылкой» на интерактивный документ. Email с PDF остаётся официальным каналом документооборота, но дублируется ссылкой на «живую» страницу, где клиент переключает варианты расчёта, видит раскладку и сразу подтверждает выбор.

### Каналы и форматы

| Канал | Формат | Когда использовать | Плюсы | Минусы |
|-------|--------|--------------------|-------|--------|
| Email | PDF + ссылка на просмотр | Основной канал, документооборот | Официально, файл в приложении, сохраняется в переписке | Может попасть в спам, не моментально |
| Telegram | Текст + ссылка | Срочные согласования, молодые клиенты | Мгновенно, высокий % прочтения | Неофициально, ссылка может потеряться |
| WhatsApp | Текст + ссылка | B2C, быстрые заказы | Максимальный охват | Требуется API для интеграции |
| СМС | Короткая ссылка | Когда клиент не в сети | 100% доставка | Дорого, ограничение по символам |
| Личный кабинет | Уведомление + ссылка | Постоянные клиенты | Безопасно, история в одном месте | Требует регистрации |

На основе скорректированного расчёта система генерирует три формата одного предложения: **PDF** (для email и печати), **HTML-страница** (интерактивная: переключатель вариантов, визуализация раскладки, кнопки «Согласен» / «Предложить свой вариант» / «Задать вопрос») и **текстовая версия** (для мессенджеров).

### JSON-структура предложения

Скорректированное предложение — это структурированный объект, который сохраняется в `communications.content_json` (и в `proposals.calculation_snapshot`). Он содержит исходный и скорректированный расчёты, перечень корректировок, сравнение и набор вариантов для клиента.

```javascript
// Структура скорректированного предложения
const adjustedProposal = {
  id: "PROP-2026-03-08-001",
  date: "2026-03-08",
  client: {
    name: "ООО Ромашка",
    contact: "Иван Петрович",
    email: "ivan@romashka.ru",
    phone: "+7 999 123-45-67",
    telegram: "@ivan_romashka"
  },
  originalCalculation: {
    total: 6050,
    items: [/* позиции */]
  },
  adjustedCalculation: {
    total: 3650,
    items: [/* позиции с корректировками */],
    adjustments: [
      { type: "make_ready", value: 500,  reason: "Приладка (сложная настройка)" },
      { type: "discount",   value: -350, reason: "Скидка 10% на позицию" }
    ]
  },
  comparison: {
    difference: -2400,
    percent: -39.7,
    reason: "Нестандартная раскладка под ламинацию (20 шт на листе вместо 24)"
  },
  options: [
    {
      id: 1,
      name: "Базовый (как на сайте)",
      total: 6050,
      description: "Стандартная раскладка 24 шт/лист, без приладки"
    },
    {
      id: 2,
      name: "Оптимальный для производства",
      total: 3650,
      description: "Раскладка 20 шт/лист (подходит для ламинации) + приладка"
    }
  ]
};
```

Поле `adjustments[].type` использует тот же каталог корректировок, что и `order_adjustments` (`make_ready` / `urgency` / `discount`) — см. модель ценообразования. Каждый вариант в `options` имеет собственный итог, чтобы клиент мог выбрать на интерактивной странице.

### Логика автоматического выбора канала

При отправке система подбирает каналы автоматически: учитывает предпочтительный канал клиента, его активность в Telegram, открываемость email, срочность и важность предложения. Для важных предложений (большая сумма или значительное отклонение от цены сайта) отправка дублируется минимум в два канала.

```javascript
function selectCommunicationChannel(client, proposal) {
  const channels = [];

  // Анализируем историю взаимодействий
  if (client.preferredChannel) {
    // Если клиент указал предпочтительный канал
    channels.push(client.preferredChannel);
  } else {
    // Автоматический выбор на основе данных
    if (client.telegram && client.telegramActivity > 0.7) {
      channels.push('telegram');   // Активный Telegram-пользователь
    }
    if (client.email && client.emailOpenRate > 0.3) {
      channels.push('email');      // Читает email
    }
    if (client.phone && proposal.urgency === 'high') {
      channels.push('sms');        // Срочно — дублируем СМС
    }
  }

  // Для важных предложений — дублируем в 2 канала
  if (proposal.total > 10000 || proposal.deviation > 20) {
    // Большая сумма или значительное отклонение
    return [...new Set([...channels, 'email', 'telegram'])];
  }

  return channels;
}
```

Пороги логики: активность в Telegram `> 0.7`, открываемость email `> 0.3`, дублирование в email + Telegram при сумме `> 10 000` руб или отклонении `> 20%`. Итоговый набор каналов фиксируется в `messages.sent_via JSON` (например, `['email', 'telegram']`).

### Рекомендуемая (гибридная) схема

- **Базовая (автоматическая):** Email с PDF (документооборот) + Telegram со ссылкой (быстрое согласование); в обоих каналах — ссылка на интерактивную версию.
- **Расширенная (для сложных случаев):** WhatsApp через официальный API, СМС для срочных уведомлений, личный кабинет для постоянных клиентов.
- **Ключевая фишка — «живая» ссылка:** вместо простого файла клиент получает ссылку на интерактивную страницу, где переключается между вариантами расчёта, видит визуализацию раскладки, сразу подтверждает выбор или задаёт вопрос в контексте заказа.

При обратной связи от клиента (по ссылке) возможны действия: **согласиться** (автоматически создаётся счёт, заказ → «Подтверждён», менеджер получает уведомление); **выбрать другой вариант** (фиксируется выбор, пересчитывается итог); **задать вопрос** (попадает в карточку заказа, менеджер отвечает в том же канале); **отказаться** (фиксируется причина, заказ → «Отклонён», можно отправить альтернативу).

## Сценарии работы (чат-центр)

### Пример 1. Отправка предложения

```javascript
// 1. Менеджер создаёт предложение
const proposal = {
    clientId: 123,
    orderId: 456,
    calculationSnapshot: {...},
    totalAdjusted: 3250,
    changes: [...],
    justifications: [...]
};

// 2. Система создаёт запись в communications
const comm = await db.communications.create({
    client_id: 123,
    order_id: 456,
    manager_id: currentManager.id,
    comm_type: 'proposal_sent',
    direction: 'outgoing',
    content_json: proposal,
    status: 'sent'
});

// 3. Создаёт proposal
const proposalDb = await db.proposals.create({
    communication_id: comm.id,
    proposal_number: 'КП-2026-03-08-001',
    calculation_snapshot: proposal.calculationSnapshot,
    total_adjusted: proposal.totalAdjusted,
    changes: proposal.changes,
    justifications: proposal.justifications,
    status: 'sent',
    sent_at: new Date()
});

// 4. Создаёт задачу на follow-up
await db.communication_tasks.create({
    communication_id: comm.id,
    task_type: 'follow_up',
    description: 'Перезвонить клиенту через 2 часа после отправки КП',
    assigned_to: currentManager.id,
    due_at: new Date(Date.now() + 2 * 60 * 60 * 1000)
});

// 5. Создаёт уведомление менеджеру
await db.notifications.create({
    communication_id: comm.id,
    user_id: currentManager.id,
    type: 'new_proposal',
    title: 'Предложение отправлено',
    message: `КП №${proposalDb.proposal_number} отправлено клиенту`
});
```

### Пример 2. Клиент посмотрел предложение

```javascript
// Когда клиент переходит по ссылке
app.get('/proposal/:token', async (req, res) => {
    const proposal = await db.proposals.findOne({ token: req.params.token });

    // Обновляем статус
    await db.proposals.update({
        id: proposal.id,
        status: 'viewed',
        viewed_at: new Date()
    });

    // Обновляем коммуникацию
    await db.communications.update({
        id: proposal.communication_id,
        status: 'viewed'
    });

    // Создаём уведомление менеджеру
    await db.notifications.create({
        communication_id: proposal.communication_id,
        user_id: proposal.created_by,
        type: 'proposal_viewed',
        title: 'Клиент посмотрел предложение',
        message: `Клиент открыл КП №${proposal.proposal_number}`
    });

    res.render('proposal', { proposal });
});
```

### Пример 3. Клиент согласовал

```javascript
// Клиент нажал "Согласен"
async function acceptProposal(proposalId) {
    const proposal = await db.proposals.findById(proposalId);

    // Обновляем статус
    await db.proposals.update({
        id: proposalId,
        status: 'accepted',
        total_agreed: proposal.total_adjusted,
        responded_at: new Date()
    });

    // Обновляем коммуникацию
    await db.communications.update({
        id: proposal.communication_id,
        status: 'responded'
    });

    // Создаём запись о согласовании
    await db.communications.create({
        client_id: proposal.client_id,
        order_id: proposal.order_id,
        comm_type: 'proposal_accepted',
        direction: 'incoming',
        content: 'Клиент согласовал предложение',
        status: 'delivered'
    });

    // Обновляем заказ
    await db.orders.update({
        id: proposal.order_id,
        status: 'approved',
        agreed_price: proposal.total_adjusted
    });

    // Создаём задачу на выставление счёта
    await db.communication_tasks.create({
        communication_id: proposal.communication_id,
        task_type: 'send_documents',
        description: 'Выставить счёт клиенту',
        assigned_to: proposal.created_by,
        due_at: new Date(),
        priority: 'high'
    });

    // Уведомляем менеджера
    await db.notifications.create({
        communication_id: proposal.communication_id,
        user_id: proposal.created_by,
        type: 'proposal_accepted',
        title: 'Клиент согласился!',
        message: `КП №${proposal.proposal_number} принято. Сумма: ${proposal.total_adjusted} руб`
    });
}
```

## Индексы для производительности

```sql
-- Составные индексы для частых запросов
CREATE INDEX idx_client_comm_type ON communications(client_id, comm_type, created_at);
CREATE INDEX idx_order_comm_type ON communications(order_id, comm_type, created_at);
CREATE INDEX idx_manager_tasks ON communication_tasks(assigned_to, status, due_at);
CREATE INDEX idx_proposal_client ON proposals(proposal_number, status, valid_until);
CREATE INDEX idx_messages_chat ON messages(sender_type, sender_id, channel, created_at);
```

## Готовые SQL-запросы для аналитики

### История по клиенту

```sql
SELECT
    c.id,
    c.comm_type,
    c.direction,
    c.status,
    c.created_at,
    p.proposal_number,
    p.total_adjusted,
    m.message_text,
    t.task_type
FROM communications c
LEFT JOIN proposals p ON p.communication_id = c.id
LEFT JOIN messages m ON m.communication_id = c.id
LEFT JOIN communication_tasks t ON t.communication_id = c.id
WHERE c.client_id = 123
ORDER BY c.created_at DESC;
```

### Активные предложения

```sql
SELECT
    p.proposal_number,
    p.total_adjusted,
    p.valid_until,
    cl.name AS client_name,
    m.name AS manager_name,
    TIMESTAMPDIFF(HOUR, p.sent_at, NOW()) AS hours_ago
FROM proposals p
JOIN clients cl ON cl.id = p.client_id
JOIN managers m ON m.id = p.created_by
WHERE p.status IN ('sent', 'viewed')
  AND p.valid_until > CURDATE()
ORDER BY p.sent_at;
```

### Задачи на сегодня

```sql
SELECT
    ct.*,
    cl.name AS client_name,
    o.order_number,
    p.proposal_number
FROM communication_tasks ct
LEFT JOIN communications c ON c.id = ct.communication_id
LEFT JOIN clients cl ON cl.id = c.client_id
LEFT JOIN orders o ON o.id = c.order_id
LEFT JOIN proposals p ON p.communication_id = c.id
WHERE ct.assigned_to = 456
  AND ct.status = 'pending'
  AND DATE(ct.due_at) = CURDATE()
ORDER BY ct.priority DESC, ct.due_at;
```

## Преимущества структуры

- Полная история — ни одно действие не теряется.
- Связность — любое сообщение привязано к клиенту и заказу.
- Аналитика — можно отследить воронку: отправлено → просмотрено → согласовано.
- Контроль — все задачи менеджеров фиксируются.
- Шаблоны — быстрые ответы без программиста.
- Масштабирование — можно добавлять любые типы коммуникаций.

⚠️ ОТКРЫТЫЙ ВОПРОС: канал «Макс» упоминается в требованиях к интерфейсу чата и в настройках уведомлений сотрудникам, но в перечислении `channel ENUM('email', 'telegram', 'whatsapp', 'sms', 'internal_chat')` в таблице `messages` он отсутствует. Нужно либо добавить значение `max` в ENUM, либо уточнить, маппится ли «Макс» на одно из существующих значений.

## Источник

Материал собран из следующих фрагментов папки `context/raw`:
- `crm-site-setup.md`, раздел «7. Коммуникации — внутренние и с клиентом» (две ветки чата, каналы, переключение канала, настройка бота, привязка к карточке) и раздел «4. Разделение каналов связи» (Email / Telegram / WhatsApp / телефон / офис).
- `architecture.md`, раздел «Полная структура БД для предложений и коммуникаций» (схема связей; таблицы `communications`, `messages`, `communication_tasks`, `message_templates`, `notifications`; примеры сценариев в чат-центре; индексы и SQL-запросы для аналитики).
- `architecture.md`, строки 12272–12398 — многоканальная отправка КП: каналы и форматы, JSON-структура скорректированного предложения (`adjustedProposal`), три формата документа (PDF / HTML / текст), логика автоматического выбора канала (`selectCommunicationChannel`), гибридная схема отправки и обратная связь от клиента.
