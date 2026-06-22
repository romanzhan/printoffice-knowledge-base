# Калькулятор цифровой печати

Полная логика расчёта стоимости цифровой печати на собственном оборудовании (Konica Minolta 6085): расчёт количества печатных листов SRA3, себестоимости (бумага + краска), применения маржи по числу потраченных листов и формирования цены для клиента.

## Назначение и принцип

Цифровая печать выполняется на собственном принтере (Konica Minolta 6085) на печатном листе формата SRA3 (320×450 мм). Особенность ценообразования цифры: маржа начисляется не на тираж готовых изделий в штуках, а на **количество физически потраченных листов SRA3**.

Общий принцип:
1. Клиент выбирает формат, бумагу, цветность, тираж и допуслуги.
2. Система рассчитывает, сколько изделий помещается на одном листе SRA3, и вычисляет число печатных листов.
3. Считается себестоимость = листы × (печать + бумага).
4. По числу листов SRA3 находится правило в таблице маржи и применяется наценка.
5. Добавляются допуслуги, формируется итоговая цена.

## Входные параметры заказа

Параметры, которые клиент выбирает на сайте (вход калькулятора):

| Параметр | Значения / описание |
| --- | --- |
| Формат готовой продукции | A4 (210×297), A5 (148×210), A6 (105×148), A3 (297×420), SRA3 (320×450), Евро (98×210), либо свой размер (ширина × высота в мм) |
| Бумага / материал | из списка доступных (по плотности, типу поверхности, цвету — см. ниже) |
| Цветность | 1+0, 1+1, 4+0, 4+4 |
| Тираж | число готовых изделий |
| Дополнительные услуги | ламинация, биговка, скругление углов и т. п. |

### Бумага / материал

Клиент выбирает бумагу по трём осям параметров.

**По плотности (с типовым назначением):**

| Плотность | Тип | Типовое назначение |
| --- | --- | --- |
| 80 г/м² | офсетная | для черновиков |
| 130 г/м² | мелованная | для листовок |
| 200 г/м² | плотная | для визиток |
| 250 г/м² | очень плотная | для обложек |
| 300 г/м² | дизайнерская | — |

**По типу поверхности:** Матовая, Глянцевая, Сатинированная.

**По цвету:** Белая, Цветная (с уточнением какого цвета), Дизайнерская (с фактурой).

После выбора система проверяет наличие на складе: если есть — продолжаем, иначе — предупреждение и предложение альтернативы.

### Цветность

| Код | Расшифровка |
| --- | --- |
| 1+0 | чёрно-белая односторонняя |
| 1+1 | чёрно-белая двусторонняя |
| 4+0 | цветная односторонняя |
| 4+4 | цветная двусторонняя |

### Проверки на этапе ввода

- **Формат:** если больше максимального — «нужна широкоформатная печать»; если меньше минимального — «нужна вырубка на плоттере».
- **Бумага:** проверка наличия на складе; при отсутствии — предупреждение и предложение альтернативы.
- **Тираж:** если меньше минимального (например, 10 шт) — сообщение о минимальном тираже; если больше максимального для цифры — рекомендация офсетной печати; если тираж промежуточный (нет в таблице цен) — расчёт по ближайшему большему тиражу.

## Алгоритм расчёта

### Общая схема

```
КЛИЕНТ НА САЙТЕ
   │
   ▼
1. ВЫБОР ПАРАМЕТРОВ (формат, бумага, цветность, тираж, допуслуги)
   │
   ▼
2. РАСЧЁТ ПЕЧАТНЫХ ЛИСТОВ
   sheets = ceil(тираж / items_per_sheet)
   │
   ▼
3. СЕБЕСТОИМОСТЬ ПЕЧАТИ
   total_cost = sheets × (print_price + paper_price)
   │
   ▼
4. ПРИМЕНЕНИЕ МАРЖИ (правило по числу листов)
   client_price = total_cost × (1 + margin_percent/100)
   │
   ▼
5. ДОПОЛНИТЕЛЬНЫЕ УСЛУГИ (себестоимость + своя маржа)
   │
   ▼
6. ИТОГОВАЯ ЦЕНА ДЛЯ КЛИЕНТА
```

### Шаги расчёта

**Шаг 1. Количество печатных листов SRA3.** Определяется, сколько готовых изделий помещается на одном листе SRA3 (`items_per_sheet`), затем число листов округляется всегда вверх (нельзя напечатать пол-листа):

```
sheets = ceil(тираж / items_per_sheet)
```

**Шаг 2. Себестоимость бумаги.**

```
paper_cost = sheets × paper_price_per_sheet
```

**Шаг 3. Себестоимость печати (краска, без бумаги).** Цена за лист зависит от цветности:

```
print_cost = sheets × print_price_per_sheet
```

**Шаг 4. Общая себестоимость (наши затраты).**

```
total_cost = paper_cost + print_cost
```

**Шаг 5. Наценка и цена для клиента.** По числу листов SRA3 ищется правило в таблице маржи. Для процентной наценки:

```
client_price = total_cost × (1 + margin_percent / 100)
```

Для фиксированной наценки:

```
client_price = total_cost + margin_value
```

**Шаг 6. Цена за единицу продукции.**

```
price_per_item = client_price / тираж
```

### Сводная бизнес-логика (краткая запись)

```
sheets = ceil(quantity / items_per_sheet)
cost   = sheets × (print_price + paper_price)
price  = cost × (1 + margin/100)
```

## Итоговая формула

```
Цена для клиента = (sheets × (print_price + paper_price)) × (1 + margin/100) + Σ(services_price)
```

Где:
- `sheets = ceil(тираж / items_per_sheet)` — число потраченных листов SRA3;
- `print_price` — из `print_base_costs` (зависит от цветности);
- `paper_price` — из `paper_costs` (зависит от выбранной бумаги);
- `margin` — из `margin_rules` (зависит от **количества листов SRA3**, а не от тиража в штуках);
- `services_price` — себестоимость услуги × (1 + margin_service/100).

## Маржа на потраченный лист SRA3

Маржа начисляется на количество физически потраченных листов SRA3. Это ключевая особенность цифры: для формата A4 при тираже 200 шт (2 изделия на лист) система ищет правило для 100 листов, а не для 200 штук.

Исходный концептуальный пример (как это было сформулировано изначально): клиент выбирает формат A4, на лист SRA3 помещается 2 шт, тираж 100 шт → затраты 50 листов → ищем в таблице маржи цену в диапазоне «50 и выше» и берём цену для клиента, после чего добавляем допуслуги, если они есть.

Стандартная таблица маржи (цифра):

| От листов | До листов | Тип | Значение |
| --- | --- | --- | --- |
| 1 | 10 | процент | 100% |
| 11 | 20 | процент | 90% |
| 21 | 30 | процент | 80% |
| 31 | 50 | процент | 70% |
| 51 | ∞ | процент | 60% |

Если подходящего правила не найдено, применяется наценка по умолчанию 50%.

Концепция маржи допускает несколько таблиц: помимо стандартной можно создавать таблицы с повышенной маржой и т. п. Таблица описывается доступными сущностями: принтер, формат, цветность, значение маржи в числах и в процентах. Правила могут задаваться как в процентах (умножают себестоимость), так и фиксированной суммой (прибавляются к себестоимости). Пример исходной идеи диапазонов: затраты 10–50 листов = +15 руб либо 50%, 51–100 листов = +10 руб либо 40% и т. д.

Цифровая таблица маржи — это частный случай универсального модуля маржи (`margin_tables` / `margin_rules` / `margin_links`), общего для печати, копирования, офсета, услуг, материалов и операций. Концептуальное описание модуля — структура таблиц, атрибуты Margin Table / Margin Rule, база наценки `base_on` (`quantity` для цифры/копирования vs `total_price` для офсета), стек таблиц и маржа операций по времени — см. канонический раздел [Модуль маржи и единый механизм (pricing-model.md, §4–5)](pricing-model.md#4-модуль-маржи-универсальный-механизм). Для цифры `base_on = quantity`, единица — листы SRA3.

### Исходная (ошибочная) таблица маржи со скриншота

В первоначальной таблице маржи (по скриншоту админки) интервалы затрат листов SRA3 были заданы как строки **1–41, 41–49, 50–99** и т. д. Поле этого диапазона при этом было подписано «Тираж», что и вводило в заблуждение. Корректная стандартная таблица приведена выше (1–10 / 11–20 / 21–30 / 31–50 / 51+).

⚠️ ОТКРЫТЫЙ ВОПРОС: поле диапазона в админке исторически называлось «Тираж», что приводит к ошибке — для тиража 200 шт A4 система ищет правило по 200, а не по числу листов SRA3 (100). Требуется переименовать поле для цифровой печати и копирования в «Затраты листов (SRA3)» / «Количество листов (SRA3)». Технически в `calculateMargin()` для цифры передаётся `quantity = sheets_spent`, а для копирования `quantity = количество копий`.

После переименования поля ошибка уйдёт: для тиража 200 шт A4 → `sheets_spent = 100` → будет взята строка диапазона **100–199** (значение 66 руб, как и для А3), а не строка для 200.

## Структура базы данных

### Принтеры

```sql
CREATE TABLE printers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    type ENUM('digital', 'offset', 'wide') DEFAULT 'digital',
    is_active BOOLEAN DEFAULT true
);

INSERT INTO printers (id, name, slug, type) VALUES
(1, 'Konica Minolta 6085', 'konica-6085', 'digital');
```

### Бумага / материалы

```sql
CREATE TABLE materials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    category ENUM('paper', 'film', 'cardboard', 'other') DEFAULT 'paper',
    density INT,                           -- г/м²
    is_active BOOLEAN DEFAULT true
);

INSERT INTO materials (id, name, category, density) VALUES
(101, 'Мелованная 130 г/м²', 'paper', 130),
(102, 'Мелованная 200 г/м²', 'paper', 200),
(103, 'Мелованная 300 г/м²', 'paper', 300),
(104, 'Офсетная 80 г/м²', 'paper', 80),
(105, 'Дизайнерская', 'paper', 250);
```

### Себестоимость печати (без бумаги)

```sql
CREATE TABLE print_base_costs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    printer_id INT NOT NULL,
    color_type VARCHAR(10) NOT NULL,       -- '1+0', '1+1', '4+0', '4+4'
    cost_per_sheet DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (printer_id) REFERENCES printers(id)
);

INSERT INTO print_base_costs (printer_id, color_type, cost_per_sheet) VALUES
(1, '1+0', 5.00),
(1, '1+1', 8.00),
(1, '4+0', 20.00),
(1, '4+4', 25.00);
```

Себестоимость печати листа SRA3 по цветности (Konica 6085):

| Цветность | Стоимость, руб |
| --- | --- |
| 1+0 | 5.00 |
| 1+1 | 8.00 |
| 4+0 | 20.00 |
| 4+4 | 25.00 |

### Себестоимость бумаги

```sql
CREATE TABLE paper_costs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paper_id INT NOT NULL,
    format VARCHAR(20) DEFAULT 'SRA3',
    cost_per_sheet DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (paper_id) REFERENCES materials(id)
);

INSERT INTO paper_costs (paper_id, format, cost_per_sheet) VALUES
(101, 'SRA3', 3.00),   -- мелованная 130
(102, 'SRA3', 4.50),   -- мелованная 200
(103, 'SRA3', 6.00),   -- мелованная 300
(104, 'SRA3', 2.00),   -- офсетная 80
(105, 'SRA3', 8.00);   -- дизайнерская
```

Себестоимость листа бумаги SRA3:

| Бумага | Плотность | Стоимость, руб |
| --- | --- | --- |
| Мелованная 130 г/м² | 130 | 3.00 |
| Мелованная 200 г/м² | 200 | 4.50 |
| Мелованная 300 г/м² | 300 | 6.00 |
| Офсетная 80 г/м² | 80 | 2.00 |
| Дизайнерская | 250 | 8.00 |

### Раскладка на листе

```sql
CREATE TABLE layout_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_format VARCHAR(20) NOT NULL,    -- 'A4', 'A5', 'A6', 'A3'
    orientation ENUM('portrait', 'landscape') DEFAULT 'portrait',
    items_per_sheet INT NOT NULL,
    bleed INT DEFAULT 3,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO layout_rules (product_format, orientation, items_per_sheet, bleed) VALUES
('A4', 'portrait', 2, 3),
('A5', 'landscape', 8, 3),
('A6', 'portrait', 8, 3),
('A3', 'portrait', 1, 0);
```

Раскладка изделий на лист SRA3:

| Формат | Ориентация | Шт/лист | Вылеты |
| --- | --- | --- | --- |
| A4 | книжная | 2 | 3 мм |
| A5 | альбомная | 8 | 3 мм |
| A6 | книжная | 8 | 3 мм |
| A3 | книжная | 1 | 0 мм |

### Таблицы и правила маржи

```sql
-- Таблицы маржи
CREATE TABLE margin_tables (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    applies_to ENUM('printing', 'service', 'total') DEFAULT 'printing',
    is_active BOOLEAN DEFAULT true
);

-- Правила маржи
CREATE TABLE margin_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    margin_table_id INT NOT NULL,
    sheets_from INT NOT NULL,
    sheets_to INT,
    margin_type ENUM('percent', 'fixed') NOT NULL,
    margin_value DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (margin_table_id) REFERENCES margin_tables(id)
);

INSERT INTO margin_tables (id, name, slug, applies_to) VALUES
(1, 'Стандартная маржа (цифра)', 'standart-margin-digital', 'printing');

INSERT INTO margin_rules (margin_table_id, sheets_from, sheets_to, margin_type, margin_value) VALUES
(1, 1, 10, 'percent', 100),
(1, 11, 20, 'percent', 90),
(1, 21, 30, 'percent', 80),
(1, 31, 50, 'percent', 70),
(1, 51, NULL, 'percent', 60);
```

### Дополнительные услуги

```sql
CREATE TABLE services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    calculation_type ENUM('per_sheet', 'per_item', 'fixed') NOT NULL,
    cost_per_unit DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO services (id, name, slug, calculation_type, cost_per_unit) VALUES
(301, 'Ламинация', 'lamination', 'per_sheet', 15.00),
(302, 'Биговка', 'scoring', 'per_item', 3.00),
(303, 'Скругление углов', 'round-corners', 'per_item', 5.00);
```

### Привязка к конструктору

```sql
-- Конструкторы страниц
CREATE TABLE constructors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    margin_table_id INT,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (margin_table_id) REFERENCES margin_tables(id)
);

-- Доступные бумаги в конструкторе
CREATE TABLE constructor_papers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    constructor_id INT NOT NULL,
    paper_id INT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (constructor_id) REFERENCES constructors(id),
    FOREIGN KEY (paper_id) REFERENCES materials(id)
);
```

## Класс расчёта (DigitalPrintCalculator)

```javascript
class DigitalPrintCalculator {
    constructor() {
        this.printerId = 1;
        this.sheetFormat = 'SRA3';
        this.sheetSize = { width: 320, height: 450 };
    }

    // Главный метод расчёта
    async calculate(params) {
        const {
            format,           // 'A4', 'A5', 'A6', 'custom'
            customWidth,
            customHeight,
            colorType,        // '1+0', '1+1', '4+0', '4+4'
            paperId,          // ID выбранной бумаги
            quantity,
            services = []
        } = params;

        // 1. Раскладка на листе
        const layout = await this.getLayout(format, customWidth, customHeight);
        const sheets = Math.ceil(quantity / layout.items_per_sheet);

        // 2. Себестоимость печати (без бумаги)
        const printCostPerSheet = await this.getPrintCost(colorType);
        const printCost = sheets * printCostPerSheet;

        // 3. Себестоимость бумаги
        const paperCostPerSheet = await this.getPaperCost(paperId);
        const paperCost = sheets * paperCostPerSheet;

        // 4. Общая себестоимость
        const totalCost = printCost + paperCost;

        // 5. Маржа
        const margin = await this.getMargin(sheets);
        let clientPrice;
        if (margin.margin_type === 'percent') {
            clientPrice = totalCost * (1 + margin.margin_value / 100);
        } else {
            clientPrice = totalCost + margin.margin_value;
        }

        // 6. Дополнительные услуги
        let servicesTotal = 0;
        const servicesBreakdown = [];
        for (const service of services) {
            const serviceCalc = await this.calculateService(service, { sheets, quantity });
            servicesTotal += serviceCalc.clientPrice;
            servicesBreakdown.push(serviceCalc);
        }

        // 7. Итог
        const finalPrice = clientPrice + servicesTotal;

        return {
            success: true,
            breakdown: {
                sheets,
                items_per_sheet: layout.items_per_sheet,
                print_cost: printCost,
                paper_cost: paperCost,
                paper_name: await this.getPaperName(paperId),
                total_cost: totalCost,
                margin: {
                    sheets_range: margin.sheets_range,
                    margin_type: margin.margin_type,
                    margin_value: margin.margin_value,
                    margin_amount: clientPrice - totalCost
                },
                client_print_price: clientPrice,
                services: servicesBreakdown,
                final_price: finalPrice
            },
            summary: {
                sheets,
                price_per_sheet: (clientPrice / sheets).toFixed(2),
                price_per_item: (finalPrice / quantity).toFixed(2),
                total: finalPrice
            }
        };
    }

    // Раскладка на листе
    async getLayout(format, customWidth, customHeight) {
        if (format === 'custom') {
            return this.calculateCustomLayout(customWidth, customHeight);
        }
        const query = `
            SELECT items_per_sheet, orientation
            FROM layout_rules
            WHERE product_format = $1 AND is_active = true
            ORDER BY items_per_sheet DESC
            LIMIT 1
        `;
        const result = await db.query(query, [format]);
        if (result.rows.length === 0) {
            throw new Error(`Нет раскладки для формата ${format}`);
        }
        return {
            items_per_sheet: result.rows[0].items_per_sheet,
            orientation: result.rows[0].orientation,
            sheet_format: this.sheetFormat,
            sheet_size: this.sheetSize
        };
    }

    // Раскладка для нестандартного размера
    calculateCustomLayout(width, height) {
        const bleed = 3;
        const itemWidth = width + bleed * 2;
        const itemHeight = height + bleed * 2;

        const portraitCols = Math.floor(this.sheetSize.width / itemWidth);
        const portraitRows = Math.floor(this.sheetSize.height / itemHeight);
        const portraitItems = portraitCols * portraitRows;

        const landscapeCols = Math.floor(this.sheetSize.width / itemHeight);
        const landscapeRows = Math.floor(this.sheetSize.height / itemWidth);
        const landscapeItems = landscapeCols * landscapeRows;

        let best;
        if (portraitItems >= landscapeItems) {
            best = { items_per_sheet: portraitItems, orientation: 'portrait', cols: portraitCols, rows: portraitRows };
        } else {
            best = { items_per_sheet: landscapeItems, orientation: 'landscape', cols: landscapeCols, rows: landscapeRows };
        }

        return {
            ...best,
            sheet_format: this.sheetFormat,
            sheet_size: this.sheetSize,
            item_size: { width: itemWidth, height: itemHeight }
        };
    }

    // Себестоимость печати (без бумаги)
    async getPrintCost(colorType) {
        const query = `
            SELECT cost_per_sheet
            FROM print_base_costs
            WHERE printer_id = $1 AND color_type = $2 AND is_active = true
        `;
        const result = await db.query(query, [this.printerId, colorType]);
        if (result.rows.length === 0) {
            throw new Error(`Нет цены печати для цветности ${colorType}`);
        }
        return parseFloat(result.rows[0].cost_per_sheet);
    }

    // Себестоимость бумаги
    async getPaperCost(paperId) {
        const query = `
            SELECT cost_per_sheet
            FROM paper_costs
            WHERE paper_id = $1 AND format = $2 AND is_active = true
        `;
        const result = await db.query(query, [paperId, this.sheetFormat]);
        if (result.rows.length === 0) {
            throw new Error(`Нет цены для бумаги ID ${paperId}`);
        }
        return parseFloat(result.rows[0].cost_per_sheet);
    }

    // Название бумаги
    async getPaperName(paperId) {
        const query = `SELECT name FROM materials WHERE id = $1`;
        const result = await db.query(query, [paperId]);
        return result.rows[0]?.name || 'Бумага';
    }

    // Маржа по количеству листов
    async getMargin(sheets) {
        const query = `
            SELECT mr.*, mt.name as table_name
            FROM margin_rules mr
            JOIN margin_tables mt ON mt.id = mr.margin_table_id
            WHERE mt.applies_to = 'printing'
                AND mt.is_active = true
                AND mr.is_active = true
                AND mr.sheets_from <= $1
                AND (mr.sheets_to >= $1 OR mr.sheets_to IS NULL)
            ORDER BY mr.sheets_from DESC
            LIMIT 1
        `;
        const result = await db.query(query, [sheets]);
        if (result.rows.length === 0) {
            return {
                margin_type: 'percent',
                margin_value: 50,
                sheets_range: 'default',
                description: 'Стандартная наценка 50%'
            };
        }
        const rule = result.rows[0];
        return {
            margin_type: rule.margin_type,
            margin_value: parseFloat(rule.margin_value),
            sheets_range: `${rule.sheets_from}${rule.sheets_to ? '-' + rule.sheets_to : '+'}`,
            description: `${rule.margin_type === 'percent' ? rule.margin_value + '%' : rule.margin_value + ' руб'} (тираж ${rule.sheets_from}${rule.sheets_to ? '-' + rule.sheets_to : '+'} листов)`
        };
    }

    // Расчёт дополнительной услуги
    async calculateService(service, context) {
        const { sheets, quantity } = context;
        const serviceInfo = await db.query(`SELECT * FROM services WHERE id = $1 AND is_active = true`, [service.id]);
        if (serviceInfo.rows.length === 0) {
            throw new Error(`Услуга ${service.id} не найдена`);
        }
        const serviceData = serviceInfo.rows[0];

        let cost = 0;
        if (serviceData.calculation_type === 'per_sheet') {
            cost = serviceData.cost_per_unit * sheets;
        } else if (serviceData.calculation_type === 'per_item') {
            cost = serviceData.cost_per_unit * quantity;
        } else {
            cost = serviceData.cost_per_unit;
        }

        const serviceMargin = await this.getServiceMargin(service.id);
        let clientPrice;
        if (serviceMargin.margin_type === 'percent') {
            clientPrice = cost * (1 + serviceMargin.margin_value / 100);
        } else {
            clientPrice = cost + serviceMargin.margin_value;
        }

        return {
            id: service.id,
            name: serviceData.name,
            calculation_type: serviceData.calculation_type,
            cost: cost,
            margin: serviceMargin,
            clientPrice: clientPrice
        };
    }

    // Маржа для услуги (по умолчанию 50%)
    async getServiceMargin(serviceId) {
        return {
            margin_type: 'percent',
            margin_value: 50,
            description: 'Стандартная наценка 50%'
        };
    }
}
```

Примечание по бэкенду: при вызове `calculateMargin()` для цифровой печати передаётся `quantity = sheets_spent` (число листов SRA3), а для копировальных услуг — `quantity = количество копий`.

```javascript
// Пример: листовка А4, тираж готовых изделий = 200 шт
// На листе SRA3 помещается 2 макета А4
const sheets_spent = Math.ceil(тираж_изделий / сколько_макетов_на_листе);
// sheets_spent = 100
// Затем идём в таблицу маржи и ищем правило по sheets_spent, а не по тиражу.
```

## Примеры расчётов

### Пример 1. Листовки A6, 4+4, мелованная 130 (пошагово)

Исходные данные:

```
Принтер:                  Konica Minolta 6085
Формат печати:            SRA3 (320×450 мм)
Формат готовой продукции: А6 (105×148 мм)
Тип продукции:            Листовки
Бумага:                   130 г/м², мелованная
Цена бумаги:              3 руб/лист SRA3
Печать:                   Цветная двусторонняя (4+4)
Себестоимость печати:     22 руб/лист SRA3
Тираж:                    100 шт А6
Наценка:                  100%
```

Расчёт:

```
Шаг 1. Печатные листы = ОКРУГЛВВЕРХ(100 / 6) = 17 листов SRA3
Шаг 2. Себестоимость бумаги = 17 × 3 = 51 руб
Шаг 3. Себестоимость печати = 17 × 22 = 374 руб
Шаг 4. Себестоимость общая = 51 + 374 = 425 руб
Шаг 5. Цена для клиента = 425 × (1 + 100/100) = 425 × 2 = 850 руб
Шаг 6. Цена за единицу = 850 / 100 = 8.50 руб/шт
```

Детализация для клиента (на сайте):

```
ЛИСТОВКИ А6, 4+4, 130 гр/м²
Тираж: 100 шт
Цена за 1 листовку: 8.50 руб
ИТОГО: 850 руб
```

Детализация для менеджера (CRM):

```
ЗАКАЗ №123
Продукция:          Листовки А6 (105×148 мм)
Тираж:              100 шт

ПРОИЗВОДСТВЕННЫЙ РАСЧЁТ:
Печатная машина:    Konica Minolta 6085
Формат печати:      SRA3 (320×450 мм)
Раскладка:          6 шт на листе
Печатных листов:    17 листов SRA3

СЕБЕСТОИМОСТЬ (НАШИ ЗАТРАТЫ):
Бумага SRA3 130г:   17 л × 3 руб  = 51 руб
Печать 4+4:         17 л × 22 руб = 374 руб
Итого себестоимость:              425 руб

РАСЧЁТ ДЛЯ КЛИЕНТА:
Себестоимость:      425 руб
Наценка (100%):     425 руб
Цена для клиента:   850 руб
Цена за 1 листовку: 8.50 руб

ПРОВЕРКА РЕНТАБЕЛЬНОСТИ:
Прибыль:            425 руб
Маржинальность:     50%
```

Проверка граничных условий:
- **Остаток на листе.** На 17 листах помещается 17 × 6 = 102 листовки А6 — на 2 шт больше тиража. Лишние 2 листовки можно отдать клиенту (бонус) или оставить на складе (нестандартная продукция).
- **Один или несколько макетов.** Если все 100 листовок с одним дизайном — резка простая (режем стопкой). Если разные дизайны (например, 10 дизайнов по 10 шт) — применяется коэффициент сложности.
- **Цена за единицу.** 8.50 руб за А6 — проверить на соответствие рынку; при необходимости корректировать наценкой.

⚠️ ОТКРЫТЫЙ ВОПРОС: расхождение по раскладке A6 на лист SRA3. В пошаговом примере используется 6 шт/лист, при этом отмечено, что по факту получается 8 шт. Таблица `layout_rules` задаёт для A6 значение 8 шт/лист. Нужно зафиксировать корректную раскладку A6 (6 или 8) и пересчитать пример.

⚠️ ОТКРЫТЫЙ ВОПРОС: расхождение себестоимости печати 4+4. В пошаговом примере используется 22 руб/лист, а в справочнике `print_base_costs` для 4+4 указано 25.00 руб/лист. Также требуется подтвердить реальность цен бумаги (3 руб) и печати.

⚠️ ОТКРЫТЫЙ ВОПРОС: не зафиксировано, как поступать с остатком изделий на последнем листе (отдавать клиенту или списывать), и не учтена послепечатная обработка (резка, упаковка) в базовой формуле себестоимости.

### Пример 2. Листовки A4, 4+4, мелованная 130, с ламинацией (сквозной)

Входные данные:

```javascript
const params = {
    format: 'A4',
    colorType: '4+4',
    paperId: 101,          // мелованная 130 г/м²
    quantity: 100,
    services: [{ id: 301 }] // ламинация
};
```

Результат расчёта:

```javascript
{
    success: true,
    breakdown: {
        sheets: 50,                    // 100 / 2 = 50 листов SRA3
        items_per_sheet: 2,
        print_cost: 1250,              // 50 × 25
        paper_cost: 150,               // 50 × 3
        paper_name: 'Мелованная 130 г/м²',
        total_cost: 1400,
        margin: {
            sheets_range: '51+',
            margin_type: 'percent',
            margin_value: 60,
            margin_amount: 840         // 1400 × 0.6
        },
        client_print_price: 2240,      // 1400 + 840
        services: [
            {
                id: 301,
                name: 'Ламинация',
                calculation_type: 'per_sheet',
                cost: 750,             // 50 × 15
                margin: { margin_type: 'percent', margin_value: 50 },
                clientPrice: 1125      // 750 × 1.5
            }
        ],
        final_price: 3365              // 2240 + 1125
    },
    summary: {
        sheets: 50,
        price_per_sheet: 44.80,
        price_per_item: 33.65,
        total: 3365
    }
}
```

⚠️ ОТКРЫТЫЙ ВОПРОС: в сквозном примере для 50 листов указан диапазон маржи `51+` (60%), но 50 листов попадают в правило `31–50` (70%) согласно таблице `margin_rules`. Нужно уточнить корректный диапазон и пересчитать `margin_amount` и итог.

## Интерфейс админки (настройка цифровой печати)

Экран «Настройка цифровой печати (Konica 6085)» содержит четыре редактируемых блока:

1. **Раскладка на листе (SRA3)** — формат, ориентация, шт/лист, вылеты.
2. **Себестоимость печати (лист SRA3, без бумаги)** — цветность, стоимость.
3. **Себестоимость бумаги (лист SRA3)** — бумага, плотность, стоимость.
4. **Таблица маржи (по количеству листов)** — от листов, до листов, тип, значение.

Все сущности имеют свои ID и настраиваются в админке без переписывания кода при изменении цен или добавлении новой бумаги.

## Источник

Материал собран из файла `D:\roman\Desktop\PRINTOFFICE\context\raw\architecture.md`:
- строки 5170–5281 — пошаговый расчёт цифры, детализация для клиента и менеджера, проверка граничных условий, итоговая формула (пример листовок A6); строка 5191 — исходный концептуальный пример маржи (A4, тираж 100 шт → 50 листов → диапазон «50 и выше»);
- строки 5555–5627 — полная логика расчёта цифровой печати: общая схема, структура БД, класс `DigitalPrintCalculator`, сквозной пример, интерфейс админки, итоговая формула;
- строки 4051–4054 — сводная бизнес-логика расчёта себестоимости цифровой печати;
- строки 892–902 — входные параметры (формат; бумага по плотности/поверхности/цвету; цветность 1+0/1+1/4+0/4+4; тираж; макет);
- строки 7989–8052 — специфика начисления маржи на число листов SRA3, исходные (ошибочные) интервалы 1–41/41–49/50–99 со скриншота (строка 7996), переименование поля «Тираж» → «Затраты листов (SRA3)», итог исправления (200 → 100 → строка 100–199, 66 руб как для А3, строка 8005), атрибуты Margin Table / Margin Rule (строки 8021–8024) — концептуальное описание модуля маржи перенесено в `pricing-model.md`, здесь оставлена только локальная таблица маржи цифры и ссылка; алгоритм на бэкенде.
