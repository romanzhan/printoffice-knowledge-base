# Конструкторы (без программиста)

Раздел описывает набор админ-конструкторов, позволяющих менеджеру/технологу настраивать систему типографии PrintOffice без участия программиста: конструктор оборудования, редактор формул, конструктор типов услуг и полей калькуляторов, конструктор страниц/витрины (сборка из сущностей), а также настраиваемые правила вылетов и маржи. Базовый принцип — «всё есть сущность с ID», которую можно создавать, клонировать, включать/отключать и переиспользовать.

---

## 1. Философия: всё — сущность

Ключевой архитектурный принцип: любой объект системы является сущностью с уникальным ID, которую можно:

- создавать (create);
- копировать/клонировать (clone);
- включать/отключать (`is_active`);
- привязывать к другой сущности;
- собирать в конструктор.

Сущностями являются: принтеры, материалы, форматы, услуги, правила, калькуляторы, страницы, партнёры, города и т.д. (диапазоны ID разнесены по типам: принтеры 1–3, материалы 101+, форматы 201+, услуги 301+, правила 401+, калькуляторы 501+, страницы 601+, партнёры 701+, города 801+).

### Базовая структура сущностей

Возможен единый абстрактный реестр (опционально), но на практике для каждой сущности заводится своя таблица с однотипной структурой (`id`, `name`, `slug`, `is_active`, `sort_order`, специфические поля/`config JSON`).

```sql
-- Абстрактная таблица для всех сущностей (опционально)
CREATE TABLE entities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entity_type VARCHAR(50) NOT NULL,  -- 'printer', 'material', 'format', 'service', 'rule'...
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    parent_id INT,                     -- для иерархии (бумага → вид бумаги)
    config JSON,                       -- все специфические параметры
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_type_active (entity_type, is_active),
    INDEX idx_parent (parent_id)
);

-- На практике — отдельные таблицы с однотипной структурой
CREATE TABLE printers  (id INT, name, slug, is_active, sort_order, technical_params JSON);
CREATE TABLE materials (id INT, name, slug, is_active, sort_order, properties JSON);
CREATE TABLE formats   (id INT, name, slug, is_active, sort_order, width, height);
CREATE TABLE services  (id INT, name, slug, is_active, sort_order, price_formula, calculation_type);
CREATE TABLE rules     (id INT, name, slug, is_active, sort_order, conditions, actions);
CREATE TABLE partners  (id INT, name, slug, is_active, sort_order, settings JSON);
CREATE TABLE cities    (id INT, name, slug, is_active, sort_order, delivery_settings JSON);
```

Обзорный состав конструкторской части системы: конструктор оборудования и ТЗ для производства; универсальная система витрины и кросс-продаж; детальная настройка отображения вариантов товара и привязка к страницам; понятное объяснение, как вывести услугу на страницу (например, услугу «Визитки»); настройка дополнительных услуг для цифровой печати.

---

## 2. Конструктор оборудования и справочники

Конструктор оборудования опирается на двухуровневую модель «Справочники + Конструкторы»: сырые данные хранятся в справочниках, а конструкторы услуг только ссылаются на них (минимум дублирования).

### Уровень 1. Базовые справочники (сырые данные)

```sql
-- 1.1. Принтеры (оборудование)
CREATE TABLE printers (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    slug VARCHAR(100),
    type VARCHAR(50),              -- 'color' или 'bw'
    max_format_width INT,
    max_format_height INT,
    speed_ppm INT,                 -- скорость, листов в минуту
    cost_per_hour DECIMAL(10,2),   -- стоимость часа работы
    is_active BOOLEAN
);

-- 1.2. Материалы (бумага, плёнка и т.д.)
CREATE TABLE materials (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(50),          -- 'paper', 'film', 'binding'...
    unit VARCHAR(20),              -- 'лист', 'пачка', 'кв_м', 'рулон'
    cost_per_unit DECIMAL(10,2),   -- закупочная цена
    stock_balance INT              -- остаток на складе
);

-- 1.3. Форматы (стандартные и нестандартные)
CREATE TABLE formats (
    id INT PRIMARY KEY,
    name VARCHAR(50),              -- 'A4', 'A5', 'SRA3', 'custom'
    width INT,
    height INT,
    is_standard BOOLEAN DEFAULT true,
    description VARCHAR(255)
);

-- 1.4. Цветность (типы печати)
CREATE TABLE color_types (
    id INT PRIMARY KEY,
    code VARCHAR(10),              -- '1+0', '1+1', '4+0', '4+4'
    description VARCHAR(255)
);

-- 1.5. Технологические операции
CREATE TABLE tech_operations (
    id INT PRIMARY KEY,
    name VARCHAR(100),             -- 'резка', 'биговка', 'фальцовка', 'ламинация'
    unit VARCHAR(20),              -- 'операция', 'минута', 'лист'
    cost_per_unit DECIMAL(10,2),   -- базовая стоимость
    time_per_unit INT              -- время в минутах на единицу
);
```

### Уровень 2. Привязка к принтерам (цены и возможности)

```sql
-- 2.1. Цены печати (принтер + материал + формат + цветность)
CREATE TABLE print_prices (
    id INT PRIMARY KEY,
    printer_id INT,
    material_id INT,
    format_id INT,
    color_type_id INT,
    cost_per_print DECIMAL(10,2),  -- себестоимость одного отпечатка
    is_active BOOLEAN DEFAULT true,
    valid_from DATE,
    valid_to DATE
);

-- 2.2. Доступные форматы для принтера (с ограничениями)
CREATE TABLE printer_formats (
    printer_id INT,
    format_id INT,
    max_sheets_per_run INT,        -- макс. листов в прогоне
    default_bleed INT DEFAULT 3    -- вылеты по умолчанию для формата
);

-- 2.3. Стоимость технологических операций для принтера
CREATE TABLE printer_operations (
    printer_id INT,
    operation_id INT,
    cost_multiplier DECIMAL(3,2) DEFAULT 1.0,  -- коэффициент к базовой стоимости
    time_multiplier DECIMAL(3,2) DEFAULT 1.0   -- коэффициент к времени
);
```

Принцип разделения логики: производственная часть (себестоимость, время операций) хранится отдельно от коммерческой (наценка).

---

## 3. Конструктор услуг (сборка калькуляторов под страницу)

Конструктор услуг — сборка готового калькулятора для конкретной страницы сайта из справочных сущностей.

```sql
-- 3.1. Конструкторы услуг (что видит пользователь на сайте)
CREATE TABLE service_constructors (
    id INT PRIMARY KEY,
    name VARCHAR(255),             -- 'Листовки А6', 'Цветная печать А4'
    slug VARCHAR(100),             -- 'listovki-a6' (для URL)
    description TEXT,
    page_title VARCHAR(255),       -- SEO
    page_description TEXT,
    is_published BOOLEAN DEFAULT false
);

-- 3.2. Настройки конструктора (самая гибкая часть)
CREATE TABLE constructor_settings (
    constructor_id INT,
    printer_id INT,                -- какой принтер использовать
    allowed_materials JSON,        -- массив ID материалов
    allowed_formats JSON,          -- массив ID форматов
    allow_custom_format BOOLEAN DEFAULT false,  -- разрешить свой размер
    allowed_color_types JSON,
    bleed_rules JSON,              -- правила вылетов, напр.: {"default": 3, "for_standard": 0, "for_custom": 3}
    default_operations JSON,       -- операции, включённые по умолчанию
    default_markup_percent DECIMAL(5,2)  -- наценка по умолчанию
);
```

### Примеры настройки конструкторов

**Конструктор «Листовки А6»:**

```
Название: Листовки А6
URL: listovki-a6
Принтер: Konica Minolta 6085
Материалы: [130 г, 250 г, 300 г]   (показываем только эти)
Форматы: [A6]                       (только А6, без своего размера)
Цветность: [4+0, 4+4]
Вылеты: по правилу "format_is_standard AND format_matches_paper" → 0 мм
Операции: резка (включена)
```

**Конструктор «Цветная печать (любые форматы)»:**

```
Название: Цветная печать на заказ
URL: color-printing
Принтер: Konica Minolta 6085
Материалы: [80 г, 130 г, 250 г]    (все бумаги)
Форматы: [A4, A3, SRA3] + разрешить свой размер
Цветность: [1+0, 1+1, 4+0, 4+4]
Вылеты:
  - для стандартных с совпадением: 0 мм
  - для стандартных с резкой: 3 мм
  - для нестандартных: 2 мм
Операции: резка (опционально, менеджер решает)
```

### Визуальный редактор конструктора (админка)

Структура экрана редактора конструктора услуги:

1. **Базовые настройки** — выбор принтера, доступных материалов (чекбоксы), доступных форматов (+ флаг «разрешить свой размер»), доступной цветности.
2. **Правила вылетов** — значение по умолчанию + особые случаи-условия (см. раздел 7).
3. **Технологические операции** — таблица операций с флагом «по умолчанию», ценой и временем:

| Операция  | По умолч. | Цена   | Время        |
|-----------|-----------|--------|--------------|
| Резка     | да        | 50 руб | 5 мин/заказ  |
| Биговка   | нет       | 30 руб | 3 мин/лист   |
| Фальцовка | нет       | 40 руб | 4 мин/лист   |
| Ламинация | нет       | 20 руб | 2 мин/лист   |

4. **Правила наценки** по тиражу (см. раздел 8).

Действия: «Предпросмотр калькулятора на сайте», «Сохранить конструктор». Конструкторы можно клонировать, чтобы не создавать похожие с нуля.

### Витрина для клиента (пример отображения)

Для конструктора «Цветная печать на заказ» клиент видит: переключатель формата (стандартный из списка / свой размер Ш×В мм), выбор бумаги, цветности, тираж, чекбоксы дополнительной обработки (резка/биговка/фальцовка), кнопку расчёта и блок результата с детализацией:

```
Стоимость: 1 250 руб
Цена за единицу: 12.50 руб
Детали расчёта:
  • Печать: 8.50 руб/шт
  • Бумага: 2.50 руб/шт
  • Резка: 1.50 руб/шт
```

---

## 4. Конструктор витрины и страниц (сборка из сущностей)

Конструкторы страниц — это сборки из готовых сущностей под конкретную страницу сайта. Фронтенд работает по `slug` страницы.

```sql
CREATE TABLE constructors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    entities JSON,                 -- список ID и типов используемых сущностей
    display_settings JSON,         -- порядок, видимость, значения по умолчанию
    client_type ENUM('b2c', 'b2b', 'both') DEFAULT 'both',  -- кому показывать
    cloned_from INT,               -- от какого конструктора скопирован (история)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Пример конструктора страницы «Листовки»

```json
{
  "constructor_id": 101,
  "name": "Листовки офсет (B2C)",
  "slug": "listovki-offset",
  "entities": {
    "formats": [201, 202, 203],
    "materials": [101, 102, 103],
    "colors": [301, 304],
    "services": [401, 402, 403],
    "partners": [701],
    "cities": [801, 802],
    "deadline_rules": [901]
  },
  "display_settings": {
    "default_format": 201,
    "default_material": 102,
    "default_color": 304,
    "default_quantity": 1000,
    "show_quantity_presets": [1000, 2000, 3000, 5000, 10000],
    "hide_services": []
  }
}
```

### Визуальный редактор конструктора страницы

Состав экрана:

- **Основные настройки** — название, URL slug, тип клиента (B2C / B2B / Оба), флаг «Активен».
- **Сущности** (перетаскиванием для смены порядка) — секции «Форматы», «Материалы», «Цветность», «Услуги», «Партнёры», «Города», «Правила сроков»; в каждой — чекбоксы выбора и кнопки «Добавить / Редактировать». Для партнёров отдельно флаг «Показывать альтернативы (только для B2B)».
- **Настройки по умолчанию** — формат, материал, цветность, тираж по умолчанию; предустановленные тиражи (через запятую); флаг «Показывать сравнение выгоды по тиражам».
- **Визуал и SEO** — заголовок страницы, описание, превью-изображение.

Действия: «Сохранить», «Сохранить как новый» (клонирование), «Предпросмотр», «Отмена». В списке конструкторов отображается метка `Скопирован с ID: N` для клонированных.

### Наследование шаблонов продуктов и переопределение

Альтернативный/дополняющий механизм — наследование от базового шаблона продукта (`product_templates`) с переопределением на уровне страницы (`pages`). Базовый шаблон знает доступные параметры, формулу расчёта и доступные доп. услуги; страница берёт всё от шаблона и меняет значения по умолчанию, добавляет/убирает параметры и услуги, меняет визуал.

```sql
-- Шаблоны продуктов
CREATE TABLE product_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255),
    slug VARCHAR(100),
    calculator_type VARCHAR(50),   -- 'sheet', 'booklet', 'sticker'
    available_parameters JSON,
    available_services JSON,
    fold_types JSON,               -- для буклетов
    created_at TIMESTAMP
);

-- Страницы сайта
CREATE TABLE pages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id INT,
    name VARCHAR(255),
    slug VARCHAR(100) UNIQUE,
    defaults JSON,                 -- значения по умолчанию
    parameters_config JSON,        -- какие параметры доступны
    services_config JSON,          -- какие услуги доступны
    preview_image VARCHAR(500),
    has_size_preview BOOLEAN DEFAULT true,
    page_title VARCHAR(255),
    meta_description TEXT,
    is_published BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (template_id) REFERENCES product_templates(id)
);

-- Связь страниц с типами сгибов (для буклетов)
CREATE TABLE page_fold_types (
    page_id INT,
    fold_type_id INT,              -- из JSON в template
    sort_order INT,
    FOREIGN KEY (page_id) REFERENCES pages(id)
);
```

**Примеры переопределения значений по умолчанию для страниц одного шаблона «Листовки (базовый)»:**

| Страница | Шаблон | Формат | Бумага  | Цветность | Тираж | Доп. услуги (include/exclude)        | Формат изменяемый |
|----------|--------|--------|---------|-----------|-------|--------------------------------------|-------------------|
| Листовки | базовый| A4     | 130 г   | 4+4       | 100   | базовые (ламинация, скругление, резка)| да               |
| Грамоты  | базовый| A4     | 300 г   | 4+0       | 50    | +фольгирование, +нумерация; −скругление| нет (фикс. А4)   |
| Плакаты  | базовый| A3     | 200 г   | —         | —     | базовые                              | да                |

### Типы сгибов для буклетов

Буклеты используют отдельный шаблон с типами сгибов; при выборе типа меняется изображение-превью (со схемой сгибов и размерами), размер в развороте и доступные форматы.

| ID                    | Название             | Кол-во сгибов | Размер в развороте | Биговка |
|-----------------------|----------------------|---------------|--------------------|---------|
| `one_fold`            | Евробуклет (1 сгиб)  | 1             | A4                 | да      |
| `two_fold_accordion`  | Гармошка (2 сгиба)   | 2             | A3                 | да      |
| `three_fold_accordion`| Гармошка (3 сгиба)   | 3             | A3                 | да      |
| `three_fold_snail`    | Улитка (3 сгиба)     | 3             | A3                 | да      |

Параметры типа сгиба: `id`, `name`, `icon` (SVG), `preview`, `unfolded_size` (размер в развороте), `folds_count`, `scoring_needed` (нужна биговка), `description`. Для страницы буклетов задаются `available_fold_types`, `default_fold_type` и признак `show_unfolded_size`.

⚠️ ОТКРЫТЫЙ ВОПРОС: в системе сосуществуют два пересекающихся механизма сборки страниц — конструкторы из сущностей (`constructors` + `constructor_settings`/`service_constructors`) и наследование шаблонов (`product_templates` + `pages`). В исходных материалах не зафиксировано, какой из них является основным, как они соотносятся между собой и не дублируют ли они функциональность.

### Фронтенд: загрузка конфигурации страницы

Фронтенд по `slug` запрашивает конфигурацию калькулятора:

```
GET /api/page-config/{slug}      (вариант: GET /api/page/{slug})
```

Ответ описывает параметры (тип поля, опции, значение по умолчанию, флаг `editable`/`readonly`, `presets`) и доп. услуги. Пример для `/gramoty`:

```json
{
  "page": { "name": "Печать грамот", "preview_image": "/images/gramota-preview.jpg" },
  "calculator": {
    "type": "sheet",
    "parameters": [
      { "name": "format", "type": "select",
        "options": [{ "value": "a4", "label": "А4 (210×297 мм)" }],
        "default": "a4", "readonly": true },
      { "name": "paper", "type": "select",
        "options": [
          { "value": "paper_300", "label": "Дизайнерская 300 г/м²", "price": 45 },
          { "value": "paper_250", "label": "Матовая 250 г/м²", "price": 32 }
        ], "default": "paper_300" },
      { "name": "color", "type": "select",
        "options": [
          { "value": "4+0", "label": "Цветная с одной стороны" },
          { "value": "4+4", "label": "Цветная с двух сторон" }
        ], "default": "4+0" },
      { "name": "quantity", "type": "number",
        "default": 50, "min": 1, "max": 1000,
        "presets": [1, 10, 20, 30, 40, 50, 100] }
    ],
    "services": [
      { "id": "foiling", "name": "Фольгирование", "type": "checkbox",
        "price": 50, "price_type": "fixed", "icon": "/icons/foil.svg" },
      { "id": "numbering", "name": "Нумерация", "type": "checkbox",
        "price": 3, "price_type": "per_item", "icon": "/icons/numbering.svg" }
    ]
  }
}
```

Для буклетов в ответ добавляется секция `fold_types` (селектор с иконками, превью, размером в развороте и описанием).

---

## 5. Конструктор полей калькуляторов (типы услуг)

Модуль «Типы услуг» — центральный справочник, определяющий категории услуг, их поведение, доступные параметры и способы расчёта. Он служит основой для конструктора услуг и маржи.

Тип услуги — это шаблон поведения, который определяет: как рассчитывается стоимость (формула, единицы); какие параметры доступны; какие доп. услуги можно добавить; какие справочники использовать; какая таблица маржи применяется по умолчанию.

### Категория vs Тип услуги

⚠️ ОТКРЫТЫЙ ВОПРОС (разрешён в исходнике): изначально категория и тип услуги смешивались. Финальное разграничение:

| Понятие     | Что это                                          | Пример                                  | Назначение                         |
|-------------|--------------------------------------------------|-----------------------------------------|------------------------------------|
| Категория   | Группа для визуальной группировки (только название, иконка, порядок) | «Печать», «Копирование», «Переплёт» | Навигация, фильтрация, права, SEO  |
| Тип услуги  | Бизнес-сущность с правилами расчёта               | «Цифровая печать», «Копирование»        | Логика расчёта, параметры, справочники |

Категория не имеет своей логики расчёта — она только группирует типы услуг.

### Структура БД

```sql
-- Категории (только для группировки)
CREATE TABLE service_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE,
    icon VARCHAR(50),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Типы услуг (бизнес-сущности)
CREATE TABLE service_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    category_id INT,               -- привязка к service_categories
    calculation_type ENUM(
        'by_sheets',   -- по листам (копирование, сканирование)
        'by_pages',    -- по страницам (брошюровка)
        'by_items',    -- по штукам (ламинация одного листа)
        'by_formula',  -- сложная формула (печать с раскладкой)
        'by_tariff'    -- тарифная сетка (факс)
    ) NOT NULL,
    default_unit VARCHAR(20) DEFAULT 'шт',
    default_margin_table_id INT,   -- таблица маржи по умолчанию
    available_parameters JSON,
    uses_dictionaries JSON,        -- ['countries', 'copy_methods', 'binding_types']
    icon VARCHAR(255),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES service_categories(id),
    FOREIGN KEY (default_margin_table_id) REFERENCES margin_tables(id)
);

-- Параметры типа услуги (какие поля показывать в форме калькулятора)
CREATE TABLE service_type_parameters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    service_type_id INT NOT NULL,
    param_name VARCHAR(100) NOT NULL,
    param_code VARCHAR(50) NOT NULL,
    field_type ENUM('select', 'radio', 'checkbox', 'number', 'text', 'range') NOT NULL,
    source_type ENUM('dictionary', 'static', 'custom') DEFAULT 'static',
    source_table VARCHAR(50),      -- таблица-справочник
    source_query TEXT,             -- кастомный запрос
    static_options JSON,           -- статические значения (если source_type = 'static')
    default_value VARCHAR(255),
    is_required BOOLEAN DEFAULT true,
    affects_price BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (service_type_id) REFERENCES service_types(id) ON DELETE CASCADE
);
```

### Предустановленные категории и типы услуг

```sql
INSERT INTO service_categories (name, slug, icon, sort_order) VALUES
('Печать', 'printing', '🖨️', 10),
('Копирование и сканирование', 'copy-scan', '📄', 20),
('Переплёт и отделка', 'binding-finishing', '📖', 30),
('Дизайн и подготовка', 'design', '🎨', 40);
```

| ID | Тип услуги             | Категория              | Способ расчёта  | Ед.   | Справочники                       |
|----|------------------------|------------------------|-----------------|-------|-----------------------------------|
| 1  | Цифровая печать        | Печать                 | by_formula      | лист  | formats, materials, color_types   |
| 2  | Офсетная печать        | Печать                 | by_formula      | лист  | formats, materials, color_types   |
| 3  | Копирование            | Копирование/сканир.    | by_sheets       | лист  | copy_methods                      |
| 4  | Сканирование           | Копирование/сканир.    | by_sheets       | лист  | scan_methods, resolutions         |
| 5  | Отправка факса         | Копирование/сканир.    | by_tariff       | лист  | countries                         |
| 6  | Брошюровка на скобе    | Переплёт и отделка     | by_pages        | шт    | binding_types                     |
| 7  | Брошюровка на пружине  | Переплёт и отделка     | by_pages        | шт    | binding_types                     |
| 8  | Ламинация              | Переплёт и отделка     | by_items        | шт    | lamination_types, film_materials  |

> **Правка аудита (Этап 1):** восстановлено разделение типов услуг «Брошюровка на скобе» (ID 6) и «Брошюровка на пружине» (ID 7), ID «Ламинации» возвращён на 8 — по DDL первоисточника (`raw/architecture.md:6047`). В диаграмме категорий первоисточника под «Переплёт и отделка» также присутствует тип «Биговка», которого нет в INSERT `service_types` (внутреннее расхождение raw — диаграмма vs DDL).

Пример параметров типа «Копирование»:

```sql
INSERT INTO service_type_parameters
  (service_type_id, param_name, param_code, field_type, source_type, source_table, sort_order) VALUES
(2, 'Способ копирования', 'copy_method', 'radio', 'dictionary', 'copy_methods', 10),
(2, 'Количество листов',  'quantity',    'number', 'static',    NULL,           20);
```

### Вспомогательные справочники

```sql
CREATE TABLE scan_methods (
    id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE, description TEXT, default_resolution INT,
    sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true
);
INSERT INTO scan_methods (name, code, description, default_resolution) VALUES
('Со стекла (планшетный)', 'glass', 'Ручная подача на стекло', 300),
('Через автоподатчик', 'auto', 'Автоматическая подача документов', 300),
('Книжный сканер', 'book', 'Сканирование книг без разбора', 300);

CREATE TABLE resolutions (
    id INT PRIMARY KEY AUTO_INCREMENT, dpi INT NOT NULL, description VARCHAR(255),
    price_coefficient DECIMAL(3,2) DEFAULT 1.0, sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true
);
INSERT INTO resolutions (dpi, description, price_coefficient) VALUES
(150, 'Черновик (150 dpi)', 0.7),
(300, 'Стандартное (300 dpi)', 1.0),
(600, 'Высокое качество (600 dpi)', 1.5),
(1200, 'Архивное качество (1200 dpi)', 2.5);

CREATE TABLE lamination_types (
    id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100) NOT NULL, code VARCHAR(50) UNIQUE,
    description TEXT, is_packet BOOLEAN DEFAULT true, sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true
);
INSERT INTO lamination_types (name, code, is_packet) VALUES
('Пакетная (холодная)', 'cold_packet', true),
('Пакетная (горячая)', 'hot_packet', true),
('Рулонная', 'roll', false);
```

### Редактор типа услуги (админка)

Редактор организован в 5 вкладок:

1. **Основные настройки** — название, системный код, описание, категория, иконка, статус; настройки расчёта (способ расчёта, единица измерения, базовая таблица маржи).
2. **Параметры** — визуальный конструктор полей формы: для каждого параметра задаётся системный код, тип поля (select/radio/checkbox/number/text/range), источник (справочник/статический/кастомный), справочник, значение по умолчанию, флаги «Обязательный» и «Влияет на цену», порядок. Тут же — живой предпросмотр формы.
3. **Справочники** — настройка значений выпадающих списков/радиокнопок (добавление/редактирование значений с кодом и флагом «по умолчанию», редактирование цен для каждого варианта).
4. **Маржа** — таблица правил наценки по диапазонам количества (см. раздел 8) с блоком «Примеры расчёта».
5. **Предпросмотр** — живой просмотр калькулятора так, как его увидит клиент (с расчётом итога).

Действия: «Сохранить», «Предпросмотр на сайте», «Клонировать», «Отключить».

### Класс работы с типами услуг

```javascript
class ServiceTypeManager {
    async getServiceType(serviceTypeId) {
        const query = `
            SELECT st.*, mt.name AS margin_table_name, stp.*
            FROM service_types st
            LEFT JOIN margin_tables mt ON mt.id = st.default_margin_table_id
            LEFT JOIN service_type_parameters stp ON stp.service_type_id = st.id
            WHERE st.id = $1 AND st.is_active = true
            ORDER BY stp.sort_order
        `;
        // ... собирает serviceType с массивом parameters
    }

    async getDictionaryValues(tableName) {
        const query = `SELECT * FROM ${tableName} WHERE is_active = true ORDER BY sort_order`;
        return (await db.query(query)).rows;
    }

    async calculateService(serviceTypeId, params) {
        const serviceType = await this.getServiceType(serviceTypeId);
        switch (serviceType.calculation_type) {
            case 'by_sheets':  return this.calculateBySheets(serviceType, params);
            case 'by_pages':   return this.calculateByPages(serviceType, params);
            case 'by_items':   return this.calculateByItems(serviceType, params);
            case 'by_tariff':  return this.calculateByTariff(serviceType, params);
            case 'by_formula': return this.calculateByFormula(serviceType, params);
            default: throw new Error(`Неизвестный тип расчёта: ${serviceType.calculation_type}`);
        }
    }
}
```

---

## 6. Настройка услуги через маржу

Любая услуга настраивается через единый механизм маржи (как для печати). Базовая цена (себестоимость) задаётся отдельно, наценка — через таблицу маржи по диапазонам количества.

Этот раздел описывает только **UI/админ-настройку** маржи услуги. Концептуальная модель универсального модуля маржи (`margin_tables` / `margin_rules` / `margin_links`, база `base_on`: `quantity` vs `total_price`, стек таблиц, маржа операций по времени) — канонический раздел [Модуль маржи (pricing-model.md, §4–5)](../04-calculators/pricing-model.md#4-модуль-маржи-универсальный-механизм). DDL-справка по таблицам — в [data-model.md](../10-tech/data-model.md#домен-ценообразование-и-маржа).

**Итоговая формула (общий случай):**

```
price = (base_price × quantity) × (1 + margin / 100)
```

### Пример: копирование (зависимость от тиража)

Базовая цена за лист задаётся для каждого способа копирования; наценка — таблица маржи. Для копирования:

| Способ        | Базовая цена (руб/лист) |
|---------------|-------------------------|
| Со стекла     | 10                      |
| Автоподатчик  | 5                       |
| Двустороннее  | 15                      |

⚠️ ОТКРЫТЫЙ ВОПРОС: базовая цена «Со стекла» в разных фрагментах указана и как 5 руб/лист (раздел «Базовая цена»), и как 10 руб/лист (таблица маржи и предпросмотр). Корректное значение не зафиксировано.

### Пример: факс (тарификация по странам)

```
price = base_price × pages × coefficient
```

Зависимость от страны (маржа 100% во всех строках):

| Страна  | Базовая цена/лист | Маржа | Итоговая цена/лист |
|---------|-------------------|-------|--------------------|
| Россия  | 20 руб            | 100%  | 40 руб             |
| СНГ     | 40 руб            | 100%  | 80 руб             |
| Европа  | 80 руб            | 100%  | 160 руб            |
| Мир     | 120 руб           | 100%  | 240 руб            |

Зависимость от количества листов (коэффициент):

| От листов | До листов | Коэффициент |
|-----------|-----------|-------------|
| 1         | 5         | 1.0         |
| 6         | 10        | 0.9         |
| 11        | 20        | 0.8         |
| 21        | ∞         | 0.7         |

Пример: Россия, 5 листов → `20 × 5 × 1.0 = 100 руб`.

### Универсальный класс расчёта услуги

```javascript
class UniversalServicePriceCalculator {
    async calculatePrice(serviceId, params) {
        const { quantity, parameter1, parameter2 } = params;  // parameterN — страна, способ и т.д.

        // 1. Базовая цена (с учётом параметров и диапазона количества)
        const priceRow = (await db.query(`
            SELECT sbp.*, s.name, s.unit, s.calculation_type
            FROM service_base_prices sbp
            JOIN services s ON s.id = sbp.service_id
            WHERE sbp.service_id = $1
              AND (sbp.parameter1 = $2 OR sbp.parameter1 IS NULL)
              AND (sbp.parameter2 = $3 OR sbp.parameter2 IS NULL)
              AND sbp.quantity_from <= $4
              AND (sbp.quantity_to >= $4 OR sbp.quantity_to IS NULL)
              AND sbp.is_active = true
            ORDER BY sbp.quantity_from DESC LIMIT 1
        `, [serviceId, parameter1, parameter2, quantity])).rows[0];

        let baseCost = priceRow.base_price * quantity;

        // 2. Маржа из margin_tables (entity_type='service')
        const margin = (await db.query(`
            SELECT mr.* FROM margin_rules mr
            JOIN margin_tables mt ON mt.id = mr.margin_table_id
            WHERE mt.entity_type = 'service' AND mt.is_active = true
              AND mr.quantity_from <= $1
              AND (mr.quantity_to >= $1 OR mr.quantity_to IS NULL)
            ORDER BY mr.quantity_from DESC LIMIT 1
        `, [quantity])).rows[0];

        let finalPrice = baseCost;
        if (margin) {
            finalPrice = margin.margin_type === 'percent'
                ? baseCost * (1 + margin.margin_value / 100)
                : baseCost + margin.margin_value;
        }
        return {
            serviceId,
            serviceName: priceRow.name,
            quantity,
            baseCost,
            finalPrice,
            breakdown: { basePrice: priceRow.base_price, margin: margin || null }
        };
    }

    // Расчёт для факса (тарификация по странам), id услуги 100 — «Факс»
    async calculateFax(country, pages) {
        return this.calculatePrice(100, { quantity: pages, parameter1: country });
    }

    // Расчёт для копирования, id услуги 101 — «Копирование»
    async calculateCopying(method, pages) {
        return this.calculatePrice(101, { quantity: pages, parameter1: method }); // method: 'glass' | 'auto'
    }
}
```

Возвращаемая структура расчёта: `serviceId`, `serviceName` (название услуги), `quantity`, `baseCost`, `finalPrice` и `breakdown` с базовой ценой за единицу (`basePrice`) и применённым правилом маржи (`margin`). Вспомогательные методы `calculateFax(country, pages)` и `calculateCopying(method, pages)` — обёртки над `calculatePrice` для конкретных услуг (факс — id 100, копирование — id 101).

### Админка зависимостей услуги

Для услуги настраиваются три блока: зависимость от тиража (таблица маржи), зависимость от способа (базовая цена за способ), дополнительные услуги (с типом расчёта — фиксированная за заказ или за лист):

| Доп. услуга | Тип расчёта     | Цена   |
|-------------|-----------------|--------|
| Сортировка  | Фикс. за заказ  | 50 руб |
| Сшивание    | Фикс. за заказ  | 30 руб |
| Сверление   | За лист         | 5 руб  |
| Степлер     | Фикс. за заказ  | 10 руб |

Ключевые решения модуля: единый механизм маржи для всех типов услуг; автоматический расчёт макс. количества страниц для брошюровки (толщина бумаги × макс. толщина корешка); параметр «страна» в базовой цене факса; зависимость от тиража через таблицу диапазонов.

---

## 7. Правила вылетов (bleed_rules) как настраиваемые

Вылеты (bleed) настраиваются не флагом «вкл/выкл», а условными правилами в JSON конструктора (`constructor_settings.bleed_rules`).

Поле допускает как короткую форму (значение по умолчанию плюс пары «случай → вылет»), приводимую в комментарии к `CREATE TABLE constructor_settings`:

```json
{ "default": 3, "for_standard": 0, "for_custom": 3 }
```

так и развёрнутую форму с массивом `rules[]` и условиями:

```json
// Пример bleed_rules для конструктора "Листовки А6"
{
  "default": 3,
  "rules": [
    {
      "condition": "format_is_standard AND format_matches_paper",
      "bleed": 0,
      "description": "Печать на готовый формат"
    },
    {
      "condition": "format_is_standard AND format_smaller_than_paper",
      "bleed": 3,
      "description": "Печать с подрезкой под стандарт"
    },
    {
      "condition": "format_is_custom",
      "bleed": 2,
      "description": "Произвольный размер (вылеты 2 мм)"
    }
  ]
}
```

В админке (блок «Правила вылетов» редактора конструктора): значение по умолчанию + список особых случаев («Если формат совпадает с бумагой → 0 мм», «Если формат стандартный, но меньше → 3 мм», «Если формат нестандартный → 2 мм»), кнопка «Добавить правило».

---

## 8. Правила маржи/наценки как настраиваемые

Правила наценки задаются таблицей диапазонов количества и могут привязываться к конкретному конструктору или к принтеру.

```sql
-- Правила наценки по тиражу
CREATE TABLE markup_rules (
    id INT PRIMARY KEY,
    constructor_id INT,            -- привязка к конструктору
    printer_id INT,                -- или к принтеру
    quantity_from INT,
    quantity_to INT,
    markup_percent DECIMAL(5,2)
);

-- Коэффициенты сложности (для нестандартных ситуаций)
CREATE TABLE complexity_factors (
    id INT PRIMARY KEY,
    name VARCHAR(100),             -- 'Много макетов', 'Нестандартный размер', 'Сложная резка'
    condition_type VARCHAR(50),    -- 'multiple_files', 'custom_size'...
    factor DECIMAL(3,2),           -- 1.2 = +20% к стоимости
    applies_to VARCHAR(50)         -- 'time', 'cost', 'both'
);
```

Пример таблицы наценки по тиражу (для конструктора цифровой печати):

| Тираж  | Наценка |
|--------|---------|
| 1–10   | 100%    |
| 11–20  | 90%     |
| 21–30  | 80%     |
| 31–40  | 70%     |
| 41+    | 60%     |

Пример таблицы маржи для услуги (копирование) с примерами расчёта при базовой цене 10 руб/лист:

| От (листов) | До (листов) | Тип    | Значение | Пример расчёта                                   |
|-------------|-------------|--------|----------|--------------------------------------------------|
| 1           | 10          | процент| 100%     | 5 листов: 50 руб × (1+100%) = 100 руб            |
| 11          | 50          | процент| 80%      | 20 листов: 200 руб × (1+80%) = 360 руб           |
| 51          | 100         | процент| 60%      | 100 листов: 1000 руб × (1+60%) = 1600 руб        |
| 101         | ∞           | процент| 50%      | —                                                |

Наценка по умолчанию хранится в `constructor_settings.default_markup_percent` (применяется, если не задана в правилах тиража).

---

## 9. Редактор формул (визуальный конструктор расчётов)

Модуль формул — универсальный конструктор математических зависимостей, позволяющий настраивать расчёты без программиста. Подробная роль формул в ценообразовании — в документе модели ценообразования (pricing-model); здесь описана конструкторская часть.

### Назначение

Модуль формул позволяет создавать формулы для расчёта: себестоимости, времени, расхода материалов, наценки; переиспользовать формулы в разных услугах; тестировать формулы перед применением.

**Примеры формул:**

```
# Цифровая печать
sheets = ceil(quantity / layout_items)
cost   = sheets × (print_price + paper_price)

# Раскладка на листе
cols = floor((sheet_width - margins) / (item_width + bleed))

# Время резки
time = (perimeter / speed) + (corners × 0.3) + (items × 0.5)

# Маржа
price = cost × (1 + margin / 100)
```

### Требования к интерфейсу

| Требование          | Зачем                                          |
|---------------------|------------------------------------------------|
| Понятный язык       | Менеджер должен понимать, что пишет            |
| Безопасность        | Нельзя сломать систему некорректной формулой   |
| Наглядность         | Сразу виден результат                          |
| Подсказки           | Доступные переменные и примеры                 |
| Сохранение истории  | Возможность вернуться к предыдущей версии      |

### Типы переменных

Система типов переменных (целочисленные, дробные, константы оборудования, настройки), у каждой — описание и пример:

| Переменная          | Тип     | Описание                       | Пример |
|---------------------|---------|--------------------------------|--------|
| sheets              | integer | Количество листов              | 125    |
| cuts                | integer | Количество резов               | 7      |
| stacks              | integer | Количество стоп                | 2      |
| stack_height        | float   | Высота стопы (мм)              | 79.8   |
| cut_speed           | float   | Скорость реза (мин/рез)        | 0.5    |
| density             | float   | Плотность бумаги (г/м²)        | 250    |
| max_stack_height    | float   | Макс. высота стопы (мм)        | 80     |
| setup_time          | float   | Время настройки (мин)          | 3      |

Справочник переменных хранится в БД, с указанием источника значения (`input` — ввод, `database` — из БД, `calculation` — расчёт, `constant`):

```sql
CREATE TABLE formula_variables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    variable_type ENUM('number', 'string', 'boolean', 'array', 'object') DEFAULT 'number',
    default_value VARCHAR(255),
    source ENUM('input', 'database', 'calculation', 'constant') DEFAULT 'input',
    source_table VARCHAR(100),     -- откуда брать, если не из ввода
    example VARCHAR(255),
    is_active BOOLEAN DEFAULT true
);

INSERT INTO formula_variables (name, description, variable_type, source) VALUES
('quantity', 'Количество (тираж, листы, штуки)', 'number', 'input'),
('sheets', 'Количество печатных листов', 'number', 'calculation'),
('items_per_sheet', 'Количество изделий на листе', 'number', 'database'),
('paper_density', 'Плотность бумаги (г/м²)', 'number', 'database'),
('print_price', 'Стоимость печати листа', 'number', 'database'),
('paper_price', 'Стоимость бумаги листа', 'number', 'database'),
('margin_percent', 'Маржа в процентах', 'number', 'database'),
('width', 'Ширина изделия (мм)', 'number', 'input'),
('height', 'Высота изделия (мм)', 'number', 'input'),
('bleed', 'Вылеты (мм)', 'number', 'database'),
('sheet_width', 'Ширина печатного листа (мм)', 'number', 'database'),
('sheet_height', 'Высота печатного листа (мм)', 'number', 'database');
```

### Структура редактора формул

Редактор организован вкладками: **Параметры (переменные) · Формула · Проверка (тестирование) · История · Шаблоны**. Рабочая область содержит:

1. **Доступные переменные** — список переменных заказа и оборудования с текущими значениями.
2. **Конструктор формулы** — поле ввода + кнопки «Проверить», «Очистить», «Вставить шаблон».
3. **Результат проверки** — статус корректности и тестовый расчёт.

### Визуальный конструктор (drag-and-drop)

Переменные и операторы перетаскиваются в формулу. Доступные операторы: `+  -  ×  ÷  ^  (  )  =  >  <  >=  <=` и функции `ceil`, `floor`, `round`, `min`, `max`, `abs`, `sin`, `cos`, `sqrt`, `if/then/else`.

### Шаблоны формул

Готовые шаблоны для быстрого старта (с действиями «Применить» / «Редактировать»):

```
# Гильотинная резка (базовая)
setup_time + stacks × cuts × cut_speed

# Гильотинная резка (с учётом высоты)
setup_time + stacks × cuts × cut_speed × (1 + (stack_height / max_height) × 0.5)

# Плоттерная резка (простая)
setup_time + (perimeter / speed) × items + corners × 0.3 + (items - 1) × 1.0 + 2

# Ламинация пакетная
sheets × time_per_sheet + cutting_time
```

Можно создавать собственные шаблоны (кнопка «Создать шаблон», действие «Сохранить как шаблон»).

### Валидация и тестирование

Проверка формулы включает:

1. Только разрешённые символы и функции.
2. Баланс скобок (отдельные сообщения о лишней закрывающей и о недостающей закрывающей).
3. Все переменные известны (иначе ошибка `Неизвестные переменные: ...`).
4. Пробное вычисление на автоматически сгенерированных тестовых значениях.
5. Подсказки по оптимизации (например, «Рекомендуем проверить приоритет операций», «Слишком много вложенных скобок»).

Класс валидатора оперирует белым списком функций (`['sin', 'cos', 'sqrt', 'min', 'max', 'abs']`) и операторов (`['+', '-', '*', '/', '^', '(', ')']`). Тестовые значения генерируются эвристически по имени переменной (содержит `height`/`width` → 100; `speed` → 0.5; `count`/`sheets` → 10; иначе 1).

Вкладка «Тестирование»: пользователь задаёт входные данные, получает результат выполнения, видит время выполнения (например, 0.5 мс), может сохранить набор как пример.

### Примеры расчёта (тестовые прогоны)

```
# Гильотинная резка с учётом высоты
sheets=125, cuts=7, stack_height=79.8, max_height=80, cut_speed=0.5, setup_time=3
3 + (1 × 7 × 0.5 × (1 + 79.8/80 × 0.5)) = 3 + (3.5 × 1.5) ≈ 8.25 мин

# Тот же шаблон при stacks=2
3 + (2 × 7 × 0.5 × (1 + 80/80 × 0.5)) = 3 + (7 × 1.5) = 13.5 мин

# Себестоимость цифровой печати
quantity=100, items_per_sheet=4, print_price=25, paper_price=3
sheets = ceil(100 / 4) = 25
cost   = 25 × (25 + 3) = 700 руб
```

### Версионирование и история изменений

Хранится история версий формулы с автором, датой, причиной изменения и текстом формулы; доступны действия «Восстановить» и «Сравнить».

Пример истории для оборудования «Boway BW-4908 V9»:

| Версия | Дата/время       | Автор      | Изменение                       | Формула                                          |
|--------|------------------|------------|---------------------------------|--------------------------------------------------|
| 1.3    | 11.03.2026 14:30 | Иванов А.  | Добавлен коэффициент высоты      | `setup + stacks×cuts×speed×(1+height/80)`        |
| 1.2    | 10.03.2026 09:15 | Петрова М. | Уточнена базовая скорость        | `setup + stacks×cuts×speed`                      |
| 1.1    | 09.03.2026 16:20 | Сидоров К. | Добавлено время настройки        | `stacks×cuts×speed`                              |

### Структура БД модуля формул

Формула хранится в двух видах: текст и распарсенное AST-дерево для быстрого вычисления.

```sql
-- Формула, привязанная к оборудованию (версионируемая)
CREATE TABLE equipment_formulas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    equipment_id INT NOT NULL,
    version INT NOT NULL,
    is_current BOOLEAN DEFAULT false,
    formula_text TEXT NOT NULL,    -- "setup + stacks * cuts * speed * (1 + height/80)"
    formula_parsed JSON,           -- AST-дерево для быстрого вычисления
    variables JSON NOT NULL,       -- ["setup", "stacks", "cuts", "speed", "height"]
    description TEXT,
    changed_by INT,
    change_reason TEXT,
    test_values JSON,              -- для автоматической проверки
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment_models(id),
    INDEX idx_equipment_current (equipment_id, is_current)
);

-- Категории формул (группировка)
CREATE TABLE formula_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL, slug VARCHAR(50) UNIQUE, description TEXT,
    icon VARCHAR(50), sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true
);
INSERT INTO formula_categories (name, slug, icon, sort_order) VALUES
('Расчёт себестоимости', 'cost-calculation', '💰', 10),
('Расчёт раскладки', 'layout-calculation', '📐', 20),
('Расчёт времени', 'time-calculation', '⏱️', 30),
('Расчёт материалов', 'material-calculation', '📦', 40),
('Расчёт наценки', 'margin-calculation', '💹', 50),
('Валидация', 'validation', '✅', 60);

-- Универсальные формулы
CREATE TABLE formulas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    category_id INT,
    description TEXT,
    formula_text TEXT NOT NULL,    -- "sheets = ceil(quantity / items_per_sheet)"
    formula_type ENUM('cost', 'time', 'material', 'margin', 'layout', 'validation') NOT NULL,
    result_type ENUM('number', 'boolean', 'string') DEFAULT 'number',
    result_unit VARCHAR(20),       -- 'руб', 'мин', 'лист', 'шт'
    available_variables JSON,
    example_input JSON,
    example_output VARCHAR(255),
    version INT DEFAULT 1,
    is_current BOOLEAN DEFAULT true,
    parent_formula_id INT,         -- для истории версий
    is_active BOOLEAN DEFAULT true,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES formula_categories(id),
    INDEX idx_type_active (formula_type, is_active),
    INDEX idx_code (code)
);

-- Привязка формул к сущностям (переиспользование)
CREATE TABLE formula_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    formula_id INT NOT NULL,
    entity_type ENUM('constructor', 'service', 'material', 'equipment') NOT NULL,
    entity_id INT NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (formula_id) REFERENCES formulas(id),
    UNIQUE KEY unique_link (formula_id, entity_type, entity_id)
);

-- История вычислений (для отладки)
CREATE TABLE formula_execution_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    formula_id INT NOT NULL,
    input_values JSON,
    output_value VARCHAR(255),
    execution_time_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (formula_id) REFERENCES formulas(id),
    INDEX idx_formula_time (formula_id, created_at)
);
```

### Примеры формул в БД

```sql
-- Себестоимость цифровой печати
INSERT INTO formulas (name, code, category_id, formula_text, formula_type, result_unit, available_variables) VALUES
('Себестоимость цифровой печати', 'digital_print_cost', 1,
 'sheets = ceil(quantity / items_per_sheet); cost = sheets × (print_price + paper_price)',
 'cost', 'руб', '["quantity", "items_per_sheet", "print_price", "paper_price"]');

-- Себестоимость офсетной печати (закупка у партнёра + доставка + допы)
INSERT INTO formulas (...) VALUES
('Себестоимость офсетной печати', 'offset_print_cost', 1,
 'cost = partner_price + delivery + extra',
 'cost', 'руб', '["partner_price", "delivery", "extra"]');

-- Раскладка на SRA3
INSERT INTO formulas (...) VALUES
('Раскладка на SRA3', 'sra3_layout', 2,
 'item_w = width + bleed*2; item_h = height + bleed*2; cols = floor((sheet_width - 2) / item_w); rows = floor((sheet_height - 6) / item_h); items_per_sheet = cols × rows',
 'layout', 'шт', '["width", "height", "bleed", "sheet_width", "sheet_height"]');

-- Время гильотинной резки
INSERT INTO formulas (...) VALUES
('Время гильотинной резки', 'guillotine_time', 3,
 'stacks = ceil(sheets / max_sheets_per_stack); cuts = (cols-1) + (rows-1)×cols; time = stacks × cuts × cut_speed × (1 + stack_height/80×0.5) + setup_time',
 'time', 'мин', '["sheets", "max_sheets_per_stack", "cols", "rows", "cut_speed", "stack_height", "setup_time"]');

-- Тариф факса по странам
INSERT INTO formulas (...) VALUES
('Тариф факса по странам', 'fax_tariff', 4,
 'price = CASE country WHEN "Россия" THEN 20 WHEN "СНГ" THEN 40 WHEN "Европа" THEN 80 ELSE 120 END; total = price × pages',
 'cost', 'руб', '["country", "pages"]');
```

### Движок вычисления формул (кэширование, многострочность)

`FormulaEngine` кэширует загруженные формулы в `Map`, поддерживает многострочные формулы (строки разделяются `;`, присваивания обновляют контекст), логирует выполнение и валидирует синтаксис.

```javascript
class FormulaEngine {
    constructor() { this.formulasCache = new Map(); }

    async loadFormula(code) {
        if (this.formulasCache.has(code)) return this.formulasCache.get(code);
        const result = await db.query(
            `SELECT * FROM formulas WHERE code = $1 AND is_current = true AND is_active = true`, [code]);
        if (result.rows.length === 0) throw new Error(`Формула ${code} не найдена`);
        const formula = result.rows[0];
        this.formulasCache.set(code, formula);
        return formula;
    }

    async evaluate(formulaCode, inputValues) {
        const formula = await this.loadFormula(formulaCode);
        const context = { ...inputValues };
        const lines = formula.formula_text.split(';');
        let result;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const fn = new Function(...Object.keys(context), `return (${trimmed})`);
            result = fn(...Object.values(context));
            const assignMatch = trimmed.match(/^(\w+)\s*=/);
            if (assignMatch) context[assignMatch[1]] = result;  // присваивание обновляет контекст
        }
        await this.logExecution(formula.id, inputValues, result);
        return { success: true, result, unit: formula.result_unit, context };
    }
    // validateSyntax(...) — проверка неизвестных переменных + пробное вычисление
}
```

### Безопасный движок: `FormulaEvaluator` (math.js)

В блоке проектирования редактора формул (привязанного к оборудованию) предлагался альтернативный, безопасный движок `FormulaEvaluator` на базе парсера `math.js` (`math.parser()`). Он подставляет значения переменных в текст формулы (по границам слов `\b`) и вычисляет результат через `parser.evaluate(...)` вместо `new Function(...)`, что исключает выполнение произвольного JS-кода.

```javascript
class FormulaEvaluator {
    constructor() {
        this.parser = new math.parser(); // используем math.js
    }

    evaluate(formula, variables) {
        // Подставляем значения переменных по границам слов
        let compiledFormula = formula;
        for (const [key, value] of Object.entries(variables)) {
            compiledFormula = compiledFormula.replace(
                new RegExp(`\\b${key}\\b`, 'g'), value.toString());
        }
        // Безопасное вычисление через парсер math.js
        try {
            const result = this.parser.evaluate(compiledFormula);
            return { success: true, result, formula: compiledFormula };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // Проверка, что в формуле использованы только разрешённые переменные
    validateFormula(formula, allowedVars) {
        const varPattern = new RegExp(`\\b(${allowedVars.join('|')})\\b`, 'g');
        const usedVars = formula.match(varPattern) || [];
        const unknownVars = usedVars.filter(v => !allowedVars.includes(v));
        if (unknownVars.length > 0) {
            return { valid: false, error: `Неизвестные переменные: ${unknownVars.join(', ')}` };
        }
        return { valid: true };
    }
}
```

> Примечание по безопасности: в исходных материалах модуль формул (универсальный, на таблице `formulas`) реализован через `new Function(...)`. Это противоречит требованию «нельзя сломать систему кривой формулой» — выполнение произвольного JS-кода небезопасно. Параллельно для редактора формул оборудования спроектирован безопасный путь через `FormulaEvaluator` (`math.parser()`), показанный выше.

⚠️ ОТКРЫТЫЙ ВОПРОС: способ безопасного вычисления формул не унифицирован — в одном фрагменте используется `new Function()` (потенциально небезопасно), в другом — парсер `math.js`. Нужно зафиксировать единый безопасный движок.

### Использование в калькуляторе

```javascript
class DigitalPrintCalculator {
    async calculate(params) {
        const engine = new FormulaEngine();
        const layout = await engine.evaluate('sra3_layout', {
            width: params.width, height: params.height, bleed: 3,
            sheet_width: 320, sheet_height: 450
        });
        const cost = await engine.evaluate('digital_print_cost', {
            quantity: params.quantity,
            items_per_sheet: layout.result,
            print_price: await this.getPrintPrice(params.colorType),
            paper_price: await this.getPaperPrice(params.paperId)
        });
        const price = await engine.evaluate('margin_price', {
            cost: cost.result,
            margin_percent: await this.getMargin(params.quantity)
        });
        return { cost: cost.result, price: price.result, layout: layout.result };
    }
}
```

### Сводка возможностей модуля формул

| Возможность           | Описание                                              |
|-----------------------|-------------------------------------------------------|
| Визуальный редактор   | Создание формул без программиста                      |
| Доступные переменные  | Справочник всех переменных                            |
| Проверка синтаксиса   | Мгновенная валидация формулы                          |
| Тестирование          | Проверка формулы на тестовых данных                   |
| Версионирование       | История изменений формул                              |
| Привязка к сущностям  | Одна формула — в разных услугах (`formula_links`)     |
| Кэширование           | Быстрое выполнение часто используемых формул          |
| Логирование           | Запись всех вычислений для отладки                    |

---

## Источник

Материал собран из `raw/architecture.md`:

- строки 4541–4608 — интерфейс ввода формул (редактор формул): требования, архитектура, типы переменных, визуальный конструктор, шаблоны, валидация/тестирование, история версий, схема БД `equipment_formulas`, безопасный класс `FormulaEvaluator` (`math.parser()`) с методами `evaluate` и `validateFormula`;
- строки 7420–7511 — модуль формул как универсальный конструктор расчётов: таблицы БД (`formula_categories`, `formulas`, `formula_variables`, `formula_links`, `formula_execution_log`), примеры формул, редактор в админке, класс `FormulaEngine`, кэширование/версионирование;
- строки 4185–4227 — единый конструктор сущностей: философия «всё — сущность», базовая структура, таблица `constructors`, визуальный редактор конструктора страницы, клонирование;
- строки 5633–5748 — универсальная система настройки калькуляторов: наследование/переопределение шаблонов продуктов (`product_templates`, `pages`), типы сгибов буклетов, конструктор полей калькуляторов, API `/api/page-config/{slug}`;
- строки 5850–6080 — модуль «Типы услуг» (справочник-шаблон поведения), админка типов услуг (5 вкладок), разграничение «категория vs тип услуги», вспомогательные справочники, класс `ServiceTypeManager`;
- строки 8326–8377 — настройка услуги через маржу, универсальный класс `UniversalServicePriceCalculator`, админка зависимостей услуги;
- строки 10160–10232 — справочники + конструкторы: уровни 1–4 (справочники, привязка к принтерам, конструкторы услуг, правила наценки), правила вылетов `bleed_rules`, коэффициенты сложности;
- строки 8326–8377 (дополнительно) — вспомогательные методы `calculateFax`/`calculateCopying` (id услуг 100/101) и поля `serviceName`/`breakdown` в результате расчёта;
- строки 86–91 — обзорные пункты конструкторской части (справочники + конструкторы, конструктор оборудования и ТЗ, универсальная система витрины и кросс-продаж, настройка отображения вариантов товара, вывод услуги «Визитки» на страницу, настройка доп. услуг).
