# Управление файлами и макетами

Спецификация подсистемы хранения, жизненного цикла, версионности и согласования файлов и макетов в CRM типографии PrintOffice: классификация по категориям, автоудаление по cron, дедупликация по хешу, статусы согласования с электронной подписью, дублирование файлов клиенту в мессенджеры и структура папок на Яндекс.Диске.

## 1. Классификация файлов и жизненный цикл

Все файлы делятся на четыре категории, определяющие их срок хранения и порядок удаления.

| Категория | Что это | Жизненный цикл | Удаление | Примеры |
|-----------|---------|----------------|----------|---------|
| `temp` (временные) | Файлы от незарегистрированных клиентов, пробные загрузки, неудачные заказы | 24–72 часа | Автоматическое после истечения срока | Клиент загрузил макет, но не оплатил заказ |
| `active` (рабочие) | Файлы, привязанные к активным заказам | От создания заказа до его завершения + 30 дней | После завершения заказа + 30 дней | Макет под печать, файл для согласования |
| `archive` (постоянные) | Файлы для повторного использования | Бессрочно (до ручного удаления) | Вручную менеджером или по достижении лимита | Шаблоны, фирменные стили, макеты постоянных клиентов, макеты для повторных заказов |
| `trash` (удалённые) | Файлы, отмеченные на удаление, но ещё не стёртые | 30 дней в корзине | Окончательное удаление после 30 дней | Все типы файлов, отправленные в корзину |

### Базовые таймеры жизненного цикла

| Параметр | Значение |
|----------|----------|
| Срок жизни временного файла (`tempFileLifetime`) | 72 часа (3 дня) |
| Срок жизни активного файла после завершения заказа (`activeFileLifetime`) | 30 дней |
| Срок хранения в корзине (`trashLifetime`) | 30 дней |

⚠️ ОТКРЫТЫЙ ВОПРОС: для временных файлов в разных местах указаны разные сроки: в классификации «24–72 часа», базовый таймер класса `FileManager` — 72 часа, стратегия хранения для B2C-быстрых заказов — 24 часа, а правило в админке `b2c_fast_temp` — 3 дня (72 часа). Нужно зафиксировать, что 72 часа — это значение по умолчанию, а 24 часа применяется только к B2C-быстрым заказам через правило.

## 2. Структура БД для управления файлами

### 2.1. Основная таблица файлов

```sql
-- Основная таблица файлов
CREATE TABLE files (
    id INT PRIMARY KEY AUTO_INCREMENT,

    -- Основная информация
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,                 -- в байтах
    file_type VARCHAR(100),                 -- mime-type
    file_hash VARCHAR(64),                  -- SHA-256 для поиска дубликатов

    -- Путь в хранилище
    storage_path VARCHAR(500) NOT NULL,     -- путь в S3 или локальной ФС
    storage_type ENUM('local', 's3', 'temp') DEFAULT 's3',

    -- Тип файла по классификации
    file_category ENUM('temp', 'active', 'archive', 'trash') DEFAULT 'temp',

    -- Привязка к сущностям
    entity_type VARCHAR(50),                -- 'order', 'client', 'proposal', 'template'
    entity_id INT,

    -- Метаданные
    uploaded_by INT,                        -- ID пользователя
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP,

    -- Сроки хранения
    expires_at TIMESTAMP,                   -- дата автоматического удаления
    deleted_at TIMESTAMP,                   -- дата перемещения в корзину

    -- Флаги
    is_public BOOLEAN DEFAULT false,        -- доступен ли по прямой ссылке
    is_deleted BOOLEAN DEFAULT false,

    -- Индексы
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_category (file_category),
    INDEX idx_expires (expires_at),
    INDEX idx_hash (file_hash),
    INDEX idx_deleted (is_deleted)
);
```

### 2.2. Связь файлов с заказами (многие-ко-многим)

```sql
CREATE TABLE order_files (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    file_id INT NOT NULL,
    file_role ENUM('maket', 'proof', 'result', 'temp') DEFAULT 'maket',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (file_id) REFERENCES files(id),
    UNIQUE KEY unique_order_file (order_id, file_id)
);
```

### 2.3. Постоянные (сохранённые) файлы

```sql
CREATE TABLE saved_files (
    id INT PRIMARY KEY AUTO_INCREMENT,
    file_id INT NOT NULL,
    client_id INT,                          -- если файл привязан к клиенту
    name VARCHAR(255),                      -- имя для отображения
    description TEXT,
    tags JSON,                              -- для поиска
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (file_id) REFERENCES files(id),
    INDEX idx_client (client_id)
);
```

## 3. Класс управления файлами (FileManager)

Класс отвечает за загрузку, дедупликацию, привязку к сущностям, архивацию и удаление файлов.

```javascript
class FileManager {
    constructor() {
        this.storage = new S3Storage();  // или локальное хранилище
        this.tempFileLifetime = 72 * 60 * 60 * 1000;        // 72 часа (3 дня)
        this.activeFileLifetime = 30 * 24 * 60 * 60 * 1000; // 30 дней после завершения заказа
        this.trashLifetime = 30 * 24 * 60 * 60 * 1000;      // 30 дней в корзине
    }

    /**
     * Загрузка файла
     */
    async uploadFile(file, options) {
        const {
            entityType,
            entityId,
            fileCategory = 'temp',
            expiresIn = this.tempFileLifetime,
            uploadedBy
        } = options;

        // 1. Вычисляем хеш файла (для поиска дубликатов)
        const fileHash = await this.calculateHash(file);

        // 2. Проверяем, есть ли уже такой файл
        const existing = await this.findByHash(fileHash);
        if (existing && existing.file_category === 'archive') {
            // Если файл уже есть в архиве — используем его
            await this.linkToEntity(existing.id, entityType, entityId);
            return existing;
        }

        // 3. Генерируем уникальное имя
        const storagePath = this.generateStoragePath(file, fileHash);

        // 4. Сохраняем в хранилище
        await this.storage.upload(file, storagePath);

        // 5. Сохраняем в БД
        const result = await db.query(`
            INSERT INTO files (
                filename, original_name, file_size, file_type, file_hash,
                storage_path, storage_type, file_category,
                entity_type, entity_id, uploaded_by, expires_at, uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            RETURNING id
        `, [
            this.generateUniqueFilename(file),
            file.originalname,
            file.size,
            file.mimetype,
            fileHash,
            storagePath,
            process.env.STORAGE_TYPE || 's3',
            fileCategory,
            entityType,
            entityId,
            uploadedBy,
            new Date(Date.now() + expiresIn)
        ]);

        const fileId = result.rows[0].id;

        // 6. Если файл для заказа — создаём связь
        if (entityType === 'order') {
            await db.query(`
                INSERT INTO order_files (order_id, file_id, file_role)
                VALUES ($1, $2, $3)
            `, [entityId, fileId, options.fileRole || 'maket']);
        }

        return { id: fileId, storagePath };
    }

    /**
     * Поиск дубликата по хешу
     */
    async findByHash(fileHash) {
        const result = await db.query(`
            SELECT * FROM files
            WHERE file_hash = $1
                AND is_deleted = false
                AND file_category != 'temp'
            LIMIT 1
        `, [fileHash]);

        return result.rows[0];
    }

    /**
     * Привязка существующего файла к сущности
     */
    async linkToEntity(fileId, entityType, entityId) {
        if (entityType === 'order') {
            await db.query(`
                INSERT INTO order_files (order_id, file_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [entityId, fileId]);
        }

        // Обновляем категорию, если была временной
        await db.query(`
            UPDATE files
            SET file_category = 'active',
                entity_type = $1,
                entity_id = $2,
                expires_at = $3
            WHERE id = $4 AND file_category = 'temp'
        `, [entityType, entityId, new Date(Date.now() + this.activeFileLifetime), fileId]);
    }

    /**
     * Перемещение файла в архив (для повторного использования)
     */
    async archiveFile(fileId, options) {
        const { clientId, name, description, tags } = options;

        await db.query(`
            UPDATE files
            SET file_category = 'archive', expires_at = NULL
            WHERE id = $1
        `, [fileId]);

        await db.query(`
            INSERT INTO saved_files (file_id, client_id, name, description, tags, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING
        `, [fileId, clientId, name, description, tags, options.createdBy]);

        return { success: true };
    }

    /**
     * Удаление файла (в корзину)
     */
    async deleteFile(fileId, deletedBy) {
        await db.query(`
            UPDATE files
            SET file_category = 'trash',
                is_deleted = true,
                deleted_at = NOW(),
                expires_at = $1
            WHERE id = $2
        `, [new Date(Date.now() + this.trashLifetime), fileId]);

        // Логируем удаление
        await db.query(`
            INSERT INTO file_deletion_log (file_id, deleted_by, deleted_at)
            VALUES ($1, $2, NOW())
        `, [fileId, deletedBy]);

        return { success: true };
    }

    /**
     * Окончательное удаление файла из хранилища и БД
     */
    async permanentDelete(fileId) {
        const file = await db.query('SELECT * FROM files WHERE id = $1', [fileId]);
        if (file.rows.length === 0) return;

        // Удаляем из хранилища
        await this.storage.delete(file.rows[0].storage_path);

        // Удаляем из БД и связи
        await db.query('DELETE FROM files WHERE id = $1', [fileId]);
        await db.query('DELETE FROM order_files WHERE file_id = $1', [fileId]);
        await db.query('DELETE FROM saved_files WHERE file_id = $1', [fileId]);

        return { success: true };
    }
}
```

## 4. Автоматическая чистка файлов (cron-задачи)

Сервис `FileCleanupService` выполняет четыре задачи очистки.

| Задача | Что делает | Расписание |
|--------|------------|------------|
| `cleanupTempFiles` | Окончательно удаляет временные файлы с истёкшим `expires_at` | Каждый час |
| `cleanupActiveFiles` | Перемещает в архив файлы завершённых заказов старше 30 дней | Ежедневно |
| `cleanupTrash` | Окончательно удаляет файлы из корзины с истёкшим сроком | Ежедневно |
| `deduplicateFiles` | Находит дубликаты по хешу и отправляет лишние копии в корзину | Еженедельно (запускается в составе полной очистки) |

```javascript
class FileCleanupService {
    constructor() {
        this.fileManager = new FileManager();
    }

    /** Очистка временных файлов (каждый час) */
    async cleanupTempFiles() {
        const result = await db.query(`
            SELECT id FROM files
            WHERE file_category = 'temp'
                AND expires_at < NOW()
                AND is_deleted = false
        `);
        for (const file of result.rows) {
            await this.fileManager.permanentDelete(file.id);
        }
    }

    /** Очистка активных файлов после завершения заказа (ежедневно) */
    async cleanupActiveFiles() {
        // Файлы, связанные с завершёнными заказами старше 30 дней
        const result = await db.query(`
            SELECT f.id, f.entity_id
            FROM files f
            JOIN orders o ON o.id = f.entity_id
            WHERE f.file_category = 'active'
                AND f.entity_type = 'order'
                AND o.status = 'completed'
                AND o.completed_at < NOW() - INTERVAL '30 days'
                AND f.is_deleted = false
        `);
        for (const file of result.rows) {
            // Перемещаем в архив, а не удаляем
            await this.fileManager.archiveFile(file.id, {
                name: `Заказ ${file.entity_id}`,
                tags: ['auto-archived', `order_${file.entity_id}`]
            });
        }
    }

    /** Очистка корзины (ежедневно) */
    async cleanupTrash() {
        const result = await db.query(`
            SELECT id FROM files
            WHERE file_category = 'trash'
                AND expires_at < NOW()
        `);
        for (const file of result.rows) {
            await this.fileManager.permanentDelete(file.id);
        }
    }

    /** Проверка на дубликаты (еженедельно) */
    async deduplicateFiles() {
        const result = await db.query(`
            SELECT file_hash, COUNT(*) as count, ARRAY_AGG(id) as ids
            FROM files
            WHERE file_category IN ('archive', 'active')
                AND file_hash IS NOT NULL
                AND is_deleted = false
            GROUP BY file_hash
            HAVING COUNT(*) > 1
        `);
        for (const dup of result.rows) {
            // Оставляем первый файл, остальные — в корзину на 7 дней
            const [firstId, ...restIds] = dup.ids;
            for (const id of restIds) {
                await db.query(`
                    UPDATE files
                    SET file_category = 'trash',
                        expires_at = NOW() + INTERVAL '7 days'
                    WHERE id = $1
                `, [id]);
            }
        }
    }

    /** Запуск всех задач очистки */
    async runAllCleanups() {
        await this.cleanupTempFiles();
        await this.cleanupActiveFiles();
        await this.cleanupTrash();
        await this.deduplicateFiles();
    }
}
```

### Настройка cron-расписания

```javascript
const cron = require('node-cron');

// Каждый час — очистка временных файлов
cron.schedule('0 * * * *', () => {
    const cleanup = new FileCleanupService();
    cleanup.cleanupTempFiles();
});

// Каждый день в 03:00 — полная очистка
cron.schedule('0 3 * * *', () => {
    const cleanup = new FileCleanupService();
    cleanup.runAllCleanups();
});
```

## 5. Дедупликация по хешу (SHA-256)

- При загрузке файла вычисляется его SHA-256-хеш (поле `file_hash`).
- Перед сохранением выполняется поиск дубликата (`findByHash`): ищется файл с тем же хешем, не удалённый и не в категории `temp`.
- Если найден файл в архиве (`archive`) — новый файл не сохраняется, существующий привязывается к сущности через `linkToEntity`.
- Еженедельная задача `deduplicateFiles` находит группы файлов с одинаковым хешем среди `archive`/`active`: оставляет первый (оригинал), остальные копии отправляет в корзину с коротким сроком (7 дней).
- Умное распознавание повторов: при загрузке нового файла система проверяет, не загружали ли этот файл раньше для другого клиента. При совпадении хеша менеджеру предлагается: «Внимание! Этот макет уже использовался в заказе №123. Использовать старую версию?» — это ускоряет повторные заказы.

## 6. Стратегия хранения в зависимости от типа клиента

Класс `FileStorageStrategy` определяет категорию и срок хранения по типу заказа, типу клиента и роли файла.

| Условие | Категория | Срок жизни | Особенность |
|---------|-----------|------------|-------------|
| `orderType = fast` и `clientType = b2c` | `temp` | 24 часа | `autoDelete = true` |
| `clientType = b2b` и `fileRole = maket` | `active` | 90 дней | `autoArchive = true` |
| `fileRole = maket` и `orderType = repeat` | `archive` | бессрочно (`null`) | `suggestArchive = true` |
| По умолчанию | `active` | 30 дней | `autoDelete = true` |

```javascript
class FileStorageStrategy {
    getStorageStrategy(orderType, clientType, fileRole) {
        // B2C быстрые заказы — храним временно
        if (orderType === 'fast' && clientType === 'b2c') {
            return { category: 'temp', lifetime: 24 * 60 * 60 * 1000, autoDelete: true };
        }
        // B2B заказы — храним дольше
        if (clientType === 'b2b' && fileRole === 'maket') {
            return { category: 'active', lifetime: 90 * 24 * 60 * 60 * 1000, autoArchive: true };
        }
        // Постоянные клиенты — предлагаем сохранить в архив
        if (fileRole === 'maket' && orderType === 'repeat') {
            return { category: 'archive', lifetime: null, suggestArchive: true };
        }
        // По умолчанию
        return { category: 'active', lifetime: 30 * 24 * 60 * 60 * 1000, autoDelete: true };
    }
}
```

## 7. Схема жизненного цикла файла

```text
ФАЙЛ ЗАГРУЖЕН (категория: temp, срок: 72 часа)
        │
        ├── Заказ не создан ──────► АВТОУДАЛЕНИЕ через 72 ч (CRON)
        │
        ├── Заказ создан ──────► категория: active
        │         │
        │         └── Заказ выполнен ──► +30 дней ──► ПЕРЕМЕЩЕНИЕ В АРХИВ (автоматически)
        │                                                       │
        └── Сохранён в архив ──────► категория: archive ────────┘
                                            │
                                            ▼
                              КОРЗИНА (ручное удаление, срок: 30 дней)
                                            │
                                            ▼
                              ОКОНЧАТЕЛЬНОЕ УДАЛЕНИЕ (CRON)
```

## 8. Итоговые правила хранения

| Тип файла | Категория | Срок хранения | Что происходит |
|-----------|-----------|---------------|----------------|
| Пробная загрузка | `temp` | 72 часа | Автоудаление |
| Неоплаченный заказ | `active` | 30 дней | Автоудаление |
| Выполненный заказ (B2C) | `active → archive` | 30 дней → 90 дней | Перемещение в архив, потом автоудаление |
| Выполненный заказ (B2B) | `active → archive` | 90 дней → бессрочно | Перемещение в архив, ручное удаление |
| Постоянный макет | `archive` | бессрочно | Ручное удаление |
| Корзина | `trash` | 30 дней | Автоудаление |

## 9. Интерфейс менеджера: управление файлами

Раздел «Управление файлами» содержит блоки:

- **Статистика** — всего файлов, занято места; разбивка по категориям (временные / активные / архив) с числом и объёмом. Пример: «Всего файлов: 12 345 | Занято места: 45.2 GB; Временные: 234 (1.2 GB) | Активные: 8 901 (32.5 GB) | Архив: 3 210 (11.5 GB)».
- **Файлы по заказу** — список файлов с их именем, размером, датой загрузки, типом (макет) и статусом (активный). Действия: Скачать, Предпросмотр, Переместить в архив, Удалить.
- **Сохранённые файлы (архив)** — сгруппированы по клиентам и шаблонам. Действия: Скачать, Использовать, Удалить.
- **Корзина** — файлы будут удалены через 30 дней; показывается дата удаления и число оставшихся дней. Действия: Восстановить, Удалить навсегда.

## 10. Настраиваемые правила файлов в админке (модуль правил)

Правила хранения и отправки файлов настраиваются администратором в админке без участия программиста.

### 10.1. Структура БД для правил файлов

```sql
-- Таблица правил для файлов
CREATE TABLE file_management_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE,
    description TEXT,

    -- Условия применения (JSON)
    conditions JSON NOT NULL,  -- {"client_type": "b2c", "order_type": "fast", "file_role": "maket"}

    -- Действия (JSON)
    actions JSON NOT NULL,     -- {"category": "temp", "lifetime_days": 3, "auto_delete": true}

    -- Приоритет (меньше = выше)
    priority INT DEFAULT 100,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_active (is_active),
    INDEX idx_priority (priority)
);

-- Таблица настроек отправки файлов в мессенджеры
CREATE TABLE file_delivery_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rule_id INT NOT NULL,

    -- Куда отправлять
    channel ENUM('telegram', 'whatsapp', 'email') NOT NULL,

    -- Условия отправки (JSON)
    send_conditions JSON,  -- {"on_status": "completed", "file_size_max_mb": 50}

    -- Настройки
    recipient_type ENUM('client', 'manager', 'both') DEFAULT 'client',
    save_to_chat BOOLEAN DEFAULT true,        -- сохранять в истории чата
    delete_after_send BOOLEAN DEFAULT false,  -- удалять локально после отправки

    is_active BOOLEAN DEFAULT true,

    FOREIGN KEY (rule_id) REFERENCES file_management_rules(id) ON DELETE CASCADE
);
```

### 10.2. Примеры правил

```sql
INSERT INTO file_management_rules (name, code, description, conditions, actions, priority) VALUES
('B2C быстрые заказы', 'b2c_fast_temp', 'Временное хранение для B2C быстрых заказов',
 '{"client_type": "b2c", "order_type": "fast", "file_role": "maket"}',
 '{"category": "temp", "lifetime_days": 3, "auto_delete": true}', 10),

('B2B постоянные клиенты', 'b2b_archive', 'Архивное хранение для B2B постоянных клиентов',
 '{"client_type": "b2b", "is_regular": true, "file_role": "maket"}',
 '{"category": "archive", "lifetime_days": null, "auto_delete": false}', 20),

('Макеты для повторных заказов', 'repeat_order_archive', 'Сохранять макеты для повторных заказов',
 '{"order_type": "repeat", "file_role": "maket"}',
 '{"category": "archive", "lifetime_days": null, "auto_delete": false, "suggest_archive": true}', 15),

('Файлы после завершения заказа', 'completed_archive', 'Перемещать в архив после завершения',
 '{"order_status": "completed", "file_category": "active"}',
 '{"category": "archive", "lifetime_days": 90, "auto_delete": true}', 30);

-- Настройки отправки
INSERT INTO file_delivery_settings (rule_id, channel, send_conditions, recipient_type, save_to_chat) VALUES
(1, 'telegram', '{"on_status": "completed", "file_size_max_mb": 20}', 'client', true),
(1, 'email', '{"on_status": "completed"}', 'client', true),
(2, 'telegram', '{"on_status": "completed", "is_regular": true}', 'both', true);
```

### 10.3. Интерфейс админки (правила файлов)

- **Список правил** — с фильтрами (статус, категория, применяется), у каждого правила отображаются код, приоритет, условия, действия, каналы отправки. Действия: Редактировать, Клонировать, Отключить, Удалить.
- **Редактор правила** содержит блоки:
  - Основные настройки: название, код, описание, приоритет (меньше = выше), флаг «Активно».
  - Условия применения (объединяются по AND): тип клиента, тип заказа, роль файла и др. — каждое условие задаётся как «поле / оператор / значение».
  - Действия: категория хранения, срок хранения в днях (пусто = бессрочно), автоудаление, предлагать архивацию.
  - Отправка файла (дублирование): канал (Telegram / WhatsApp / Email), при каком статусе отправлять, максимальный размер файла (MB), получатель (клиент / менеджер / оба), сохранять в истории чата, удалять локально после отправки.
  - Кнопки: Сохранить правило, Тестировать, Отмена.

## 11. Применение правил (FileRuleEngine)

Движок загружает активные правила, отсортированные по приоритету, и применяет первое подошедшее правило. Если ни одно правило не подошло — применяются действия по умолчанию.

```javascript
class FileRuleEngine {
    constructor() {
        this.rules = [];
        this.deliverySettings = [];
    }

    /** Загрузка активных правил из БД (с настройками отправки) */
    async loadRules() {
        this.rules = await db.query(`
            SELECT * FROM file_management_rules
            WHERE is_active = true
            ORDER BY priority
        `);
        for (const rule of this.rules.rows) {
            rule.delivery = await db.query(`
                SELECT * FROM file_delivery_settings
                WHERE rule_id = $1 AND is_active = true
            `, [rule.id]);
        }
    }

    /** Применение правил к файлу */
    async applyRules(file, context) {
        await this.loadRules();
        const { clientType, orderType, orderStatus, fileRole, isRegularClient } = context;

        let appliedRule = null;
        for (const rule of this.rules.rows) {
            const c = rule.conditions;
            let matches = true;
            if (c.client_type   && c.client_type   !== clientType)      matches = false;
            if (c.order_type    && c.order_type    !== orderType)       matches = false;
            if (c.order_status  && c.order_status  !== orderStatus)     matches = false;
            if (c.file_role     && c.file_role     !== fileRole)        matches = false;
            if (c.is_regular    && c.is_regular    !== isRegularClient) matches = false;
            if (matches) { appliedRule = rule; break; }
        }

        if (appliedRule) return this.applyActions(file, appliedRule, context);
        return this.applyDefaultActions(file, context);
    }

    /** Применение действий правила */
    async applyActions(file, rule, context) {
        const actions = rule.actions;
        // 1. Обновляем категорию и срок хранения
        await db.query(`
            UPDATE files
            SET file_category = $1,
                expires_at = CASE
                    WHEN $2 IS NOT NULL THEN NOW() + ($2 || ' days')::INTERVAL
                    ELSE NULL
                END
            WHERE id = $3
        `, [actions.category, actions.lifetime_days, file.id]);

        // 2. Отправляем файл по каналам
        if (rule.delivery && rule.delivery.rows.length > 0) {
            await this.sendFileToChannels(file, rule.delivery.rows, context);
        }
        // 3. Предлагаем архивацию (если включено)
        if (actions.suggest_archive) {
            await this.suggestArchive(file, context);
        }
        return {
            appliedRule: rule.name,
            category: actions.category,
            lifetime: actions.lifetime_days,
            sentToChannels: rule.delivery.rows.map(d => d.channel)
        };
    }
}
```

## 12. Дублирование файлов клиенту в мессенджеры (страховка)

Назначение: продублировать файл в Telegram / WhatsApp / Email клиента, чтобы он хранился в истории мессенджера на случай, если файл понадобится после удаления его в CRM.

### 12.1. Логика отправки по каналам

```javascript
/** Отправка файла по каналам */
async sendFileToChannels(file, deliverySettings, context) {
    for (const setting of deliverySettings) {
        try {
            // Проверяем размер файла
            if (setting.send_conditions?.file_size_max_mb) {
                const maxSize = setting.send_conditions.file_size_max_mb * 1024 * 1024;
                if (file.file_size > maxSize) continue;  // превышает лимит — пропускаем
            }

            // Определяем получателя
            let recipient = null;
            if (setting.recipient_type === 'client') {
                recipient = context.clientTelegram || context.clientEmail;
            } else if (setting.recipient_type === 'manager') {
                recipient = context.managerTelegram;
            } else if (setting.recipient_type === 'both') {
                await this.sendToChannel(file, setting, { ...context, recipient: context.clientTelegram });
                recipient = context.managerTelegram;
            }

            if (recipient) {
                await this.sendToChannel(file, setting, { ...context, recipient });
            }
            // Удаление локально после отправки (если включено)
            if (setting.delete_after_send) {
                await this.markForDeletion(file.id);
            }
        } catch (error) {
            console.error(`Ошибка отправки файла ${file.id} в ${setting.channel}:`, error);
        }
    }
}

/** Отправка в конкретный канал + лог */
async sendToChannel(file, setting, context) {
    const fileUrl = await this.getFileUrl(file);
    switch (setting.channel) {
        case 'telegram': await this.sendToTelegram(context.recipient, file, fileUrl, context); break;
        case 'whatsapp': await this.sendToWhatsApp(context.recipient, file, fileUrl); break;
        case 'email':    await this.sendToEmail(context.clientEmail, file, fileUrl, context); break;
    }
    await db.query(`
        INSERT INTO file_delivery_log (file_id, channel, recipient, sent_at)
        VALUES ($1, $2, $3, NOW())
    `, [file.id, setting.channel, context.recipient]);
}
```

### 12.2. Реализации методов отправки по каналам

Метод `sendToChannel` (раздел 12.1) диспетчеризует отправку по трём методам: `sendToTelegram`, `sendToWhatsApp`, `sendToEmail`. Ниже приведены реализации Telegram и Email; метод `sendToWhatsApp(recipient, file, fileUrl)` вызывается из `sendToChannel` для канала `whatsapp` (отправка документа через WhatsApp Business API) по той же схеме, что и Telegram.

```javascript
/** Telegram */
async sendToTelegram(chatId, file, fileUrl, context) {
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    const caption = `📎 *Файл к заказу №${context.orderId}*
Имя: ${file.original_name}
Размер: ${(file.file_size / 1024 / 1024).toFixed(2)} MB
Тип: ${file.file_type}
📅 Файл сохранён в истории чата.`;
    await bot.sendDocument(chatId, fileUrl, { caption, parse_mode: 'Markdown' });
}

/** Email */
async sendToEmail(email, file, fileUrl, context) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: 465, secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
        from: 'print@printoffice.ru',
        to: email,
        subject: `Файл к заказу №${context.orderId}`,
        html: `
            <h3>Файл к заказу №${context.orderId}</h3>
            <p><strong>Имя файла:</strong> ${file.original_name}</p>
            <p><strong>Размер:</strong> ${(file.file_size / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Тип:</strong> ${file.file_type}</p>
            <p>Файл прикреплён к этому письму.</p>
        `,
        attachments: [{ filename: file.original_name, path: fileUrl }]
    });
}
```

> Поддерживается также интеграция с мессенджером MAX (упоминается заказчиком как один из каналов дублирования наряду с Telegram, WhatsApp и Email).

### 12.3. Ручная отправка файла из карточки заказа

В карточке заказа у файла есть кнопка «Отправить клиенту», открывающая форму:

- Каналы отправки (множественный выбор): Telegram, WhatsApp, Email.
- Текст сопроводительного сообщения (например, «Ваш макет готов к печати. Пожалуйста, проверьте.»).
- Флаг «Сохранить в истории чата».
- Флаг «Удалить локально после отправки».
- Кнопка «Отправить».

### 12.4. Схема дублирования

```text
ФАЙЛ ЗАГРУЖЕН В CRM
        │
        ▼
ПРИМЕНЯЮТСЯ ПРАВИЛА (из админки)
        │
        ├──► Telegram (клиент)
        ├──► WhatsApp (клиент)
        └──► Email (клиент)
                │
                ▼
ФАЙЛ СОХРАНЁН В ИСТОРИИ ЧАТА
(даже если мы удалим локально)
```

## 13. Итоговые возможности системы

| Функция | Как реализовано |
|---------|-----------------|
| Настройка правил в админке | Визуальный редактор с условиями и действиями |
| Автоматическая категоризация | Правила определяют temp / active / archive |
| Автоматическое удаление | Cron-задачи по `expires_at` |
| Дублирование в мессенджеры | Отправка файлов в Telegram / WhatsApp / Email (+ MAX) |
| Сохранение в истории чата | Файл хранится в истории, даже если удалён локально |
| Предложение архивации | Система предлагает сохранить файл для повторного использования |
| Гибкая настройка | Без программиста, через админку |

## 14. Жизненный цикл и статусы согласования макета

### 14.1. Статусная модель макета

У каждого макета есть статус жизненного цикла:

1. **Черновик** — загружен, но не готов.
2. **На проверке у менеджера** — менеджер смотрит префлайт.
3. **На согласовании с клиентом** — менеджер отправил ссылку клиенту.
4. **Согласован** — финальная версия, утверждена клиентом.
5. **В производстве / В печати** — заблокирован для изменений.

Перевести макет в статус **Согласован** может только клиент — через личный кабинет или по ссылке без пароля, нажав кнопку «Утверждаю». Это юридически значимое действие, которое фиксируется в истории. После согласования возможность замены файла блокируется (без создания новой версии), и заказ может быть отправлен в производство.

Сценарии после отправки макета на согласование:
- **Утверждён** → финальные правки → финальный макет.
- **Нужны правки** → доработка → повторная отправка.
- **Отклонён** → закрытие.

### 14.2. Версионность макетов

Система хранит историю всех версий макета — нельзя просто «перезаписать» файл. Пример: клиент загрузил `макет_v1`, менеджер внёс правки и загрузил `макет_v2`. Система явно показывает: «Версия 1 (от клиента)», «Версия 2 (правки менеджера)». **Согласовывается всегда последняя версия.**

### 14.3. Электронная подпись согласования

Когда клиент нажимает «Утвердить», система фиксирует:

| Параметр | Назначение |
|----------|------------|
| IP-адрес | Идентификация клиента |
| Дата | Фиксация факта |
| Время | Фиксация момента |
| Версия макета | Точная привязка к утверждённому файлу |

Это аргумент в спорной ситуации: «Вы утвердили именно этот файл 15 мая в 14:30».

### 14.4. Привязка к заказу

Каждый файл жёстко привязан к конкретному заказу или позиции заказа (n:1) — нельзя загрузить файл «в никуда». В карточке заказа есть вкладка «Файлы» со всеми макетами по заказу и историей.

### 14.5. Учёт времени дизайнера

- В систему интегрирован таймер, который дизайнер запускает при работе над макетом.
- Время автоматически списывается либо в себестоимость заказа, либо, если правки сложные и платные, идёт в счёт клиенту.
- Пакет услуг «Доработка макета»: если макет не прошёл префлайт или требует сложных правок, система предлагает менеджеру добавить доп. услугу в заказ, например «Доработка макета — 500 ₽».

### 14.6. Сценарий взаимодействия (кратко)

1. Клиент заходит в личный кабинет, видит заказ, нажимает «Загрузить макет», выбирает файл.
2. Система проверяет файл: «Ошибок не найдено. Версия 1.0 загружена» и генерирует ссылку для согласования.
3. Менеджер (или система автоматически) отправляет клиенту ссылку: «Пожалуйста, утвердите макет».
4. Клиент переходит по ссылке, видит водяной знак, нажимает «Утвердить».
5. Система меняет статус на **Согласован**, блокирует замену файла без создания новой версии. Заказ может быть отправлен в производство.

### 14.7. Риски автоматизации согласования

⚠️ ОТКРЫТЫЙ ВОПРОС: автоматическая проверка макета не является панацеей — она может не поймать смысловую ошибку (например, неправильный телефон в макете), поэтому необходимо оставить место для ручного контроля.

⚠️ ОТКРЫТЫЙ ВОПРОС: если заставлять клиента каждый раз регистрироваться в кабинете для утверждения макета, это снизит конверсию. Нужен простой доступ по одноразовой ссылке (без пароля).

## 15. Файлы и Яндекс.Диск

### 15.1. Автоматическая структура папок

При создании заказа CRM создаёт в Яндекс.Диске структуру папок:

```text
/Заказы/2026/Май/290526-1-Л-Г-С_Иванов/
    /01_Исходники_от_клиента/
    /02_Рабочие_макеты/        (общая папка)
    /03_Правки_Паша/           (личная папка дизайнера)
    /04_Готово_к_печати/
```

### 15.2. Доступы (на основе ролей CRM)

Доступы назначаются автоматически по ролям:

| Роль | Доступ |
|------|--------|
| Менеджер заказа | Полный доступ |
| Дизайнер, назначенный на заказ | Доступ к `/02_Рабочие_макеты` и `/03_Правки_...` (запись) |
| Технолог | Чтение `/04_Готово_к_печати` |
| Отгрузчик | Чтение `/04_Готово_к_печати` |

Администратор может создавать роли и назначать им разрешения на папки по маске. Например, роль «Печатник» — доступ к папкам `*/04_Готово_к_печати` только на чтение при статусе заказа «В производстве».

### 15.3. Вкладка «Файлы» в карточке заказа

- Кнопка «Открыть папку на Яндекс.Диске».
- Список файлов с возможностью загрузить новый (синхронизация с диском).
- История изменений: кто, когда, какой файл загрузил или удалил.

## Источник

Материал собран из следующих raw-файлов:

- `raw/crm-site-setup.md`, строки 648–735 — система управления файлами: категории `temp`/`active`/`archive`/`trash`, структура БД (`files`, `order_files`, `saved_files`), класс `FileManager`, cron-задачи `FileCleanupService`, стратегия хранения `FileStorageStrategy`, жизненный цикл файла, итоговые правила хранения, интерфейс менеджера.
- `raw/crm-site-setup.md`, строки 736–818 — настраиваемые правила файлов в админке (`file_management_rules`, `file_delivery_settings`), движок `FileRuleEngine`, дублирование файлов в Telegram/WhatsApp/Email/MAX для страховки, дедупликация, итоговые возможности.
- `raw/crm-site-setup.md`, строки 398–414 — файлы и Яндекс.Диск: автоматическая структура папок, права доступа по ролям, вкладка «Файлы».
- `raw/architecture.md`, строки 1303–1342 — статусная модель и жизненный цикл согласования макета, версионность, электронная подпись согласования, привязка к заказу, учёт времени дизайнера, сценарий взаимодействия и риски автоматизации (дубль с фрагментом 9821–9860 — взят один экземпляр).
