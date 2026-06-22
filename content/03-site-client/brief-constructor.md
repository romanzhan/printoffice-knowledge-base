# Конструктор брифов

Подсистема, позволяющая администратору собирать произвольные анкеты (брифы) из набора полей с условной логикой и валидацией, отправлять их клиенту уникальной ссылкой по нескольким каналам и принимать ответы как через веб-форму, так и через Telegram-бота. Бриф является частью этапа «Дизайн» жизненного цикла заказа (бриф + расчёт стоимости) и реализован как настраиваемый конструктор в админке.

## Концепция

Бриф — это настраиваемая форма-анкета. Администратор создаёт шаблоны без участия программиста, система автоматически генерирует ссылки, рассылает их клиентам и хранит историю заполнения.

Жизненный цикл:

1. **Админка: создание шаблона брифа**
   - Название, описание.
   - Добавление полей (текст, выбор, файлы, чекбоксы и др.).
   - Настройка правил валидации.
   - Настройка логики показа полей (например, если ответ «да» → показать дополнительное поле).
2. **Отправка клиенту**
   - Генерация уникальной ссылки.
   - Отправка в Telegram / Email / Личный кабинет.
3. **Клиент заполняет**
   - В веб-форме по ссылке.
   - В Telegram-боте (интерактивно).
4. **Сохранение**
   - В личном кабинете клиента.
   - В истории заказа у менеджера.
   - Уведомление менеджеру.

### Место в процессе дизайна (full cycle)

Бриф — второй шаг полного цикла дизайна. Этапы:

1. **Запрос на дизайн** (от клиента).
2. **Отправка брифа** (анкета с вопросами).
3. **Заполнение брифа клиентом** (+ референсы, примеры).
4. **Расчёт стоимости дизайна**:
   - сложность;
   - сроки;
   - количество правок.
5. **Согласование и оплата**:
   - счёт на дизайн.
6. **Разработка макета**:
   - 1–3 варианта.
7. **Отправка на согласование** (PDF для утверждения).
8. **Результат согласования** — три исхода:
   - ✅ **УТВЕРЖДЁН** → финальные правки;
   - ⚠️ **НУЖНЫ ПРАВКИ** → доработка (возврат к этапу разработки макета);
   - ❌ **ОТКЛОНЁН** → закрытие.
9. **Финальный макет** (при утверждении):
   - подготовка к печати;
   - проверка препресс.

## Возможности системы

| Функция | Описание |
|---|---|
| Конструктор брифов | Создание любых форм без программиста |
| Типы полей | Текст, выбор, файлы, чекбоксы, дата, число |
| Условная логика | Показывать поля только при определённых ответах |
| Валидация | Проверка email, телефона, обязательных полей |
| Отправка клиенту | Email, Telegram, WhatsApp, ссылка |
| Сохранение истории | В личном кабинете клиента и в CRM менеджера |
| Интеграция с Telegram | Интерактивное заполнение в боте |
| Отслеживание статуса | Отправлен → Просмотрен → Заполнен |

## Структура базы данных

### Бриф дизайна (design_briefs)

Исходная таблица брифа дизайна, привязанная к конкретному заказу и клиенту (часть структуры БД для дизайна). Хранит основную информацию о проекте, контактные данные, сам бриф в JSON и референсы.

```sql
-- Таблица брифов
CREATE TABLE design_briefs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    client_id INT NOT NULL,

    -- Основная информация
    project_name VARCHAR(255),
    product_type VARCHAR(50),              -- 'flyer', 'brochure', 'logo', 'business_card'

    -- Контактные данные
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),

    -- Бриф (JSON)
    brief_data JSON NOT NULL,

    -- Референсы
    references JSON,                        -- массив ссылок на примеры

    -- Статус
    status ENUM('draft', 'sent', 'filled', 'processing', 'completed') DEFAULT 'draft',

    -- Файлы
    attachments JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    filled_at TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);
```

### Версии макетов (design_versions)

Таблица версий макетов дизайна, привязанных к заказу. Хранит номер версии, тип (черновик / правка / финал), файлы, комментарии и статус утверждения.

```sql
-- Таблица версий макетов
CREATE TABLE design_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    version_number INT NOT NULL,

    -- Тип версии
    version_type ENUM('draft', 'revision', 'final') DEFAULT 'draft',

    -- Файлы
    files JSON,                             -- массив файлов (PDF, PNG, исходники)

    -- Комментарии
    comment TEXT,

    -- Статус утверждения
    status ENUM('pending', 'approved', 'rejected', 'revision_needed') DEFAULT 'pending',

    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

### Шаблоны брифов

```sql
CREATE TABLE brief_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    product_type VARCHAR(50),                    -- 'flyer', 'logo', 'brochure'

    -- Структура брифа (JSON)
    form_schema JSON NOT NULL,                   -- поля, их типы, правила

    -- Настройки
    settings JSON,                                -- уведомления, темы и т.д.

    -- Статус
    is_active BOOLEAN DEFAULT true,

    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Экземпляры брифов (для конкретных заказов)

```sql
CREATE TABLE brief_instances (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id INT NOT NULL,
    order_id INT,
    client_id INT NOT NULL,

    -- Уникальная ссылка для клиента
    token VARCHAR(64) UNIQUE NOT NULL,

    -- Данные, заполненные клиентом
    responses JSON,

    -- Файлы, загруженные клиентом
    attachments JSON,

    -- Статус
    status ENUM('draft', 'sent', 'viewed', 'in_progress', 'completed', 'expired') DEFAULT 'draft',

    -- Временные метки
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (template_id) REFERENCES brief_templates(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (client_id) REFERENCES clients(id),

    INDEX idx_token (token),
    INDEX idx_status (status)
);
```

### Уведомления о брифе

```sql
CREATE TABLE brief_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    brief_instance_id INT NOT NULL,
    channel ENUM('email', 'telegram', 'whatsapp') NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status ENUM('sent', 'delivered', 'failed') DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (brief_instance_id) REFERENCES brief_instances(id)
);
```

### История брифов (журнал изменений)

```sql
CREATE TABLE brief_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    brief_instance_id INT NOT NULL,
    action ENUM('created', 'sent', 'viewed', 'started', 'saved', 'completed', 'expired') NOT NULL,
    data JSON,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (brief_instance_id) REFERENCES brief_instances(id)
);
```

⚠️ ОТКРЫТЫЙ ВОПРОС: статусы брифа определены неоднозначно. В таблице `brief_instances` используется набор `draft, sent, viewed, in_progress, completed, expired`, а в исходной таблице проекта дизайна `design_briefs` (см. выше) — другой набор `draft, sent, filled, processing, completed`. В журнале `brief_history` действия: `created, sent, viewed, started, saved, completed, expired`. В итоговой таблице возможностей упрощённая цепочка отслеживания: «Отправлен → Просмотрен → Заполнен». Требуется единая модель статусов.

## Шаблоны брифов (готовые анкеты)

Базовые шаблоны хранятся в виде структуры `BRIEF_TEMPLATES` с разбивкой на секции и поля. Каждое поле описывается атрибутами: `name`, `label`, `type`, `required`, `options`, `placeholder`, `accept`, `multiple`, `min`, `max` и т.д.

```javascript
const BRIEF_TEMPLATES = {
    // Для листовок / флаеров
    flyer: {
        sections: [
            {
                title: "Основная информация",
                fields: [
                    { name: "product_name", label: "Название продукта/акции", type: "text", required: true },
                    { name: "target_audience", label: "Целевая аудитория", type: "text", required: true },
                    { name: "purpose", label: "Цель (информирование, продажа, приглашение)", type: "select", options: ["Информирование", "Продажа", "Приглашение", "Другое"] }
                ]
            },
            {
                title: "Содержание",
                fields: [
                    { name: "headline", label: "Заголовок", type: "text", required: true },
                    { name: "subheadline", label: "Подзаголовок", type: "text" },
                    { name: "body_text", label: "Основной текст", type: "textarea" },
                    { name: "cta", label: "Призыв к действию", type: "text", placeholder: "Позвоните, Закажите, Узнайте..." }
                ]
            },
            {
                title: "Визуальные предпочтения",
                fields: [
                    { name: "color_scheme", label: "Цветовая гамма", type: "select", options: ["Светлая", "Темная", "Яркая", "Сдержанная", "По фирменному стилю"] },
                    { name: "brand_colors", label: "Фирменные цвета (коды)", type: "text", placeholder: "#FFFFFF, #000000" },
                    { name: "style", label: "Стиль", type: "select", options: ["Минимализм", "Классический", "Современный", "Креативный", "Строгий"] },
                    { name: "mood", label: "Настроение", type: "select", options: ["Деловой", "Дружелюбный", "Энергичный", "Спокойный", "Праздничный"] }
                ]
            },
            {
                title: "Логотип и элементы",
                fields: [
                    { name: "has_logo", label: "Есть ли логотип?", type: "boolean" },
                    { name: "logo_file", label: "Логотип (файл)", type: "file", accept: ".ai,.eps,.pdf,.png" },
                    { name: "additional_elements", label: "Дополнительные элементы (иконки, рамки)", type: "textarea" }
                ]
            }
        ]
    },

    // Для логотипов
    logo: {
        sections: [
            {
                title: "Основная информация",
                fields: [
                    { name: "company_name", label: "Название компании", type: "text", required: true },
                    { name: "industry", label: "Сфера деятельности", type: "text", required: true },
                    { name: "tagline", label: "Слоган (если есть)", type: "text" }
                ]
            },
            {
                title: "Визуальные предпочтения",
                fields: [
                    { name: "style", label: "Стиль логотипа", type: "select", options: ["Знак + текст", "Только текст", "Только знак", "Эмблема", "Абстрактный"] },
                    { name: "color_preference", label: "Цвета", type: "text", placeholder: "Назовите предпочтительные цвета" },
                    { name: "forbidden_colors", label: "Цвета, которые не нужно использовать", type: "text" },
                    { name: "fonts", label: "Предпочтения по шрифтам", type: "text", placeholder: "Строгие, рукописные, гротески..." }
                ]
            },
            {
                title: "Контекст использования",
                fields: [
                    { name: "usage", label: "Где будет использоваться логотип?", type: "checkbox", options: ["Сайт", "Печать", "Соцсети", "Вывеска", "Сувенирная продукция"] },
                    { name: "competitors", label: "Ссылки на логотипы конкурентов", type: "textarea", placeholder: "Что нравится/не нравится" }
                ]
            }
        ]
    },

    // Для брошюр
    brochure: {
        sections: [
            {
                title: "Основная информация",
                fields: [
                    { name: "product_name", label: "Название брошюры/каталога", type: "text", required: true },
                    { name: "pages", label: "Количество страниц", type: "number", min: 4, max: 64 },
                    { name: "format", label: "Формат", type: "select", options: ["A4", "A5", "A6"] }
                ]
            },
            {
                title: "Содержание по страницам",
                fields: [
                    { name: "content_structure", label: "Структура содержания", type: "textarea", placeholder: "1 страница — обложка\n2-3 страницы — о компании\n4-5 — услуги..." }
                ]
            },
            {
                title: "Изображения",
                fields: [
                    { name: "provide_images", label: "Предоставляете ли вы изображения?", type: "boolean" },
                    { name: "images", label: "Изображения (файлы)", type: "file", multiple: true },
                    { name: "stock_photos", label: "Нужны ли стоковые фото?", type: "boolean" }
                ]
            }
        ]
    }
};
```

## Админка: конструктор брифов

### Список шаблонов

Экран `ШАБЛОНЫ БРИФОВ` отображает активные шаблоны. По каждому шаблону показываются: системный код, описание, количество полей, число заполнений, количество использований и действия `[РЕДАКТИРОВАТЬ] [КЛОНИРОВАТЬ] [ПРЕДПРОСМОТР] [ОТКЛЮЧИТЬ]`. Доступна кнопка `[ + СОЗДАТЬ ШАБЛОН ]`.

Примеры (метрики иллюстративны):

| Шаблон | Системный код | Поля | Использован | Статус |
|---|---|---|---|---|
| Бриф на листовку | `flyer_brief` | 12 | 45 раз | Активен |
| Бриф на логотип | `logo_brief` | 18 | 23 раза | Активен |
| Бриф на брошюру | `brochure_brief` | 15 | 67 раз | Активен |

### Редактор шаблона: основные настройки

Редактор шаблона имеет три вкладки: **Основные настройки**, **Поля**, **Логика и правила**.

Основные настройки:

- **Название** — отображаемое имя шаблона (например, «Бриф на листовку»).
- **Системный код** (slug) — например, `flyer_brief`.
- **Тип продукции** — например, «Листовка».
- **Описание** — пояснение назначения шаблона.
- Опции (настройки шаблона):
  - Автоудаление через N дней (например, 30).
  - Уведомлять менеджера при заполнении.
  - Сохранять в личном кабинете клиента.
  - Требовать подтверждение перед отправкой.

⚠️ ОТКРЫТЫЙ ВОПРОС: срок жизни брифа указан в двух местах по-разному. Настройка шаблона предлагает «Автоудаление через 30 дней», тогда как срок действия ссылки экземпляра брифа жёстко задан как 7 дней (`expires_at = NOW() + INTERVAL '7 days'`, `expiresIn = 7 * 24 * 60 * 60 * 1000`). Нужно уточнить, как соотносятся срок жизни ссылки (7 дней) и срок автоудаления данных (30 дней).

### Редактор шаблона: вкладка «Поля» (конструктор формы)

Поля добавляются кнопкой `[ + ДОБАВИТЬ ПОЛЕ ]` и могут переупорядочиваться перетаскиванием. У каждого поля доступны действия `[СОХРАНИТЬ] [УДАЛИТЬ] [ДУБЛИРОВАТЬ] [ВВЕРХ] [ВНИЗ]`.

Типы полей и их настройки:

| Тип поля | Тип (код) | Настраиваемые атрибуты |
|---|---|---|
| Текстовое поле | `text` | Метка, Код, Плейсхолдер, Обязательное, Показывать в отчёте |
| Выбор из списка | `select` | Метка, Код, Варианты (список значений), Обязательное |
| Загрузка файла | `file` | Метка, Код, Допустимые форматы, Макс. размер (MB), Обязательное |
| Чекбокс | `checkbox` | Метка, Код, Текст чекбокса |

Примеры конфигурации полей:

- **Текстовое поле:** Метка «Название компании», Код `company_name`, Тип `text`, Плейсхолдер «Например, ООО "Ромашка"», Обязательное — да, Показывать в отчёте — да.
- **Выбор из списка:** Метка «Тип продукции», Код `product_type`, Тип `select`, Варианты: Листовка / Визитка / Брошюра / Наклейка, Обязательное — да.
- **Загрузка файла:** Метка «Загрузить логотип», Код `logo_file`, Тип `file`, Допустимые форматы `.ai, .eps, .pdf, .png, .jpg`, Макс. размер 20 MB, Обязательное — нет.
- **Чекбокс:** Метка «Есть фирменный стиль?», Код `has_brand_style`, Тип `checkbox`, Текст чекбокса «Да, у нас есть фирменный стиль».

Полный набор типов полей: текст, выбор, файлы, чекбоксы, дата, число.

### Редактор шаблона: вкладка «Логика и правила»

#### Условная логика

Поля могут отображаться только при определённых ответах. Правило добавляется кнопкой `[ + ДОБАВИТЬ ПРАВИЛО ]`, формат: «ЕСЛИ [поле] [оператор] [значение] ТО ПОКАЗАТЬ поле(я) [...]».

Примеры:

- ЕСЛИ `Есть фирменный стиль?` равно `Да` ТО ПОКАЗАТЬ поле `Загрузить файл стиля`.
- ЕСЛИ `Тип продукции` равно `Брошюра` ТО ПОКАЗАТЬ поля `Количество страниц`, `Тип переплёта`.

#### Правила валидации

Правила проверки ответов, каждое с собственным сообщением об ошибке.

Примеры:

- Поле `Название компании` не может быть пустым. Сообщение: «Пожалуйста, укажите название компании».
- Поле `Email` должно быть корректным email-адресом. Сообщение: «Введите корректный email».

Поддерживается проверка email, телефона и обязательных полей.

## Отправка брифа клиенту

### Интерфейс менеджера

Из карточки заказа (`ЗАКАЗ №12345 | Клиент: ООО "Ромашка"`) менеджер:

1. Выбирает шаблон брифа (например, «Бриф на листовку», «Бриф на логотип», «Бриф на брошюру»).
2. Выбирает каналы отправки (можно несколько одновременно):
   - **Email** — например, `client@example.com`.
   - **Telegram** — например, `@client_username`.
   - **WhatsApp** — например, `+7 999 123 45 67`.
3. При необходимости вводит сопроводительное сообщение (например: «Для ускорения работы, пожалуйста, заполните бриф. Ссылка действительна 7 дней.»).
4. Нажимает `[ ОТПРАВИТЬ БРИФ ]`.

### История отправок

В карточке заказа ведётся журнал событий брифа, например:

```
15.03.2026 14:30 | Отправлен бриф "Бриф на листовку" (Email, Telegram)
15.03.2026 15:45 | Клиент открыл ссылку
16.03.2026 10:20 | Клиент начал заполнение
16.03.2026 11:30 | Бриф заполнен и отправлен
```

### Сообщение клиенту (Telegram / Email)

Пример текста уведомления:

```
📋 НОВЫЙ БРИФ ОТ ТИПОГРАФИИ

Здравствуйте!

Для оформления заказа №12345 нам нужно заполнить небольшой бриф.

🔗 Ссылка на бриф:
https://printoffice.ru/brief/f7e8d9a0c1b2

⏰ Ссылка действительна 7 дней.

Если у вас есть вопросы — напишите нам.

—
Типография PrintOffice
```

## Интерфейс брифа для клиента (пример заполнения)

Базовый интерфейс брифа на дизайн (`БРИФ НА ДИЗАЙН`, продукт «Листовка») с примером заполненных значений по секциям шаблона `flyer`:

- **📝 Основная информация:**
  - Название продукта/акции: «Летняя распродажа 2026».
  - Целевая аудитория: «Молодежь 18-25 лет».
  - Цель: «Продажа».
- **📄 Содержание:**
  - Заголовок: «Скидка 50% на всё!».
  - Подзаголовок: «Только до 31 августа».
  - Основной текст: «В нашем магазине стартовала летняя распродажа...».
  - Призыв к действию: «Успейте купить!».
- **🎨 Визуальные предпочтения:**
  - Цветовая гамма: «Яркая».
  - Фирменные цвета: `#FF6600, #FFFFFF`.
  - Стиль: «Современный».
  - Настроение: «Энергичный».
- **🖼️ Логотип и элементы:**
  - чекбокс `[✓] Есть логотип`;
  - Логотип: «Файл не выбран» `[ ВЫБРАТЬ ]`;
  - Дополнительные элементы: «Иконки скидок, звёздочки».
- **📎 Референсы (примеры того, что нравится):** `[ + ДОБАВИТЬ ССЫЛКУ ]`, например:
  - `https://www.behance.net/gallery/123456/Пример-листовки`;
  - `https://pinterest.com/pin/987654/Пример-2`.

Действия внизу формы: `[ ОТПРАВИТЬ БРИФ ]` и `[ СОХРАНИТЬ ЧЕРНОВИК ]`.

## Страница брифа для клиента (веб)

Страница `БРИФ НА ЛИСТОВКУ` привязана к заказу (`Заказ №12345 | Типография PrintOffice`) и содержит:

- **Индикатор прогресса заполнения** — например, «25% (3 из 12 полей)» с прогресс-баром.
- Секции с полями, в т.ч.:
  - **Основная информация:** Название компании, Контактное лицо, Email, Телефон.
  - **Параметры продукции:** Тип продукции, Формат, Количество страниц, Тираж.
  - **Визуальные предпочтения:** чекбокс «У нас есть фирменный стиль» (при включении показывается блок загрузки файлов стиля — логотип, фирменные цвета, шрифты; допустимые форматы `.ai, .eps, .pdf, .png, .jpg` до 20 MB), Цветовая гамма, Фирменные цвета, Стиль.
  - **Содержание:** Заголовок, Подзаголовок, Основной текст, Призыв к действию.
  - **Референсы (что нравится):** добавление ссылок кнопкой `[ + ДОБАВИТЬ ССЫЛКУ ]` (например, ссылки Behance, Pinterest).
  - **Комментарий:** свободный текст (например: «Хотелось бы сделать яркий дизайн, привлекающий внимание.»).
- Действия внизу страницы: `[ СОХРАНИТЬ ЧЕРНОВИК ]` и `[ ОТПРАВИТЬ БРИФ ]`.

Поведение визуального блока «фирменный стиль» реализует условную логику: блок загрузки файлов появляется только при отмеченном чекбоксе.

## Личный кабинет клиента (история брифов)

В разделе `ИСТОРИЯ БРИФОВ` отображаются брифы по заказам с их статусами. Примеры:

- Заказ №12345, ООО «Ромашка» — «Бриф на листовку», статус «Заполнен» (заполнен 16.03.2026 11:30). Действия: `[ ПРОСМОТРЕТЬ ОТВЕТЫ ]`, `[ СКАЧАТЬ PDF ]`.
- Заказ №12344, ИП Иванов — «Бриф на логотип», статус «В процессе (60% заполнено)». Действие: `[ ПРОДОЛЖИТЬ ЗАПОЛНЕНИЕ ]`.

## Генерация и серверная логика (BriefManager)

Класс `BriefManager` отвечает за генерацию ссылок, создание экземпляров, рассылку и приём ответов.

Ключевые правила:

- Токен ссылки генерируется как `crypto.randomBytes(32).toString('hex')`.
- URL брифа: `https://printoffice.ru/brief/{token}`.
- Срок жизни ссылки: 7 дней.

```
expiresIn = 7 * 24 * 60 * 60 * 1000   // 7 дней в миллисекундах
expires_at = NOW() + INTERVAL '7 days'  // на стороне БД
```

```javascript
class BriefManager {
    constructor() {
        this.briefTemplates = [];
    }

    /** Генерация уникальной ссылки для брифа */
    generateBriefLink(orderId, templateId, clientId) {
        const token = crypto.randomBytes(32).toString('hex');
        return {
            url: `https://printoffice.ru/brief/${token}`,
            token: token,
            expiresIn: 7 * 24 * 60 * 60 * 1000  // 7 дней
        };
    }

    /** Создание экземпляра брифа */
    async createBriefInstance(orderId, templateId, clientId, channels) {
        const { url, token, expiresIn } = this.generateBriefLink(orderId, templateId, clientId);

        const brief = await db.query(`
            INSERT INTO brief_instances
            (template_id, order_id, client_id, token, status, sent_at, expires_at)
            VALUES ($1, $2, $3, $4, 'sent', NOW(), NOW() + INTERVAL '7 days')
            RETURNING id
        `, [templateId, orderId, clientId, token]);

        const briefId = brief.rows[0].id;

        // Отправляем клиенту
        await this.sendBriefToClient(briefId, channels);

        return { briefId, url };
    }

    /** Отправка брифа клиенту по выбранным каналам */
    async sendBriefToClient(briefId, channels) {
        const brief = await db.query(`
            SELECT bi.*, bt.name, bt.product_type, c.email, c.telegram, c.phone
            FROM brief_instances bi
            JOIN brief_templates bt ON bt.id = bi.template_id
            JOIN clients c ON c.id = bi.client_id
            WHERE bi.id = $1
        `, [briefId]);

        const data = brief.rows[0];
        const briefUrl = `https://printoffice.ru/brief/${data.token}`;

        for (const channel of channels) {
            if (channel === 'email' && data.email) {
                await this.sendBriefEmail(data.email, briefUrl, data.name);
                await this.logNotification(briefId, 'email', data.email);
            }
            if (channel === 'telegram' && data.telegram) {
                await this.sendBriefTelegram(data.telegram, briefUrl, data.name);
                await this.logNotification(briefId, 'telegram', data.telegram);
            }
        }
    }

    /** Получение брифа по токену (только не истёкшие) */
    async getBriefByToken(token) {
        const brief = await db.query(`
            SELECT bi.*, bt.form_schema, bt.name, bt.description,
                   o.order_number, c.name as client_name
            FROM brief_instances bi
            JOIN brief_templates bt ON bt.id = bi.template_id
            JOIN orders o ON o.id = bi.order_id
            JOIN clients c ON c.id = bi.client_id
            WHERE bi.token = $1 AND bi.status != 'expired'
        `, [token]);

        if (brief.rows.length === 0) {
            throw new Error('Бриф не найден или истек срок действия');
        }
        return brief.rows[0];
    }

    /** Сохранение ответов клиента */
    async saveBriefResponses(token, responses, attachments) {
        const brief = await db.query(`
            UPDATE brief_instances
            SET responses = $1, attachments = $2,
                status = 'completed', completed_at = NOW()
            WHERE token = $3 AND status != 'expired'
            RETURNING id, order_id, client_id
        `, [JSON.stringify(responses), JSON.stringify(attachments), token]);

        if (brief.rows.length === 0) {
            throw new Error('Бриф не найден');
        }

        // Уведомляем менеджера
        await this.notifyManager(brief.rows[0].order_id, 'Бриф заполнен');

        return { success: true };
    }
}
```

⚠️ ОТКРЫТЫЙ ВОПРОС: в коде `sendBriefToClient` обрабатываются только каналы `email` и `telegram`, хотя в интерфейсе менеджера и в таблице `brief_notifications` предусмотрен также `whatsapp`. Отправка по WhatsApp не реализована в серверной логике — требуется доработка.

## Интеграция с Telegram-ботом

Telegram-бот поддерживает два сценария: отправку ссылки на веб-форму и полностью интерактивное пошаговое заполнение прямо в чате (бот задаёт вопросы по очереди по полям из `form_schema`, накапливая ответы в сессии).

```javascript
class TelegramBriefHandler {
    /** Отправка брифа в Telegram (ссылка + inline-кнопки) */
    async sendBrief(chatId, briefUrl, briefName) {
        const keyboard = {
            inline_keyboard: [
                [{ text: "📋 ЗАПОЛНИТЬ БРИФ", url: briefUrl }],
                [{ text: "❓ Задать вопрос", callback_data: "help" }]
            ]
        };

        await bot.sendMessage(chatId, `📋 *Новый бриф: ${briefName}*
Для оформления заказа нам нужно заполнить небольшой бриф.
🔗 Нажмите на кнопку ниже, чтобы открыть форму.
⏰ Ссылка действительна 7 дней.`,
            { reply_markup: keyboard, parse_mode: 'Markdown' });
    }

    /** Интерактивное заполнение брифа в Telegram (старт) */
    async startBriefInTelegram(chatId, briefId) {
        const brief = await db.query(`
            SELECT * FROM brief_instances WHERE id = $1
        `, [briefId]);

        const schema = brief.rows[0].form_schema;
        const firstField = schema.fields[0];

        // Сохраняем состояние сессии
        await this.setSession(chatId, {
            briefId: briefId,
            step: 0,
            answers: {}
        });

        await bot.sendMessage(chatId,
            `📋 *${firstField.label}*\n\n${firstField.placeholder || 'Введите ответ:'}`,
            { parse_mode: 'Markdown' });
    }

    /** Обработка ответов в Telegram (пошагово) */
    async handleBriefAnswer(chatId, message) {
        const session = await this.getSession(chatId);
        if (!session || !session.briefId) return;

        const brief = await db.query(`
            SELECT * FROM brief_instances WHERE id = $1
        `, [session.briefId]);

        const schema = brief.rows[0].form_schema;
        const currentField = schema.fields[session.step];

        // Сохраняем ответ
        session.answers[currentField.code] = message.text;

        // Переходим к следующему полю
        session.step++;

        if (session.step >= schema.fields.length) {
            // Бриф завершен
            await this.completeBrief(session.briefId, session.answers);
            await bot.sendMessage(chatId, '✅ Спасибо! Бриф успешно заполнен. Менеджер свяжется с вами.');
            await this.clearSession(chatId);
        } else {
            const nextField = schema.fields[session.step];
            await bot.sendMessage(chatId,
                `📋 *${nextField.label}*\n\n${nextField.placeholder || 'Введите ответ:'}`,
                { parse_mode: 'Markdown' });
            await this.saveSession(chatId, session);
        }
    }
}
```

## Статусы брифа

Полный набор статусов экземпляра брифа (поле `status` таблицы `brief_instances`):

| Статус | Значение |
|---|---|
| `draft` | Черновик (создан, не отправлен) |
| `sent` | Отправлен клиенту |
| `viewed` | Просмотрен (клиент открыл ссылку) |
| `in_progress` | В процессе заполнения |
| `completed` | Заполнен и отправлен |
| `expired` | Истёк срок действия |

Действия журнала `brief_history`: `created`, `sent`, `viewed`, `started`, `saved`, `completed`, `expired`.

Упрощённая цепочка отслеживания для отчётности: **Отправлен → Просмотрен → Заполнен**.

См. также открытый вопрос о расхождении наборов статусов в разделе «Структура базы данных».

## Источник

- `raw/crm-site-setup.md`, строки 819–959 — раздел «Процесс дизайна» и доработка «Бриф как настраиваемый конструктор в админке + отправка клиенту»: общая схема процесса дизайна (полный цикл с ветвлением утверждён / нужны правки / отклонён и финальным макетом → препресс), структура БД (`design_briefs`, `design_versions`, `brief_templates`, `brief_instances`, `brief_notifications`, `brief_history`), шаблоны брифов (`BRIEF_TEMPLATES`), интерфейс брифа для клиента с примером заполнения (раздел 4), конструктор брифов в админке (список шаблонов, вкладки «Основные настройки», «Поля», «Логика и правила»), отправка ссылкой по каналам Email/Telegram/WhatsApp (жизнь ссылки 7 дней), сообщение клиенту, страница брифа (раздел 5, с примером комментария), личный кабинет клиента, класс `BriefManager`, интеграция с Telegram (`TelegramBriefHandler`), итоговая таблица возможностей и статусы.
- `raw/architecture.md`, строки 112–114 — обзорные пункты: детализация этапа «Дизайн (бриф, расчёт стоимости)» и доработка «Бриф как настраиваемый конструктор в админке + отправка клиенту».
