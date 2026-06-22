# Производственный модуль

Производственный модуль превращает CRM из «калькулятора» в инструмент реального планирования: ведёт производственный календарь и загрузку оборудования, генерирует технические задания для участков, собирает обратную связь с производства (факт vs расчёт, брак, простои, комментарии) и на её основе самообучается, корректируя нормативы и формулы.

## Состав модуля (что спроектировано)

| Компонент | Описание | Статус |
|---|---|---|
| Планирование загрузки | Календари оборудования, расчёт доступных слотов, приоритезация, автоперепланирование при сбоях | Готово |
| Обратная связь | Фактическое время, расход материалов, простои, брак | Готово |
| Производственные комментарии | Адресные сообщения для печатников, резчиков, операторов плоттера | Готово |
| Самообучение | Корректировка формул на основе реальных данных, версионирование нормативов | Готово |
| ТЗ для участков | Генерация детальных заданий (печатник / резчик / оператор плоттера) | Готово |

Полный производственный цикл, реализуемый модулем:

```
Расчёт → Планирование → Выполнение → Анализ → Корректировка
```

Система становится точнее с каждым выполненным заказом.

---

## 1. Производственный календарь и планировщик загрузки

### 1.1. Понятие производственного календаря

Производственный календарь описывает участки, оборудование и режим их работы.

```
ПРОИЗВОДСТВЕННЫЙ КАЛЕНДАРЬ

УЧАСТОК 1: Печатный цех
├── Konica C6085 (доступность, загрузка, плановые ТО)
├── Konica C3070L
└── Смены: 2 смены по 8 часов

УЧАСТОК 2: Послепечатка
├── Резак Boway (загрузка, очереди)
├── Плоттер Mimaki
├── Ламинатор
└── Смены: 1 смена

УЧАСТОК 3: Упаковка и отгрузка
└── Ручной труд
```

### 1.2. Архитектура системы планирования

Планирование строится из четырёх уровней:

```
УРОВЕНЬ 1: Календари
├── Глобальный календарь (праздники, выходные)
├── Календари участков (смены, перерывы)
└── Календари оборудования (ТО, ремонты)

УРОВЕНЬ 2: Загрузка
├── Текущие заказы (в работе)
├── Запланированные заказы
└── Очереди на оборудование

УРОВЕНЬ 3: Расчёт сроков
├── С учётом загрузки
├── С учётом приоритетов
└── С учётом параллельных операций

УРОВЕНЬ 4: Интерфейсы
├── Для менеджера (сроки клиенту)
├── Для производства (задания по часам)
└── Для администратора (загрузка цехов)
```

### 1.3. Структура БД производственного календаря

```sql
-- 1. Календари (рабочее время)
CREATE TABLE production_calendars (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,                    -- "Основной календарь типографии"
    type ENUM('global', 'department', 'equipment') DEFAULT 'global',
    entity_id INT,                                 -- ID отдела или оборудования (если type = equipment)
    -- Параметры календаря
    work_days JSON,                                -- [1,2,3,4,5] (пн-пт)
    work_hours_start TIME DEFAULT '09:00:00',
    work_hours_end TIME DEFAULT '18:00:00',
    break_hours JSON,                              -- [{"start": "13:00", "end": "14:00"}]
    -- Часовой пояс
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_entity (type, entity_id)
);

-- 2. Исключения (праздники, ремонты, ТО)
CREATE TABLE calendar_exceptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    calendar_id INT NOT NULL,
    exception_type ENUM('holiday', 'maintenance', 'breakdown', 'custom') NOT NULL,
    name VARCHAR(255),                             -- "Новый год", "Плановое ТО"
    -- Период
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,                               -- NULL = весь день
    end_time TIME,
    -- Влияние на доступность
    availability ENUM('closed', 'reduced', 'custom') DEFAULT 'closed',
    custom_hours JSON,                             -- если reduced, можно задать часы
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (calendar_id) REFERENCES production_calendars(id),
    INDEX idx_dates (start_date, end_date)
);

-- 3. Смены и сотрудники
CREATE TABLE production_shifts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    department_id INT,                             -- ID участка
    name VARCHAR(100),                             -- "Смена А", "Смена Б"
    -- Расписание смены
    shift_type ENUM('day', 'night', 'custom') DEFAULT 'day',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    -- Сотрудники в смене
    employees JSON,                                -- [1,2,3] ID сотрудников
    is_active BOOLEAN DEFAULT true,
    valid_from DATE,
    valid_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Запланированные задачи (основная таблица)
CREATE TABLE production_schedule (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    equipment_id INT NOT NULL,
    -- Тип задачи
    task_type ENUM('printing', 'cutting_guillotine', 'cutting_plotter',
                   'lamination', 'binding', 'packaging') NOT NULL,
    -- Временные параметры
    planned_duration_minutes INT NOT NULL,         -- расчётное время
    setup_time_minutes INT DEFAULT 0,              -- время на настройку
    -- Статус в планировании
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'delayed') DEFAULT 'scheduled',
    -- Приоритет (для очереди)
    priority INT DEFAULT 100,                      -- меньше = выше приоритет
    -- Запланированные даты
    scheduled_start TIMESTAMP NULL,
    scheduled_end TIMESTAMP NULL,
    actual_start TIMESTAMP NULL,
    actual_end TIMESTAMP NULL,
    -- Зависимости (операции, которые должны быть выполнены до)
    dependencies JSON,                             -- [id_задачи1, id_задачи2]
    -- Кто назначил
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (equipment_id) REFERENCES equipment_models(id),
    INDEX idx_equipment_status (equipment_id, status, scheduled_start),
    INDEX idx_order (order_id),
    INDEX idx_dates (scheduled_start, scheduled_end)
);

-- 5. Очереди на оборудование
CREATE TABLE equipment_queues (
    id INT PRIMARY KEY AUTO_INCREMENT,
    equipment_id INT NOT NULL,
    task_id INT NOT NULL,
    queue_position INT,                            -- позиция в очереди
    estimated_start TIMESTAMP,                     -- расчётное время начала
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment_models(id),
    FOREIGN KEY (task_id) REFERENCES production_schedule(id),
    INDEX idx_equipment_queue (equipment_id, queue_position)
);

-- 6. История простоев
CREATE TABLE equipment_downtime (
    id INT PRIMARY KEY AUTO_INCREMENT,
    equipment_id INT NOT NULL,
    downtime_type ENUM('breakdown', 'maintenance', 'no_materials', 'no_operator', 'other') NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INT,                          -- вычисляется при end_time
    reason TEXT,
    reported_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment_models(id),
    INDEX idx_equipment_dates (equipment_id, start_time, end_time)
);
```

### 1.4. Класс планировщика производства

Класс `ProductionScheduler` отвечает за загрузку календарей, расчёт доступного времени оборудования, планирование заказов, поиск свободных слотов с учётом приоритетов и визуализацию загрузки.

Ключевые методы:

- `loadCalendars()` — загружает все активные календари (`production_calendars` + `calendar_exceptions`).
- `calculateAvailableTime(equipmentId, startDate, endDate)` — строит сетку доступного времени: берёт календарь оборудования, уже запланированные задачи (`status IN ('scheduled','in_progress')`), исключения (ремонты/праздники) и формирует список свободных слотов с учётом рабочих дней и часов.
- `scheduleOrder(order, priority = 100)` — последовательно планирует все операции заказа: подбирает доступное оборудование, рассчитывает длительность операции, находит свободный слот, создаёт задачу в `production_schedule`. Следующая операция начинается после окончания предыдущей. По завершении обновляет заказ (`scheduled_completion`, `status = 'scheduled'`).
- `findFreeSlot(equipmentId, startFrom, durationMinutes, priority)` — ищет свободный слот с учётом очереди и приоритетов. Если время занято, но приоритет новой задачи выше (число меньше) приоритета конфликтующей — конфликтующая задача переносится (`rescheduleTask` на `scheduled_end + 30 минут`).
- `calculateCompletionDate(order)` — рассчитывает дату готовности заказа для клиента и добавляет буфер на непредвиденные обстоятельства.
- `isWorkingTime(calendar, date)` — проверка рабочего времени с учётом рабочих дней, рабочих часов и перерывов.
- `getEquipmentLoadView(equipmentId, startDate, endDate)` — строит тепловую карту загрузки по дням с процентом загрузки.

Параметры расчёта:

- **Буфер на непредвиденные обстоятельства** при расчёте даты готовности: `bufferHours = 4` (4 часа).
- **Сдвиг при перепланировании** конфликтующей задачи: `+30 минут` после её окончания.

```javascript
class ProductionScheduler {
    constructor() {
        this.calendars = {};
        this.tasks = [];
    }

    // Инициализация календарей
    async loadCalendars() {
        const calendars = await db.query(`
            SELECT pc.*, ce.*
            FROM production_calendars pc
            LEFT JOIN calendar_exceptions ce ON ce.calendar_id = pc.id
            WHERE pc.is_active = true
        `);
        for (const cal of calendars) {
            this.calendars[cal.id] = cal;
        }
    }

    // Планирование нового заказа
    async scheduleOrder(order, priority = 100) {
        const operations = await this.getOrderOperations(order);
        const scheduledTasks = [];
        let currentDate = new Date();

        for (const op of operations) {
            const availableEquipment = await this.findAvailableEquipment(op, currentDate);
            if (!availableEquipment) {
                throw new Error(`Нет доступного оборудования для операции ${op.type} в ближайшее время`);
            }
            const duration = await this.calculateOperationDuration(op, order);
            const slot = await this.findFreeSlot(availableEquipment.id, currentDate, duration, priority);
            const task = await this.createScheduledTask({
                orderId: order.id,
                equipmentId: availableEquipment.id,
                taskType: op.type,
                duration,
                scheduledStart: slot.start,
                scheduledEnd: slot.end,
                priority,
                dependencies: op.dependencies
            });
            scheduledTasks.push(task);
            currentDate = slot.end; // следующая операция после этой
        }

        await db.query(
            'UPDATE orders SET scheduled_completion = $1, status = $2 WHERE id = $3',
            [currentDate, 'scheduled', order.id]
        );
        return { orderId: order.id, scheduledCompletion: currentDate, tasks: scheduledTasks };
    }

    // Поиск свободного слота с учётом очереди и приоритетов
    async findFreeSlot(equipmentId, startFrom, durationMinutes, priority) {
        const scheduled = await db.query(`
            SELECT * FROM production_schedule
            WHERE equipment_id = $1
                AND status IN ('scheduled', 'in_progress')
                AND scheduled_end >= $2
            ORDER BY scheduled_start, priority
        `, [equipmentId, startFrom]);

        const calendar = await this.getEquipmentCalendar(equipmentId);
        let currentSlot = new Date(startFrom);

        while (true) {
            if (!this.isWorkingTime(calendar, currentSlot)) {
                currentSlot = this.nextWorkingTime(calendar, currentSlot);
                continue;
            }
            const conflicting = scheduled.find(task =>
                task.scheduled_start <= this.addMinutes(currentSlot, durationMinutes) &&
                task.scheduled_end >= currentSlot
            );
            if (!conflicting) {
                return { start: currentSlot, end: this.addMinutes(currentSlot, durationMinutes) };
            }
            // Если приоритет выше — сдвигаем менее приоритетную задачу
            if (priority < conflicting.priority) {
                await this.rescheduleTask(conflicting.id, this.addMinutes(conflicting.scheduled_end, 30));
                return { start: currentSlot, end: this.addMinutes(currentSlot, durationMinutes) };
            }
            currentSlot = conflicting.scheduled_end;
        }
    }

    // Расчёт даты выполнения для клиента (с буфером)
    async calculateCompletionDate(order) {
        const scheduled = await this.scheduleOrder(order);
        const bufferHours = 4;
        const completionWithBuffer = new Date(scheduled.scheduledCompletion);
        completionWithBuffer.setHours(completionWithBuffer.getHours() + bufferHours);
        return {
            plannedDate: scheduled.scheduledCompletion,
            guaranteedDate: completionWithBuffer,
            workingDays: await this.calculateWorkingDays(order.created_at, completionWithBuffer)
        };
    }
}
```

Формула загрузки дня в визуализации:

```
loadPercent = totalMinutes / availableMinutes * 100
availableMinutes = work_hours_end - work_hours_start (в минутах)
```

### 1.5. Интерфейс планировщика (календарь загрузки)

Для администратора/мастера выводится календарь загрузки по выбранному участку и оборудованию с тепловой картой загрузки по дням и детализацией по часам.

```
ПЛАНИРОВЩИК ПРОИЗВОДСТВА
Участок: [ Печатный цех ▼ ]  Оборудование: [ Konica C6085 ▼ ]
Период: [ Март 2026 ▼ ]

 Пн 10     Вт 11     Ср 12     Чт 13     Пт 14     Сб 15
 ██████    ██████    ██████    ██████    ██████    ░░░░░░
 Заказ123  Заказ124  Заказ125  Заказ126  Заказ127  Выходной
   80%       85%       75%       90%       70%

ДЕТАЛИ НА 11.03.2026:
 08:00 - 09:00 │ Плановое ТО
 09:00 - 11:30 │ Заказ 124: Листовки А4, 5000 шт
 11:30 - 12:00 │ Перерыв
 12:00 - 14:30 │ Заказ 128: Наклейки, 1000 шт
 14:30 - 15:00 │ Свободно
 15:00 - 17:00 │ Заказ 129: Брошюры, 200 шт

[ + НОВЫЙ ЗАКАЗ ] [ ПЕРЕПЛАНИРОВАТЬ ] [ ОТЧЁТЫ ]
```

### 1.6. Интерфейс менеджера: расчёт сроков

При расчёте сроков менеджер видит текущую загрузку оборудования, ближайшие свободные слоты и варианты планирования с разными приоритетами.

```
РАСЧЁТ СРОКОВ ВЫПОЛНЕНИЯ
Заказ: Листовки А5, 5000 шт

ТЕКУЩАЯ ЗАГРУЗКА:
 Оборудование    │ Загрузка │ Ближайший слот
 Konica C6085    │ 85%      │ 13.03.2026 09:00
 Резак Boway     │ 60%      │ 12.03.2026 14:00
 Плоттер Mimaki  │ 30%      │ 11.03.2026 15:00

ВАРИАНТЫ ПЛАНИРОВАНИЯ:
 ● Приоритет: срочный (1.5×)
   Печать: 13.03 09:00 | Резка: 13.03 14:00 | Готово: 13.03 18:00 (сегодня-завтра)
 ○ Приоритет: обычный
   Печать: 14.03 09:00 | Резка: 15.03 10:00 | Готово: 15.03 14:00
 ○ Приоритет: эконом
   Печать: 16.03 09:00 | Резка: 17.03 11:00 | Готово: 17.03 15:00

ВЫБРАННЫЙ ВАРИАНТ: Срочный
Дата готовности: 13.03.2026 18:00
(с учётом буфера 4ч: 14.03.2026 10:00)

[ ПОДТВЕРДИТЬ КЛИЕНТУ ] [ ИЗМЕНИТЬ ПРИОРИТЕТ ]
```

Соответствие приоритетов уровню очереди (`priority`, меньше = выше):

| Вариант | Значение `priority` | Коэффициент |
|---|---|---|
| Срочный | 50 | 1.5× |
| Обычный | 100 | — |
| Эконом | 200 | — |

### 1.7. API планировщика

```javascript
const schedulerAPI = {
    // Получить загрузку оборудования
    getEquipmentLoad: async (req, res) => {
        const { equipmentId, startDate, endDate } = req.query;
        const scheduler = new ProductionScheduler();
        const load = await scheduler.getEquipmentLoadView(equipmentId, startDate, endDate);
        res.json(load);
    },

    // Рассчитать сроки для нового заказа (несколько приоритетов)
    calculateDeadline: async (req, res) => {
        const { order } = req.body;
        const scheduler = new ProductionScheduler();
        const options = await Promise.all([
            scheduler.calculateCompletionDate({ ...order, priority: 50 }),  // срочный
            scheduler.calculateCompletionDate({ ...order, priority: 100 }), // обычный
            scheduler.calculateCompletionDate({ ...order, priority: 200 })  // эконом
        ]);
        res.json({ urgent: options[0], normal: options[1], economy: options[2] });
    },

    // Запланировать заказ
    scheduleOrder: async (req, res) => {
        const { order, priority } = req.body;
        const scheduler = new ProductionScheduler();
        res.json(await scheduler.scheduleOrder(order, priority));
    },

    // Перепланировать (при сбоях)
    rescheduleTask: async (req, res) => {
        const { taskId, newStartTime } = req.body;
        const scheduler = new ProductionScheduler();
        res.json(await scheduler.rescheduleTask(taskId, newStartTime));
    }
};
```

### 1.8. Уведомления планировщика

Класс `ProductionNotifier`:

- `notifyStartTask(task)` — уведомляет оператора, что задача готова к выполнению.
- `notifyDelay(task, delayMinutes)` — уведомляет менеджера о задержке и запускает пересчёт всех последующих задач (`rescheduleDependentTasks`).
- `notifyCompletion(task)` — уведомляет о завершении и активирует следующую задачу в цепочке (`activateNextTask`).

### 1.9. Что даёт система планирования

- Реалистичные сроки — клиент получает дату с учётом реальной загрузки.
- Оптимизация загрузки — оборудование не простаивает, нет авралов.
- Приоритезация — срочные заказы можно поставить вперёд.
- Прозрачность — менеджер видит, когда освободится оборудование.
- Контроль — история простоев и загрузки для анализа.
- Автоматизация — система сама перепланирует при сбоях.

---

## 2. Генерация ТЗ для участков производства

При переходе заказа на участок система генерирует чёткое техническое задание для исполнителя. Для каждого участка формируется свой набор параметров.

### 2.1. Состав ТЗ по участкам

**Для печатника:**

- Принтер, бумага, тираж
- Раскладка на листе
- Цветность, вылеты

**Для резчика:**

- Схема резов
- Высота стопы
- Допуски

**Для оператора плоттера:**

- Тип резки (контурная / линейная)
- Скорость резки
- Расположение меток

### 2.2. Пример ТЗ на участок резки

```
ТЕХНИЧЕСКОЕ ЗАДАНИЕ №123-РЕЗКА
Заказ: Листовки А5, 5000 шт

УЧАСТОК: Резка
ОБОРУДОВАНИЕ: Boway BW-4908 V9
ИСПОЛНИТЕЛЬ: Иванов П.Р.
СРОК: 11.03.2026 18:00

ИСХОДНЫЕ ДАННЫЕ
  Материал: Бумага 250 г/м²
  Формат листа: SRA3 (320×450)
  Количество листов: 625
  Раскладка: 4×2 (8 шт/лист)
  Размер готового: А5 (148×210)

ПАРАМЕТРЫ РЕЗКИ
  Толщина бумаги: 0.30 мм
  Макс. листов в стопе: 313
  Рекомендуемая стопа: 313 листов
  Количество стоп: 2
  Высота стопы: 79.8 мм
  Схема резов:
  • 3 вертикальных реза
  • 4 горизонтальных реза на каждую полосу
  • Всего резов: 7 на стопу

НАСТРОЙКИ ОБОРУДОВАНИЯ
  Давление прижима: среднее
  Скорость реза: 0.5 мин/рез
  Точность: 0.1 мм
  Дополнительно: использовать задний упор

КОНТРОЛЬ КАЧЕСТВА
  Проверить первую стопу
  Допуск: ±0.5 мм
  Проверить 5% готовой продукции

[ ПОДТВЕРДИТЬ ВЫПОЛНЕНИЕ ] [ СООБЩИТЬ О ПРОБЛЕМЕ ]
```

ТЗ можно отправить в Telegram или распечатать.

> Примечание: это пример ТЗ, а не вывод формулы. Параметры резака Boway BW-4908 V9 задаются в конструкторе оборудования (карточка модели — см. [Оборудование и нормативы, раздел 4.1](equipment.md#41-резак-гильотинный-boway-bw-4908-v9)). Каноническое описание гильотины, таблица толщины по плотности, коэффициент уплотнения 0.85, число резов `cutsForGrid` и вывод итоговой формулы времени резки — в [Резка, ламинация и доп. услуги, раздел 2 «Гильотинная резка»](../04-calculators/cutting-lamination-services.md#2-гильотинная-резка-boway-bw-4908-v9). Базовая формула: `setup_time + (stacks * cuts * speed * (1 + (stack_height / max_height) * 0.5))`.

---

## 3. Обратная связь от производства

Без обратной связи расчёты остаются теорией; с обратной связью они становятся точными и постоянно улучшаются. Эта подсистема делает CRM самообучающейся.

### 3.1. Что собирает система

Цикл данных:

```
ЗАКАЗ → ПЛАНИРОВАНИЕ → ВЫПОЛНЕНИЕ → ФАКТ → АНАЛИЗ → КОРРЕКТИРОВКА
        (расчёт)                    (данные)      (формул, нормативов)
```

Собираемые данные:

- Фактическое время выполнения операций
- Фактический расход материалов
- Простои и их причины
- Брак и его причины
- Комментарии операторов
- Отклонения от плана

### 3.2. Архитектура обратной связи

```
УРОВЕНЬ 1: Сбор данных
├── С терминалов на производстве
├── С мобильных устройств операторов
├── Автоматически с оборудования (датчики)
└── Ручной ввод (мастера, технологи)

УРОВЕНЬ 2: Обработка и валидация
├── Проверка на аномалии
├── Привязка к заказам и операциям
└── Категоризация отклонений

УРОВЕНЬ 3: Анализ и отчётность
├── Сравнение план/факт
├── Тренды и закономерности
├── Выявление узких мест
└── Прогнозирование с учётом истории

УРОВЕНЬ 4: Обратное влияние на расчёты
├── Автокорректировка нормативов
├── Ручное утверждение изменений
└── Версионирование формул
```

### 3.3. Структура БД обратной связи

```sql
-- 1. Фактическое выполнение задач
CREATE TABLE production_task_execution (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,                          -- ссылка на production_schedule
    -- Временные метки (факт)
    actual_start TIMESTAMP NOT NULL,
    actual_end TIMESTAMP NOT NULL,
    actual_duration_minutes INT GENERATED ALWAYS AS (TIMESTAMPDIFF(MINUTE, actual_start, actual_end)) STORED,
    -- Расхождение с планом
    planned_duration_minutes INT NOT NULL,
    deviation_minutes INT GENERATED ALWAYS AS (actual_duration_minutes - planned_duration_minutes) STORED,
    deviation_percent DECIMAL(5,2) GENERATED ALWAYS AS ((actual_duration_minutes - planned_duration_minutes) / planned_duration_minutes * 100) STORED,
    -- Кто выполнял
    operator_id INT,
    operator_comment TEXT,
    -- Статус выполнения
    execution_status ENUM('completed', 'partial', 'failed', 'reworked') DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES production_schedule(id),
    INDEX idx_task (task_id),
    INDEX idx_dates (actual_start, actual_end)
);

-- 2. Фактический расход материалов
CREATE TABLE production_material_usage (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    material_id INT NOT NULL,
    -- Плановый расход
    planned_quantity DECIMAL(10,2) NOT NULL,
    planned_unit VARCHAR(20) NOT NULL,             -- 'лист', 'кг', 'м'
    -- Фактический расход
    actual_quantity DECIMAL(10,2) NOT NULL,
    waste_quantity DECIMAL(10,2) DEFAULT 0,        -- отходы/брак
    -- Отклонение
    deviation_quantity DECIMAL(10,2) GENERATED ALWAYS AS (actual_quantity - planned_quantity) STORED,
    deviation_percent DECIMAL(5,2) GENERATED ALWAYS AS ((actual_quantity - planned_quantity) / planned_quantity * 100) STORED,
    -- Причины отклонения
    waste_reason VARCHAR(255),
    FOREIGN KEY (task_id) REFERENCES production_schedule(id),
    FOREIGN KEY (material_id) REFERENCES materials(id),
    INDEX idx_task_material (task_id, material_id)
);

-- 3. Простои и инциденты
CREATE TABLE production_incidents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT,
    equipment_id INT NOT NULL,
    incident_type ENUM(
        'breakdown',        -- поломка
        'setup_issue',      -- проблемы с настройкой
        'material_issue',   -- проблемы с материалом
        'quality_issue',    -- проблемы с качеством
        'operator_absence', -- отсутствие оператора
        'power_outage',     -- отключение электричества
        'other'
    ) NOT NULL,
    -- Время инцидента
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INT,                          -- вычисляется при end_time
    -- Описание
    description TEXT,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    -- Действия
    actions_taken TEXT,
    -- Кто зафиксировал
    reported_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES production_schedule(id),
    FOREIGN KEY (equipment_id) REFERENCES equipment_models(id),
    INDEX idx_equipment_dates (equipment_id, start_time)
);

-- 4. Брак и его причины
CREATE TABLE production_defects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    defect_type ENUM(
        'printing',        -- проблемы печати
        'cutting',         -- проблемы резки
        'lamination',      -- проблемы ламинации
        'binding',         -- проблемы переплёта
        'color_mismatch',  -- несовпадение цвета
        'misregistration', -- несовмещение
        'damage',          -- повреждение
        'other'
    ) NOT NULL,
    -- Количество бракованных единиц
    defect_quantity INT NOT NULL,
    total_quantity INT NOT NULL,                   -- всего в задании
    defect_percent DECIMAL(5,2) GENERATED ALWAYS AS (defect_quantity / total_quantity * 100) STORED,
    -- Причина
    cause VARCHAR(255),
    responsible_party ENUM('client', 'production', 'material', 'unknown') DEFAULT 'unknown',
    -- Можно ли переделать
    rework_possible BOOLEAN DEFAULT false,
    rework_time_minutes INT,
    -- Фото/документация
    attachments JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES production_schedule(id)
);

-- 5. Оценка точности расчётов (для самообучения)
CREATE TABLE calculation_accuracy (
    id INT PRIMARY KEY AUTO_INCREMENT,
    formula_id INT,                                -- какая формула использовалась
    task_id INT NOT NULL,
    -- Что рассчитывали
    calculation_type ENUM('time', 'material', 'cost') NOT NULL,
    predicted_value DECIMAL(10,2) NOT NULL,
    actual_value DECIMAL(10,2) NOT NULL,
    error_percent DECIMAL(5,2) GENERATED ALWAYS AS (ABS(actual_value - predicted_value) / predicted_value * 100) STORED,
    -- Контекст (параметры заказа)
    context JSON,
    -- Рекомендация по корректировке
    recommended_adjustment DECIMAL(5,2),           -- на сколько % изменить формулу
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (formula_id) REFERENCES equipment_formulas(id),
    FOREIGN KEY (task_id) REFERENCES production_schedule(id),
    INDEX idx_formula (formula_id, error_percent)
);

-- 6. Комментарии операторов (свободная форма)
CREATE TABLE operator_feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL,
    operator_id INT NOT NULL,
    -- Тип обратной связи
    feedback_type ENUM('suggestion', 'problem', 'improvement', 'note') DEFAULT 'note',
    -- Текст
    comment TEXT NOT NULL,
    -- Важность
    importance ENUM('low', 'medium', 'high') DEFAULT 'medium',
    -- Принятые меры
    actions_taken TEXT,
    resolved_by INT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES production_schedule(id),
    INDEX idx_task_feedback (task_id)
);
```

### 3.4. Класс сбора и анализа обратной связи

Класс `ProductionFeedbackCollector` фиксирует факт выполнения, расход материалов, инциденты, брак, ведёт оценку точности расчётов и строит дашборд руководителя.

**Пороги отклонений (в %):**

| Тип | Warning | Critical |
|---|---|---|
| Время (`time`) | 15 | 30 |
| Материал (`material`) | 5 | 10 |

Логика обработки:

- При фиксации выполнения (`recordTaskCompletion`): если `|deviation_percent| > 30` — уведомление о критическом отклонении (`notifyCriticalDeviation`); если `> 15` — запись в лог отклонений (`logDeviation`); в любом случае записывается история точности расчётов.
- При фиксации расхода (`recordMaterialUsage`): если перерасход `deviation_percent > 10` (critical) — уведомление о перерасходе материала.
- При фиксации инцидента (`recordIncident`): если инцидент связан с задачей — перепланирование последующих задач (`rescheduleAffectedTasks`). Длительность вычисляется как `EXTRACT(EPOCH FROM (end_time - start_time))/60`.
- При фиксации брака (`recordDefects`): если `responsible_party = 'production'` — создаётся задача на анализ качества (`createQualityTask`).

```javascript
class ProductionFeedbackCollector {
    constructor() {
        this.deviationThresholds = {
            time: { warning: 15, critical: 30 },      // % отклонения
            material: { warning: 5, critical: 10 }    // % отклонения
        };
    }

    // Фиксация выполнения задачи
    async recordTaskCompletion(taskId, data) {
        const { actualStart, actualEnd, operatorId, comment } = data;
        const task = await db.query('SELECT * FROM production_schedule WHERE id = $1', [taskId]);
        const execution = await db.query(`
            INSERT INTO production_task_execution
            (task_id, actual_start, actual_end, planned_duration_minutes, operator_id, operator_comment)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [taskId, actualStart, actualEnd, task.planned_duration_minutes, operatorId, comment]);

        const deviation = execution.deviation_percent;
        if (Math.abs(deviation) > this.deviationThresholds.time.critical) {
            await this.notifyCriticalDeviation(task, execution);
        } else if (Math.abs(deviation) > this.deviationThresholds.time.warning) {
            await this.logDeviation(task, execution);
        }
        await this.recordCalculationAccuracy(task, execution);
        return execution;
    }

    // Анализ точности формул и предложение корректировок
    async analyzeFormulaAccuracy(formulaId, days = 30) {
        const stats = await db.query(`
            SELECT
                AVG(error_percent) as avg_error,
                STDDEV(error_percent) as stddev_error,
                MIN(error_percent) as min_error,
                MAX(error_percent) as max_error,
                COUNT(*) as samples,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY error_percent) as median_error
            FROM calculation_accuracy
            WHERE formula_id = $1
                AND created_at >= NOW() - INTERVAL '${days} days'
        `, [formulaId]);

        const recommendation = {
            formulaId,
            avgError: stats.avg_error,
            stability: stats.stddev_error / stats.avg_error, // чем меньше, тем стабильнее
            samples: stats.samples,
            suggestedAdjustment: this.calculateAdjustment(stats),
            confidence: this.calculateConfidence(stats.samples, stats.stddev_error)
        };
        // Достаточно данных и систематическая ошибка — предлагаем корректировку
        if (recommendation.samples >= 10 && Math.abs(stats.avg_error) > 10) {
            await this.createAdjustmentProposal(recommendation);
        }
        return recommendation;
    }

    // Расчёт рекомендуемой корректировки формулы
    calculateAdjustment(stats) {
        if (Math.abs(stats.avg_error) > 15 && stats.samples > 20) {
            return {
                type: 'multiplier',
                value: 1 - (stats.avg_error / 100),
                description: `Уменьшить расчётное время на ${Math.abs(stats.avg_error).toFixed(1)}%`
            };
        }
        return null;
    }
}
```

**Дашборд руководителя производства** (`getProductionDashboard`) включает:

- Общую статистику: всего задач, среднее отклонение, число критических отклонений (`|deviation_percent| > 30`), число проваленных задач (`execution_status = 'failed'`).
- ТОП-5 проблемного оборудования по суммарному простою (`production_incidents`).
- Основные причины брака с группировкой по `defect_type`.
- Точность планирования по дням (среднее отклонение).
- Автоматические рекомендации.

### 3.5. Формулы обратной связи

```
# Отклонение по времени
deviation_minutes = actual_duration_minutes - planned_duration_minutes
deviation_percent = (actual_duration_minutes - planned_duration_minutes) / planned_duration_minutes * 100

# Отклонение по материалу
deviation_quantity = actual_quantity - planned_quantity
deviation_percent  = (actual_quantity - planned_quantity) / planned_quantity * 100

# Процент брака
defect_percent = defect_quantity / total_quantity * 100

# Ошибка расчёта (точность формулы)
error_percent = ABS(actual_value - predicted_value) / predicted_value * 100

# Длительность инцидента
duration_minutes = (end_time - start_time) в минутах
```

### 3.6. Терминал оператора на производстве

```
ТЕРМИНАЛ УЧАСТКА: Печатный цех
ОПЕРАТОР: Иванов П. (смена А)

ТЕКУЩЕЕ ЗАДАНИЕ:
 Заказ №124 | Листовки А5, 5000 шт
 Оборудование: Konica C6085
 План: 09:00 - 11:30 (150 мин)
 Текущее время: 10:45
 Прогресс: ███████████░░░░░░░ 70%
 [ ЗАВЕРШИТЬ ЗАДАНИЕ ] [ ПРОБЛЕМА ] [ ПЕРЕРЫВ ]

СЛЕДУЮЩЕЕ ЗАДАНИЕ:
 Заказ №125 | Наклейки, 1000 шт
 Оборудование: Konica C6085
 План: 11:45 - 13:15
 Материалы: Плёнка ORAJET 3552

СООБЩИТЬ О ПРОБЛЕМЕ:
 Тип: [ Поломка оборудования ▼ ]
 Описание: ____________________
 [ ] Остановить задание
 [ ОТПРАВИТЬ ]
```

### 3.7. Интерфейс мастера / технолога (аналитика)

```
АНАЛИТИКА ПРОИЗВОДСТВА за Март 2026

ОСНОВНЫЕ ПОКАЗАТЕЛИ:
 Выполнено задач: 245
 Среднее отклонение: +8.3% (перерасход времени)
 Критических отклонений (>30%): 12
 Брак: 2.4%

ГРАФИК ОТКЛОНЕНИЙ ПО ДНЯМ:
  +20% ┼          ●
  +10% ┼     ●    │  ●          ●
    0% ┼────●─────┼────●────●───┼────●────●─────
  -10% ┼          │         ●    │
       └──────────┴──────────────┴──────────►
         1-7      8-14        15-21       22-28

ПРОБЛЕМНОЕ ОБОРУДОВАНИЕ:
 Оборудование    │ Простои (ч) │ Причина
 Konica C3070L   │ 12.5        │ Поломка узла подачи
 Резак Boway     │ 8.2         │ Замена ножа
 Плоттер Mimaki  │ 5.1         │ Калибровка

ОСНОВНЫЕ ПРИЧИНЫ БРАКА:
 ● Несовмещение цветов: 35%
 ● Проблемы резки: 28%
 ● Дефекты ламинации: 22%
 ● Прочее: 15%

РЕКОМЕНДАЦИИ ПО КОРРЕКТИРОВКЕ:
 ⚠ Формула времени для Konica C3070L занижена на 15%
   [ ПРИНЯТЬ КОРРЕКТИРОВКУ ] [ ОТКЛОНИТЬ ]
 ⚠ Расход плёнки для наклеек завышен на 8%
   [ ПРИНЯТЬ КОРРЕКТИРОВКУ ] [ ОТКЛОНИТЬ ]
```

### 3.8. Уведомления о критических отклонениях

Класс `DeviationNotifier`:

- `notifyCriticalDeviation(task, execution)` — формирует сообщение (заказ, операция, план/факт в минутах, отклонение в %, оператор), отправляет руководителю с приоритетом `high` и создаёт задачу на анализ (`createAnalysisTask`).
- `notifyMaterialOveruse(usage)` — формирует сообщение о перерасходе (материал, план/факт, отклонение, причина) и отправляет на склад (`sendToWarehouse`).

---

## 4. Самообучение системы

Подсистема `SelfLearningSystem` анализирует точность формул на реальных данных и предлагает корректировки нормативов с версионированием.

### 4.1. Логика анализа и корректировки

Отбор неточных формул за последние 30 дней:

```sql
SELECT formula_id, AVG(error_percent) as avg_error, COUNT(*) as samples
FROM calculation_accuracy
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY formula_id
HAVING AVG(error_percent) > 15 AND COUNT(*) > 20
```

Условия для предложения корректировки:

- Средняя ошибка `avg_error > 15%` И число замеров `samples > 20`.
- Альтернативный порог в `analyzeFormulaAccuracy`: `samples >= 10` И `|avg_error| > 10%`.

Расчёт корректирующего множителя и уверенности:

```
suggestedMultiplier = 1 - (avg_error / 100)
confidence = min(samples / 50, 0.95)   # чем больше данных, тем выше уверенность
```

### 4.2. Применение корректировки (версионирование формул)

При утверждении (`applyAdjustment(adjustmentId, approvedBy)`) создаётся новая версия формулы: `version + 1`, текст формулы домножается на `suggestedMultiplier`, проставляется автор, ссылка на родительскую формулу (`parent_formula_id`), а старая версия помечается как неактивная (`is_current = false`).

```javascript
class SelfLearningSystem {
    async analyzeAndAdjust() {
        const inaccurateFormulas = await db.query(`
            SELECT formula_id, AVG(error_percent) as avg_error, COUNT(*) as samples
            FROM calculation_accuracy
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY formula_id
            HAVING AVG(error_percent) > 15 AND COUNT(*) > 20
        `);
        for (const formula of inaccurateFormulas) {
            const adjustment = {
                formulaId: formula.formula_id,
                currentAvgError: formula.avg_error,
                suggestedMultiplier: 1 - (formula.avg_error / 100),
                confidence: Math.min(formula.samples / 50, 0.95)
            };
            await this.createAdjustmentProposal(adjustment);
        }
    }

    async applyAdjustment(adjustmentId, approvedBy) {
        const proposal = await db.query('SELECT * FROM formula_adjustments WHERE id = $1', [adjustmentId]);
        await db.query(`
            INSERT INTO equipment_formulas
            (equipment_id, version, formula_text, variables, description, changed_by, parent_formula_id)
            SELECT equipment_id, version + 1, formula_text * $1, variables, $2, $3, id
            FROM equipment_formulas WHERE id = $4
        `, [
            proposal.suggestedMultiplier,
            `Автокорректировка на основе фактических данных (ошибка была ${proposal.currentAvgError}%)`,
            approvedBy,
            proposal.formulaId
        ]);
        await db.query('UPDATE equipment_formulas SET is_current = false WHERE id = $1', [proposal.formulaId]);
    }
}
```

⚠️ ОТКРЫТЫЙ ВОПРОС: применение корректировки формулы реализовано упрощённо — `formula_text * $1` домножает текст формулы на множитель напрямую. В исходнике отмечено: «упрощённо, реально нужно парсить формулу». Механизм корректного применения множителя к текстовой формуле не определён.

⚠️ ОТКРЫТЫЙ ВОПРОС: таблица `formula_adjustments` (источник предложений корректировок) и таблица `equipment_formulas` с полями `version`, `is_current`, `parent_formula_id`, `variables`, `changed_by` используются в коде самообучения, но их DDL в данном разделе не приведён (относятся к модулю конструктора оборудования/формул).

### 4.3. Что даёт самообучение и обратная связь

- Точность расчётов — формулы самообучаются на реальных данных.
- Прозрачность производства — видно, где и почему возникают проблемы.
- Контроль качества — учёт брака и его причин.
- Оптимизация — выявление узких мест.
- Мотивация — операторы видят влияние своей работы.
- История — база знаний о реальных возможностях оборудования.
- Прогнозирование — с учётом исторических данных.

---

## 5. Производственный модуль в интерфейсе менеджера (просмотр)

Менеджеру доступен раздел производственного модуля в режиме просмотра. Детальный разбор прототипа интерфейса — в документации по прототипу CRM-интерфейса; здесь зафиксирована производственная суть просмотра.

| Компонент | Описание |
|---|---|
| Календарь загрузки оборудования | По дням, по станкам (принтеры, резаки, плоттеры) |
| Очередь заданий | Список активных производственных задач с привязкой к заказам |
| ТЗ для цеха | Детальные инструкции (формат, бумага, раскладка, параметры резки, срок); можно отправить в Telegram или распечатать |
| Комментарии операторов | Обратная связь от производства (фактическое время, брак, проблемы) |

---

## Источник

Материал собран из папки `D:\roman\Desktop\PRINTOFFICE\context\raw`:

- `architecture.md`, строки 4698–4754 — производственный календарь и планировщик загрузки оборудования (архитектура, БД, класс `ProductionScheduler`, интерфейсы, API, `ProductionNotifier`).
- `architecture.md`, строки 4755–4819 — обратная связь от производства (архитектура, БД, класс `ProductionFeedbackCollector`, терминал оператора, аналитика мастера, `DeviationNotifier`, класс `SelfLearningSystem`).
- `architecture.md`, строки 4505–4540 — генерация ТЗ для участков (печатник / резчик / плоттер), пример ТЗ на резку, формула времени резки.
- `architecture.md`, строки 4934–4964 — свод производственного модуля (планирование, обратная связь, самообучение, ТЗ для участков).
- `architecture.md`, строки 2433–2459 — обзор состава производственного модуля.
- `crm-interface.md`, строки 133–148 — производственный модуль в интерфейсе менеджера (просмотр).
