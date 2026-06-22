# Vendor Engine (маршрутизация подрядчиков)

Модуль маршрутизации заказов между собственным производством и внешними подрядчиками. Принцип: единая универсальная форма ввода → правила маршрутизации «если-то» → варианты исполнения с ценами, при этом конкретные подрядчики скрыты от менеджера. Дополнительно описан модуль валидации зависимостей (совместимость материал / формат / оборудование / операция).

## 1. Принцип унификации

Ключевая идея: не создавать отдельный интерфейс или отдельную логику под каждого подрядчика. Если для каждого подрядчика делать свою форму и свою логику, менеджер не сможет работать. Задача — создать единое пространство заказа, где подрядчик является лишь одним из параметров, который система подставляет автоматически или с минимальным участием человека.

Уровни унификации:

1. Единая маска ввода (универсальная форма заказа).
2. Система-маршрутизатор (виджет «Подрядчик», модуль Vendor Engine).
3. Вывод вариантов исполнения с ценами (подрядчики скрыты от менеджера).

## 2. Единая маска ввода (универсальная форма заказа)

Создаётся одна универсальная форма «Услуга» вместо отдельных форм под каждого подрядчика (например, без разделения на форму для GMPrint и для широкоформатной печати). Форма содержит все возможные параметры продукции, разделённые на две группы.

### 2.1. Обязательные параметры (для всех услуг)

| Параметр | Описание |
|---|---|
| Тираж | Количество единиц |
| Срок | Срок исполнения |
| Наличие макета | Есть готовый макет или нет |
| Формат | Ширина × Высота (Ш × В) |

### 2.2. Динамические параметры (появляются по выбору услуги)

| Условие (выбранная услуга) | Появляющиеся поля |
|---|---|
| Офсетная печать | «Плотность бумаги», «Цветность» (4+0, 4+4) |
| Широкоформатная печать | «Тип материала» (Баннер / Плёнка), чекбоксы «Люверсы», «Карман», «Резка» |

Менеджер заполняет единую форму, не задумываясь, какому подрядчику уйдёт заказ.

## 3. Система-маршрутизатор (Vendor Engine)

После заполнения параметров и нажатия «Рассчитать» в работу вступает модуль Vendor Engine. Он работает по принципу «если-то» (правила маршрутизации).

### 3.1. Правила маршрутизации (примеры)

| № | Условие | Кандидат на исполнение |
|---|---|---|
| Правило 1 | Услуга = Офсетная печать И Тираж > 500 И бюджет не критичен | Кандидат #1: GMPrint |
| Правило 2 | Услуга = Широкоформатка И Материал = Баннер | Кандидат #1: WideFormatVendor (есть прайс) |
| Правило 3 | Услуга = Широкоформатка И Материал = Пластик 10 мм (нет в прайсе) | Кандидат #1: WideFormatVendor2 (ручной просчёт) |

### 3.2. Представление для менеджера

Менеджер видит не список подрядчиков, а список **вариантов исполнения** с ценами. Конкретные подрядчики скрыты — система подставляет их автоматически на основании правил.

⚠️ ОТКРЫТЫЙ ВОПРОС: В исходнике фраза «Он видит не список подрядчиков, а список вариантов исполнения:» обрывается — сам перечень вариантов исполнения (как именно отображаются строки: название варианта, цена, срок) в источнике не приведён.

## 4. Расчёт себестоимости по подрядчику

Себестоимость варианта исполнения формируется в зависимости от типа подрядчика и наличия прайса.

### 4.1. Себестоимость по прайсу подрядчика (широкоформат с фиксированной ценой)

Простое матричное правило. Если выбран материал «Баннер», система берёт цену из таблицы `vendor_prices` и считает мгновенно:

```
cost = price_per_m2 * area + additional_works
```

Параметры расчёта (на примере баннера):

| Позиция | Значение | Роль в формуле |
|---|---|---|
| Баннер (цена за м²) | 500 ₽/м² | `price_per_m2` × `area` (площадь) |
| Люверсы | 15 ₽/шт | слагаемое `additional_works` |
| Резка | входит в доп. работы | слагаемое `additional_works` |

### 4.2. Себестоимость по прайс-листу (офсет, GMPrint)

У офсетных партнёров цена, как правило, зависит от тиража и формата, поэтому простой расчёт «цена × площадь» не подходит. Используется матричный прайс-лист — таблица `price_matrix`, где себестоимость хранится на пересечении параметров заказа. Система выполняет простой Lookup (поиск по таблице): находит ячейку, соответствующую сочетанию формата, бумаги, цветности и диапазона тиража.

Пример строки матрицы:

| Формат | Бумага | Цветность | Тираж | Себестоимость |
|---|---|---|---|---|
| А3 | 80 г | 4+0 | 1000 шт | 5 ₽/шт |

Детали хранения, импорта/экспорта и интерполяции для промежуточных тиражей описаны в модуле офсетных партнёров (раздел 5).

## 5. Модуль офсетных партнёров / маршрутизация

Спроектированные компоненты модуля офсетных партнёров:

| Компонент | Описание | Статус |
|---|---|---|
| Хранение цен в матрице | Таблица с диапазонами тиражей | ✅ |
| Импорт/экспорт Excel | Массовое обновление цен | ✅ |
| Интерполяция цен | Расчёт для промежуточных тиражей | ✅ |
| Настройка доставки | По городам (Москва, МО, регионы) | ✅ |
| Правила маржи | Отдельно для офсетных заказов | ✅ |
| Автовыбор технологии | Цифра / офсет / широкоформат | ✅ |

## 6. Модуль валидации зависимостей

Система проверки совместимости, предотвращающая производственные ошибки ещё на этапе расчёта. Проверяет: можно ли выполнить заказ на выбранном оборудовании с заданными материалами.

```
ЗАКАЗ                  →     ПРОВЕРКА        →     РЕЗУЛЬТАТ
├── Оборудование             Совместимо?           ✅ Можно печатать
├── Материал                                       ⚠️ С ограничениями
├── Формат                                         ❌ Невозможно
└── Доп. операции
```

### 6.1. Типы зависимостей

| Тип зависимости | Пример | Проверка |
|---|---|---|
| Оборудование ↔ Материал | Принтер C3070L не печатает на бумаге 400 г/м² | Плотность в допустимом диапазоне |
| Оборудование ↔ Формат | Резак Boway режет только до 490 мм | Ширина/высота ≤ макс. значения |
| Оборудование ↔ Операция | Не все плоттеры режут картон | Тип материала в списке совместимых |
| Материал ↔ Операция | Не все плёнки ламинируются при низкой температуре | Температурный режим |
| Последовательность операций | Нельзя ламинировать после контурной резки | Порядок выполнения |
| Временные ограничения | Оборудование занято в это время | Производственный календарь |

### 6.2. Архитектура системы валидации

```
┌─────────────────────────────────────────────────────────────────┐
│                     СИСТЕМА ВАЛИДАЦИИ                              │
├─────────────────────────────────────────────────────────────────┤
│  УРОВЕНЬ 1: Правила совместимости                                 │
│  ├── Глобальные правила (для всего оборудования)                  │
│  ├── Специфические правила (для конкретных моделей)               │
│  └── Исключения (ручные настройки менеджера)                      │
│                                                                   │
│  УРОВЕНЬ 2: Проверка в реальном времени                           │
│  ├── При выборе оборудования                                      │
│  ├── При изменении материала                                      │
│  ├── При добавлении операции                                      │
│  └── При изменении формата/тиража                                 │
│                                                                   │
│  УРОВЕНЬ 3: Результаты проверки                                    │
│  ├── ✅ Всё хорошо                                                │
│  ├── ⚠️ Предупреждение (можно продолжить, но осторожно)           │
│  └── ❌ Ошибка (невозможно выполнить)                             │
│                                                                   │
│  УРОВЕНЬ 4: Объяснение и рекомендации                             │
│  ├── Почему нельзя                                                │
│  └── Что изменить, чтобы стало можно                              │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3. Структура БД для правил валидации

```sql
-- 1. Типы проверок
CREATE TABLE validation_check_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) UNIQUE,        -- 'material_equipment_compatibility'
    name VARCHAR(255),              -- "Совместимость материала и оборудования"
    description TEXT,
    category VARCHAR(50)            -- 'hard_limit', 'soft_limit', 'sequence'
);

-- 2. Правила валидации
CREATE TABLE validation_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    -- К чему применяется правило
    entity_type ENUM('equipment', 'material', 'operation', 'global') NOT NULL,
    entity_id INT,                  -- ID оборудования/материала/операции или NULL для global
    -- Тип проверки
    check_type_id INT NOT NULL,
    -- Параметры проверки (JSON с условиями)
    check_parameters JSON NOT NULL,
    -- Пример: {"density": {"min": 60, "max": 300}}
    -- Пример: {"format_width": {"max": 490}}
    -- Пример: {"required_operations": ["cutting", "lamination"]}
    -- Уровень серьёзности
    severity ENUM('error', 'warning', 'info') DEFAULT 'error',
    -- Сообщение для пользователя
    message_template TEXT NOT NULL,
    -- "Бумага плотностью {density} г/м² не подходит для принтера {printer_name}"
    -- Рекомендация (что сделать)
    recommendation_template TEXT,
    -- "Используйте бумагу плотностью до {max_density} г/м²"
    -- Приоритет (какое правило применять первым)
    priority INT DEFAULT 100,
    -- Активно ли правило
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (check_type_id) REFERENCES validation_check_types(id),
    INDEX idx_entity (entity_type, entity_id, is_active)
);

-- 3. Исключения из правил (для особых случаев)
CREATE TABLE validation_exceptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rule_id INT NOT NULL,
    -- Условия исключения
    condition_type VARCHAR(50),     -- 'client_specific', 'order_specific', 'manual'
    condition_value JSON,           -- {"client_id": 123, "valid_until": "2026-12-31"}
    -- Разрешить или заменить правило
    action ENUM('allow', 'replace', 'ignore') DEFAULT 'allow',
    replacement_message TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until DATE,
    FOREIGN KEY (rule_id) REFERENCES validation_rules(id),
    INDEX idx_rule (rule_id, valid_until)
);

-- 4. История проверок (для аналитики)
CREATE TABLE validation_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    -- Что проверяли
    entity_checked VARCHAR(50),     -- 'equipment', 'material', 'operation'
    entity_id INT,
    -- Результат
    result ENUM('success', 'warning', 'error') NOT NULL,
    rule_id INT,                    -- какое правило сработало
    message TEXT,
    -- Контекст проверки
    context JSON,                   -- значения параметров в момент проверки
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (rule_id) REFERENCES validation_rules(id),
    INDEX idx_order (order_id, created_at)
);
```

### 6.4. Примеры правил валидации

```sql
-- 1. Принтер C3070L не печатает на бумаге >350 г/м²
INSERT INTO validation_rules (entity_type, entity_id, check_type_id, check_parameters, severity, message_template, recommendation_template)
VALUES ('equipment', 2, 1, '{"density": {"max": 350}}', 'error',
  'Принтер {equipment_name} не печатает на бумаге плотностью {density} г/м² (макс. 350 г/м²)',
  'Используйте бумагу плотностью до 350 г/м² или выберите другой принтер');

-- 2. Резак Boway режет только до ширины 490 мм
INSERT INTO validation_rules (entity_type, entity_id, check_type_id, check_parameters, severity, message_template, recommendation_template)
VALUES ('equipment', 1, 2, '{"format_width": {"max": 490}, "format_height": {"max": 450}}', 'error',
  'Формат {width}×{height} мм превышает максимальный размер резака {equipment_name} ({max_width}×{max_height} мм)',
  'Используйте формат не более {max_width}×{max_height} мм');

-- 3. Плоттер режет картон медленнее (предупреждение)
INSERT INTO validation_rules (entity_type, entity_id, check_type_id, check_parameters, severity, message_template, recommendation_template)
VALUES ('equipment', 3, 3, '{"material_type": "cardboard", "speed_warning": true}', 'warning',
  'Резка картона на плоттере {equipment_name} будет выполняться медленнее (скорость снижена до {actual_speed} мм/сек)',
  'Увеличьте время на резку в 2 раза');

-- 4. Ламинация требует определённой температуры
INSERT INTO validation_rules (entity_type, entity_id, check_type_id, check_parameters, severity, message_template, recommendation_template)
VALUES ('operation', 5, 4, '{"film_thickness": {"min": 75, "max": 175}, "temperature": {"min": 100, "max": 130}}', 'warning',
  'Плёнка толщиной {film_thickness} мкм требует температуры {required_temp}°C (текущая настройка: {current_temp}°C)',
  'Отрегулируйте температуру ламинатора');
```

### 6.5. Класс валидации (ValidationEngine)

Класс загружает активные правила из БД (отсортированные по `priority`) и выполняет последовательную проверку заказа: оборудование+материал, формат, операции, последовательность операций, затем сохраняет историю проверки. Заказ считается валидным, если `errors.length === 0`.

```javascript
class ValidationEngine {
    constructor() {
        this.rules = [];
        this.loadRules();
    }

    /** Загрузка активных правил из БД */
    async loadRules() {
        const query = `
            SELECT vr.*, vct.code as check_code, vct.name as check_name
            FROM validation_rules vr
            JOIN validation_check_types vct ON vct.id = vr.check_type_id
            WHERE vr.is_active = true
            ORDER BY vr.priority
        `;
        this.rules = await db.query(query);
    }

    /** Проверка заказа на совместимость */
    async validateOrder(order) {
        const results = { success: true, errors: [], warnings: [], infos: [] };

        // 1. Проверяем оборудование и материалы
        if (order.equipmentId && order.material) {
            const eqResult = await this.validateEquipmentMaterial(order.equipmentId, order.material);
            this.mergeResults(results, eqResult);
        }
        // 2. Проверяем формат
        if (order.equipmentId && order.format) {
            const formatResult = await this.validateEquipmentFormat(order.equipmentId, order.format);
            this.mergeResults(results, formatResult);
        }
        // 3. Проверяем операции
        if (order.operations) {
            for (const op of order.operations) {
                const opResult = await this.validateOperation(op, order.equipmentId, order.material);
                this.mergeResults(results, opResult);
            }
        }
        // 4. Проверяем последовательность операций
        if (order.operations && order.operations.length > 1) {
            const seqResult = await this.validateSequence(order.operations);
            this.mergeResults(results, seqResult);
        }
        // 5. Сохраняем историю
        await this.saveValidationHistory(order.id, results);

        results.success = results.errors.length === 0;
        return results;
    }

    /** Проверка совместимости оборудования и материала */
    async validateEquipmentMaterial(equipmentId, material) {
        const result = { errors: [], warnings: [], infos: [] };
        const rules = this.rules.filter(r =>
            r.entity_type === 'equipment' &&
            r.entity_id === equipmentId &&
            r.check_parameters.density
        );
        for (const rule of rules) {
            const { density } = rule.check_parameters;
            if (density.max && material.density > density.max) {
                const message = this.formatMessage(rule.message_template,
                    { equipment_name: await this.getEquipmentName(equipmentId), density: material.density });
                if (rule.severity === 'error') result.errors.push({ rule, message });
                else if (rule.severity === 'warning') result.warnings.push({ rule, message });
            }
            if (density.min && material.density < density.min) {
                // аналогично
            }
        }
        return result;
    }

    /** Проверка совместимости оборудования и формата */
    async validateEquipmentFormat(equipmentId, format) {
        const result = { errors: [], warnings: [], infos: [] };
        const rules = this.rules.filter(r =>
            r.entity_type === 'equipment' &&
            r.entity_id === equipmentId &&
            r.check_parameters.format_width
        );
        for (const rule of rules) {
            const { format_width, format_height } = rule.check_parameters;
            if (format_width?.max && format.width > format_width.max) {
                result.errors.push({ rule, message: this.formatMessage(rule.message_template, {
                    width: format.width, height: format.height,
                    max_width: format_width.max, max_height: format_height?.max || 'любая'
                })});
            }
            if (format_height?.max && format.height > format_height.max) {
                // аналогично
            }
        }
        return result;
    }

    /** Проверка операции */
    async validateOperation(operation, equipmentId, material) {
        const result = { errors: [], warnings: [], infos: [] };
        const opRules = this.rules.filter(r =>
            r.entity_type === 'operation' && r.entity_id === operation.id);
        for (const rule of opRules) {
            const params = rule.check_parameters;
            if (params.material_type && material.type !== params.material_type) {
                result.warnings.push({ rule,
                    message: `Операция ${operation.name} не оптимизирована для материала ${material.type}` });
            }
            if (params.film_thickness && material.thickness) {
                if (material.thickness > params.film_thickness.max) {
                    result.errors.push({ rule,
                        message: `Плёнка толщиной ${material.thickness} мкм слишком толстая для ламинатора` });
                }
            }
        }
        return result;
    }

    /** Проверка последовательности операций */
    async validateSequence(operations) {
        const result = { errors: [], warnings: [], infos: [] };
        // Нельзя ламинировать после контурной резки
        const laminationIndex = operations.findIndex(op => op.type === 'lamination');
        const cuttingIndex = operations.findIndex(op => op.type === 'contour_cutting');
        if (laminationIndex > -1 && cuttingIndex > -1 && cuttingIndex < laminationIndex) {
            result.errors.push({
                message: 'Нельзя выполнять контурную резку до ламинации. Сначала ламинация, потом резка.' });
        }
        // Нельзя резать гильотиной после плоттерной резки (изделия уже разделены)
        const guillotineIndex = operations.findIndex(op => op.type === 'guillotine_cutting');
        const plotterIndex = operations.findIndex(op => op.type === 'plotter_cutting');
        if (guillotineIndex > -1 && plotterIndex > -1 && plotterIndex < guillotineIndex) {
            result.errors.push({
                message: 'Нельзя резать гильотиной после плоттерной резки - изделия уже разделены' });
        }
        return result;
    }

    /** Объединение результатов */
    mergeResults(main, additional) {
        main.errors.push(...additional.errors);
        main.warnings.push(...additional.warnings);
        main.infos.push(...additional.infos);
    }

    /** Форматирование сообщения с подстановкой переменных */
    formatMessage(template, variables) {
        let message = template;
        for (let [key, value] of Object.entries(variables)) {
            message = message.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        return message;
    }

    /** Сохранение истории проверки */
    async saveValidationHistory(orderId, results) {
        const history = [];
        for (const error of results.errors) {
            history.push({ order_id: orderId, result: 'error', message: error.message,
                rule_id: error.rule?.id, context: JSON.stringify(error.rule?.check_parameters || {}) });
        }
        for (const warning of results.warnings) {
            history.push({ order_id: orderId, result: 'warning',
                message: warning.message, rule_id: warning.rule?.id });
        }
        if (history.length > 0) {
            await db.query(
                'INSERT INTO validation_history (order_id, result, message, rule_id, context) VALUES ?',
                [history.map(h => [h.order_id, h.result, h.message, h.rule_id, h.context])]);
        }
    }
}
```

### 6.6. Интерфейс валидации в реальном времени

```
┌─────────────────────────────────────────────────────┐
│  ПРОВЕРКА СОВМЕСТИМОСТИ                                │
├─────────────────────────────────────────────────────┤
│  ОБОРУДОВАНИЕ: Konica Minolta C3070L                  │
│  МАТЕРИАЛ: Бумага 400 г/м²                            │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  ❌ ОШИБКА                                        │ │
│  │  Принтер C3070L не печатает на бумаге             │ │
│  │  плотностью 400 г/м² (макс. 350 г/м²)             │ │
│  │  Рекомендация:                                    │ │
│  │  Используйте бумагу плотностью до 350 г/м²        │ │
│  │  или выберите другой принтер (например, C6085)    │ │
│  │  [ ВЫБРАТЬ C6085 ] [ ИЗМЕНИТЬ МАТЕРИАЛ ]           │ │
│  └─────────────────────────────────────────────────┘ │
│  ДРУГИЕ ПРОВЕРКИ:                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  ✅ Формат А4 (210×297) - подходит                │ │
│  │  ✅ Операция печати - доступна                    │ │
│  │  ⚠️  Операция ламинации - требует проверки        │ │
│  │     Плёнка 125 мкм подходит, температура 120°C    │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 6.7. Интерфейс настройки правил (без программиста)

Конструктор правил позволяет менеджеру создавать правила без участия разработчика: выбор типа правила, оборудования, условий, уровня результата (Ошибка / Предупреждение / Информация), шаблона сообщения и рекомендации.

```
┌─────────────────────────────────────────────────────┐
│  КОНСТРУКТОР ПРАВИЛ ВАЛИДАЦИИ                          │
├─────────────────────────────────────────────────────┤
│  НОВОЕ ПРАВИЛО:                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Тип правила: [ Оборудование ↔ Материал   ▼ ]    │ │
│  │  Оборудование: [ Konica C3070L           ▼ ]     │ │
│  │  Условие:                                         │ │
│  │  [ Плотность бумаги ] [ > ] [ 350 ] г/м²          │ │
│  │  + ДОБАВИТЬ УСЛОВИЕ                                │ │
│  │  Результат:                                       │ │
│  │  (•) Ошибка - нельзя продолжить                   │ │
│  │  ( ) Предупреждение - можно, но осторожно         │ │
│  │  ( ) Информация - просто уведомить                │ │
│  │  Сообщение:                                       │ │
│  │  [ Принтер {equipment} не печатает на бумаге      │ │
│  │    плотностью {density} г/м² ]                    │ │
│  │  Рекомендация:                                    │ │
│  │  [ Используйте бумагу до 350 г/м² ]               │ │
│  │  [ СОХРАНИТЬ ПРАВИЛО ]                             │ │
│  └─────────────────────────────────────────────────┘ │
│  СПИСОК ПРАВИЛ:                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │  ✓ C3070L: плотность >350 → ошибка                │ │
│  │  ✓ Boway: ширина >490 → ошибка                    │ │
│  │  ✓ Mimaki: картон → предупреждение                │ │
│  │  ✓ Ламинация: плёнка >175 → ошибка                │ │
│  │  [РЕДАКТИРОВАТЬ] [УДАЛИТЬ] [ОТКЛЮЧИТЬ]             │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 6.8. Интеграция с производственным процессом

При создании производственного задания сначала выполняется валидация. Если есть ошибки — заказ не передаётся в производство. Если есть предупреждения — уведомляется менеджер. Только при успешной проверке создаётся задание.

```javascript
// При создании производственного задания
async function createProductionTask(order) {
    // 1. Сначала валидация
    const validation = await validationEngine.validateOrder(order);
    if (!validation.success) {
        return {
            success: false,
            errors: validation.errors,
            task: null,
            message: 'Заказ не может быть передан в производство из-за ошибок совместимости'
        };
    }
    // 2. Если есть предупреждения - показываем менеджеру
    if (validation.warnings.length > 0) {
        await notifyManager({
            type: 'validation_warning',
            orderId: order.id,
            warnings: validation.warnings
        });
    }
    // 3. Создаём задание
    const task = {
        orderId: order.id,
        equipmentId: order.equipmentId,
        operations: order.operations,
        estimatedTime: await calculateTime(order),
        validationResult: validation,
        status: 'pending'
    };
    return { success: true, task, warnings: validation.warnings };
}
```

### 6.9. Преимущества системы валидации

- Предотвращение ошибок — невозможные заказы не попадают в производство.
- Экономия времени — не нужно переделывать брак.
- Прозрачность — менеджер сразу видит проблемы.
- Гибкость — правила настраиваются без программиста.
- История — можно анализировать частые проблемы.
- Рекомендации — система подсказывает, как исправить.

## 7. Открытые вопросы

⚠️ ОТКРЫТЫЙ ВОПРОС: Перечень вариантов исполнения, который видит менеджер вместо списка подрядчиков, в источнике не детализирован (фраза обрывается на двоеточии).

## Источник

Материал собран из файла `raw/architecture.md`:
- строки 1199–1225 — единая маска ввода, система-маршрутизатор Vendor Engine, правила «если-то», расчёт себестоимости по прайсу подрядчика (баннер: 500 ₽/м² + доп. работы) и по прайс-листу офсета (матрица `price_matrix`, Lookup, пример [А3, бумага 80 г, 4+0, тираж 1000 шт] = 5 ₽/шт);
- строки 2503–2533 — раздел «10. Модуль офсетных партнёров» (что спроектировано);
- строки 4609–4697 — раздел «Валидация зависимостей» (типы зависимостей, архитектура, БД правил, примеры правил, класс ValidationEngine, интерфейсы реального времени и настройки, интеграция с производством, преимущества).
