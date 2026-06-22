# Калькулятор наклеек

Модуль расчёта наклеек трёх бизнес-типов (простые, стикерпаки, фигурные) с гибким выбором способа резки в зависимости от материала, расчётом времени операций, вылетами/зазорами и производственным ТЗ. Документ описывает бизнес-логику, структуру БД, алгоритмы расчёта, интерфейсы клиента/менеджера и итоговые формулы стоимости.

## 1. Три бизнес-типа наклеек

Наклейки разделены на три сценария, которые по-разному отображаются на сайте и по-разному рассчитываются в производстве.

| Тип | Название | Для клиента | Для производства | Особенности |
|-----|----------|-------------|------------------|-------------|
| Тип 1 | Простые наклейки | Выбирает размер, материал | Прямой рез (гильотина) | Считаются как листовки, материал — самоклейка |
| Тип 2 | Стикерпаки (готовый формат) | Выбирает А4, А5, А6 | Печать SRA3 + ручная резка под формат + плоттерная резка элементов внутри | Клиент получает готовый формат; наборы наклеек, детские стикеры |
| Тип 3 | Фигурные наклейки (лист SRA3) | Видит раскладку на SRA3 | Плоттерная резка по контуру, выдача листами | Клиент режет сам или заказывает услугу; логотипы, фигурные формы |

Сводная бизнес-логика расчёта:

| Тип | Логика |
|-----|--------|
| Простые | Как листовки, материал — самоклейка |
| Стикерпаки | Печать на SRA3, ручная резка под формат |
| Фигурные | Печать на SRA3, плоттерная резка, выдача листами |

На фронтенде типы переключаются иконками (Простые / Стикерпаки / Фигурные / Круглые и другие виды наклеек с разным расчётом и видом калькулятора). Каждый тип имеет собственную форму ввода. Для типа 3 при переключении показывается визуализация раскладки на листе SRA3 (320×450 мм).

Лист SRA3 во всех расчётах: **320 × 450 мм**.

### Пример макета формы (тип «Простые»)

```
КАЛЬКУЛЯТОР НАКЛЕЕК
[Простые] [Стикерпаки] [Фигурные] [Круглые]
   ✓          ○            ○          ○

Тип: Простые наклейки (прямой рез)
Формат:    [ Свой размер ▼ ]  [ 50 ] × [ 30 ] мм
Материал:  [ Самоклейка матовая 80 г/м² ▼ ]
Тираж:     [ 1000 ] шт
Дополнительно: [✓] Защитная ламинация

[ РАССЧИТАТЬ ]
```

## 2. Типы резки

Помимо бизнес-типа наклейки, клиент выбирает способ резки. Доступность типов резки зависит от материала (наличие насечек на подложке), но клиенту не запрещается выбрать более дешёвый вариант — выдаётся предупреждение.

### 2.1. Упрощённая классификация (A / B / C)

| Тип | Название | Вылеты | Зазоры | Процесс | Для производства |
|-----|----------|--------|--------|---------|------------------|
| A | Прямой рез (как листовки) | 2–3 мм | 0 | Гильотина / ручной рез | Режем стопу листов |
| B | Контурная резка (плоттер) | 2–3 мм | 0 | Только плоттер | Плоттер режет каждый лист |
| C | Контурная + ручная дорезка | 3 мм | 3 мм (из вылетов) | Плоттер + ручная | Плоттер режет контур, ручная дорезка по формату |

Ключевая идея типа C: вылеты 3 мм одновременно служат зазорами для ручной дорезки, поэтому дополнительные зазоры не нужны.

> Примечание о нотации. В документе соседствуют два обозначения типов резки из разных ревизий источника: латинские **A / B / C** (упрощённая классификация, этот раздел) и кириллические **А / Б / В / Г / Д** (алгоритмы расчёта времени и производственное ТЗ, разделы 4.4–4.6 и 7). Соответствие ключевых обозначений: латинская **A** = кириллическая **А** (прямой/гильотина, `straight`); латинская **B** = кириллическая **Б** (контурная на плоттере, `contour`); латинская **C** = кириллическая **Д** (комбинированная: плоттер + ручная дорезка, `plotter_with_gap`). Кириллические **В** и **Г** в источнике отведены под ручную резку (с насечками / без насечек). Нотация в документе не приведена к единому виду намеренно — это отражает исходные материалы.

### 2.2. Детальная классификация (5 типов)

Финальная спецификация разворачивает классификацию до пяти типов резки.

| Код | Название | Метод | Вылеты | Зазоры | Насечки | Коэф. цены | Применение |
|-----|----------|-------|--------|--------|---------|-----------|-----------|
| `straight` | Прямой рез (гильотина) | guillotine | 2–3 мм | 0 мм | нет | 1.0 | Прямоугольные наклейки, этикетки. Режется стопа листов |
| `contour` | Контурная на подложке (плоттер) | plotter | 2–3 мм | 0 мм | не требуются | 1.3 | Наклейки остаются на общем листе, фигурные формы |
| `manual_notches` | Ручная резка с насечками | manual | 2–3 мм | 2 мм | есть | 1.2 | Каждая наклейка отдельно; для материалов с насечками на подложке |
| `manual_no_notches` | Ручная резка без насечек | manual | 2–3 мм | 2 мм | нет | 1.1 | Каждая отдельно, сложнее отделять; только по запросу, с предупреждением |
| `plotter_with_gap` | Плоттерная с полем | plotter+manual | 3 мм (работают как зазоры) | 6 мм (для ручной резки) | нет | 1.5 | Плоттер режет контур, затем ручная дорезка по формату; рекомендуется для материалов без насечек |

Особенности типа `plotter_with_gap` (он же тип C):
- Ручных резов на лист: `cols + rows` (режем по рядам, а не по каждой наклейке).
- Минимальный зазор для ручной резки — 4 мм, рекомендуемый — 6 мм.

### 2.3. Логика выбора резки от материала

- Пленка от производителя идёт **без насечек** на подложке. Для неё нужна плоттерная резка под готовый формат + ручная дорезка с зазором 6 мм (минимум 4 мм) между изображениями. Печатается на SRA3 с вылетами 2 мм (или без вылетов, если контурный рез = 0 и макет позволяет). Такая нарезка называется «плоттерная с полем» и предлагается по умолчанию для материалов без насечек, но не запрещает выбрать более дешёвую (плоттерная на общей подложке или ручная по форме без поля).
- Если материал имеет насечки на подложке — рекомендуется ручная резка с насечками (легко отклеивать).
- Если материал без насечек, а выбрана ручная резка — выводится настраиваемое текстовое предупреждение, что насечек нет. Текст и условие появления предупреждения настраиваются в базе материалов / в едином месте администрирования (с группировкой условий по видам).

## 3. Структура базы данных

### 3.1. Типы наклеек (переключение)

```sql
CREATE TABLE sticker_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,                     -- "Простые наклейки"
    code VARCHAR(50) UNIQUE,                         -- "simple", "stickerpack", "shaped", "round"
    icon VARCHAR(255),                               -- путь к иконке
    calculation_type ENUM('sheet', 'sra3_with_cut', 'sra3_as_is') NOT NULL,
    available_formats JSON,                          -- ["custom", "A4", "A5", "A6", "SRA3"]
    default_format VARCHAR(20),
    is_visible BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2. Предустановленные стикерпаки

```sql
CREATE TABLE stickerpack_presets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255),                               -- "Стикерпак А5"
    format VARCHAR(10) NOT NULL,                     -- "A4", "A5", "A6"
    width INT NOT NULL,                               -- размер в мм
    height INT NOT NULL,
    preview_image VARCHAR(255),
    description TEXT,
    base_price DECIMAL(10,2),                         -- примерная цена для витрины
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 100
);
```

### 3.3. Визуализации для SRA3

```sql
CREATE TABLE sra3_visualizations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sticker_type_id INT NOT NULL,
    item_width INT,
    item_height INT,
    item_shape VARCHAR(50),                          -- "rectangle", "circle", "custom"
    cols INT,
    rows INT,
    total_per_sheet INT,
    layout_svg TEXT,                                  -- SVG разметка
    preview_image VARCHAR(255),
    FOREIGN KEY (sticker_type_id) REFERENCES sticker_types(id)
);
```

### 3.4. Справочник типов резки

```sql
CREATE TABLE cutting_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    default_bleed INT DEFAULT 2,
    default_gap INT DEFAULT 0,
    has_notches BOOLEAN DEFAULT false,
    cutting_method ENUM('guillotine', 'plotter', 'manual', 'plotter+manual') NOT NULL,
    price_multiplier DECIMAL(3,2) DEFAULT 1.0,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Предустановленные типы
INSERT INTO cutting_types (name, code, description, default_bleed, default_gap, has_notches, cutting_method, price_multiplier, sort_order) VALUES
('Прямой рез (гильотина)', 'straight',          'Как обычные листовки',        2, 0, false, 'guillotine',     1.0, 10),
('Контурная на подложке',  'contour',           'Плоттер, наклейки на листе',  2, 0, false, 'plotter',        1.3, 20),
('Ручная с насечками',     'manual_notches',    'Каждая отдельно, есть насечки',2, 2, true,  'manual',         1.2, 30),
('Ручная без насечек',     'manual_no_notches', 'Каждая отдельно, насечек нет',2, 2, false, 'manual',         1.1, 40),
('Плоттерная с полем',     'plotter_with_gap',  'Плоттер + ручная дорезка',    3, 6, false, 'plotter+manual', 1.5, 50);
```

### 3.5. Привязка типов резки к материалам

```sql
CREATE TABLE material_cutting_options (
    id INT PRIMARY KEY AUTO_INCREMENT,
    material_id INT NOT NULL,
    cutting_type_id INT NOT NULL,
    is_available BOOLEAN DEFAULT true,
    is_recommended BOOLEAN DEFAULT false,
    custom_bleed INT,
    custom_gap INT,
    custom_warning TEXT,
    price_multiplier DECIMAL(3,2),
    FOREIGN KEY (material_id) REFERENCES materials(id),
    FOREIGN KEY (cutting_type_id) REFERENCES cutting_types(id),
    UNIQUE KEY unique_material_cutting (material_id, cutting_type_id)
);

-- Пример: пленка без насечек → плоттерная с полем (рекомендуемая)
INSERT INTO material_cutting_options (material_id, cutting_type_id, is_available, is_recommended, custom_bleed, custom_gap) VALUES
(802, 5, true, true, 3, 6);

-- Пример: бумага с насечками → ручная с насечками (рекомендуемая)
INSERT INTO material_cutting_options (material_id, cutting_type_id, is_available, is_recommended) VALUES
(801, 3, true, true);
```

Расширение таблицы материалов:

```sql
ALTER TABLE materials ADD COLUMN
    backing_type ENUM('with_notches', 'without_notches', 'perforated') DEFAULT 'without_notches';
ALTER TABLE materials ADD COLUMN
    recommended_cutting VARCHAR(50);     -- рекомендуемый тип резки
ALTER TABLE materials ADD COLUMN
    min_gap_for_manual INT DEFAULT 2;    -- минимальный зазор для ручной резки
```

### 3.6. Настраиваемые предупреждения

```sql
CREATE TABLE cutting_warnings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    warning_code VARCHAR(50) UNIQUE NOT NULL,        -- 'no_notches', 'thick_material', 'complex_shape'
    warning_text TEXT NOT NULL,
    warning_level ENUM('info', 'warning', 'critical') DEFAULT 'warning',
    conditions JSON,                                  -- условия появления
    is_active BOOLEAN DEFAULT true
);

INSERT INTO cutting_warnings (warning_code, warning_text, warning_level, conditions) VALUES
('no_notches_manual',
 'Выбранный материал не имеет насечек на подложке. Ручное отделение наклеек может быть затруднено. Рекомендуем выбрать плоттерную резку с полем.',
 'warning',
 '{"material_backing": "without_notches", "cutting_type": "manual_no_notches"}'),
('recommend_plotter_gap',
 'Для материала без насечек рекомендуется плоттерная резка с полем (зазор 6 мм).',
 'info',
 '{"material_backing": "without_notches", "cutting_type": "contour"}'),
('thick_material_manual',
 'Плотный материал может сложнее резаться вручную.',
 'warning',
 '{"material_density": ">200", "cutting_method": "manual"}');
```

Условия в `conditions` (JSON) проверяются по полям материала и выбранному типу резки: `backing_type` / `material_backing`, `cutting_type`, `material_density` (поддерживаются операторы `>`, `<`, `>=`, `<=`).

Унификация по финальной спецификации (расхождения в исходниках):
- Текст и код предупреждения о выборе ручной резки на материале без насечек взяты из финальной спецификации: код `no_notches_manual`, текст оканчивается на «… Рекомендуем выбрать плоттерную резку **с полем**.», условие `cutting_type = manual_no_notches`. В более ранней расширенной системе тот же текст шёл без слов «с полем» («… Рекомендуем выбрать плоттерную резку.»), а ключ типа резки в условии назывался `manual_without_notches`.
- Предупреждение-рекомендация поля взято из финальной версии: код `recommend_plotter_gap`, условие `cutting_type = contour`. В расширенной системе аналогичное предупреждение имело код `no_notches_plotter_gap` и условие `cutting_type = plotter_continuous` (старое имя контурной на общей подложке). Текст в обеих версиях совпадает: «Для материала без насечек рекомендуется плоттерная резка с полем (зазор 6 мм).»
- Ключ поля условия в расширенной системе — `backing_type`, в финальной — `material_backing`; оба варианта поддерживаются проверкой условий.

### 3.7. Медиа-контент материалов и типов резки

```sql
CREATE TABLE media_files (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entity_type VARCHAR(50) NOT NULL,           -- 'material', 'cutting_type', 'product_example'
    entity_id INT NOT NULL,
    file_type ENUM('image', 'video', 'document') NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    title VARCHAR(255),
    description TEXT,
    sort_order INT DEFAULT 0,
    video_duration INT,                           -- длительность в секундах
    video_platform ENUM('youtube', 'vimeo', 'local') DEFAULT 'local',
    uploaded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    INDEX idx_entity (entity_type, entity_id, sort_order)
);

CREATE TABLE media_galleries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gallery_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    layout_type ENUM('grid', 'carousel', 'list') DEFAULT 'grid',
    max_files INT DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_gallery (entity_type, entity_id)
);
```

Лимиты галереи материала: 1 основное фото, до 5 изображений в сетке, до 3 видео (применение материала). Просмотр — лайтбокс с навигацией, миниатюрами и поддержкой видео.

### 3.8. Производственные комментарии и переопределение параметров

```sql
CREATE TABLE production_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    task_id INT,
    target_role ENUM('printer', 'cutter', 'plotter_operator', 'assembler', 'all') NOT NULL,
    comment TEXT NOT NULL,
    priority ENUM('info', 'warning', 'critical') DEFAULT 'info',
    override_params JSON,
    attachments JSON,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT false,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (task_id) REFERENCES production_schedule(id),
    INDEX idx_target (order_id, target_role, is_read)
);

CREATE TABLE production_parameter_overrides (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    task_id INT,
    parameter_name VARCHAR(100) NOT NULL,              -- 'bleed', 'gap', 'cutting_speed'
    old_value JSON,
    new_value JSON,
    reason TEXT,
    changed_by INT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INT,
    approved_at TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (task_id) REFERENCES production_schedule(id)
);
```

## 4. Алгоритмы расчёта

### 4.1. Класс StickerCalculator (диспетчеризация по типу)

Расчёт делегируется в зависимости от бизнес-типа наклейки или от типа резки.

```javascript
class StickerCalculator {
    async calculate(params) {
        const { stickerType, ...rest } = params;
        switch (stickerType) {
            case 'simple':      return this.calculateSimpleStickers(rest);
            case 'stickerpack': return this.calculateStickerpack(rest);
            case 'shaped':      return this.calculateShapedStickers(rest);
            default: throw new Error('Неизвестный тип наклеек');
        }
    }
}
```

#### Тип 1: Простые наклейки

Используется стандартный расчёт листовок (`SheetCalculator`) с материалом-самоклейкой и вылетами 2 мм. Добавляется опциональная защитная ламинация. Производство: гильотинный (прямой) рез.

```javascript
const baseCalculation = await sheetCalculator.calculate({
    format: { width, height },
    material: material,   // самоклейка
    quantity,
    bleed: 2              // для наклеек часто 2 мм
});
// totalCost = baseCalculation.totalCost + laminationCost
```

#### Тип 2: Стикерпаки

```
cols        = floor(sra3.width  / targetFormat.width)     // sra3 = 320×450
rows        = floor(sra3.height / targetFormat.height)
packsPerSheet = cols × rows
sra3Sheets  = ceil(quantity / packsPerSheet)
printingCost = sra3Sheets × material.printPrice
materialCost = sra3Sheets × material.costPerSheet
totalCost   = printingCost + materialCost + cuttingCost + contourCost
```

Стадии производства: печать на SRA3 → ручная резка под формат (`packFormat`) → опциональная контурная (плоттерная) резка элементов внутри пака. Клиент видит формат, размер, число элементов в паке и итоговое количество элементов (`elementsPerPack × quantity`).

#### Тип 3: Фигурные наклейки

Оптимальная раскладка считается отдельным `LayoutCalculator` с параметрами: лист 320×450, вылеты 2 мм, контурная резка, отступ меток `markerOffset = 8` мм, безопасный зазор `safetyGap = 10`. Площадь раскладки с метками плоттера (для SRA3 область макетов 284 × 414 мм, начало координат `(18, 18)`), формула и функция `calculateLayoutArea` описаны в файле-владельце расчёта раскладки/меток/вылетов — см. [Раскладка на листе и вылеты, раздел «Метки плоттера для контурной резки»](imposition-bleeds.md#метки-плоттера-для-контурной-резки).

```
sheetsNeeded = ceil(quantity / optimalLayout.totalPerSheet)
printingCost = sheetsNeeded × material.printPrice
materialCost = sheetsNeeded × material.costPerSheet
totalCost    = printingCost + materialCost + plotterCost
```

Производство: печать на SRA3 → плоттерная резка (Mimaki CG-130). Выдача листами SRA3. На сайте показывается визуализация раскладки (SVG).

### 4.2. Расчёт типа C (контурная + ручная дорезка)

Вылеты 3 мм работают как зазоры, поэтому размер с вылетами = шаг раскладки. Ручная дорезка считается по рядам/колонкам, а не по каждой наклейке.

```javascript
// Пример: наклейка 50×50, вылет 3 мм
sizeWithBleed = { width: 56, height: 56 };   // 50 + 3 + 3
cols = floor(320 / 56) = 5;
rows = floor(450 / 56) = 8;
perSheet = 40;
ручныеРезы = cols + rows = 5 + 8 = 13 резов на лист   // не 40!
```

### 4.3. Расчёт раскладки с учётом зазоров

Зазор зависит от типа резки. Для `plotter_with_gap` — 6 мм. Для ручной резки на материале без насечек — минимум 4 мм.

```javascript
calculateGaps(cuttingType, elementSize, material) {
    // requiresGap = false → gap = 0
    let gap = type.features.gapSize;
    if (cuttingType === 'plotter_with_gap') gap = 6;
    if (material.backing_type === 'without_notches' && cuttingType.includes('manual')) {
        gap = Math.max(gap, 4);
    }
    return {
        gap,
        effectiveSize: { width: elementSize.width + gap, height: elementSize.height + gap },
        note: gap > 2 ? 'Увеличенный зазор для удобства резки' : null
    };
}
```

Поле `note` непустое (`'Увеличенный зазор для удобства резки'`) при `gap > 2` — оно подсвечивается клиенту в карточке выбранного типа резки рядом с величиной зазора.

### 4.4. Время гильотинной резки (тип A)

Тип A (`straight`) — прямой рез на гильотине Boway BW-4908 V9, стопу листов. Каноническое описание гильотины, таблица толщины по плотности (80=0.10 … 400=0.48), коэффициент уплотнения 0.85, число резов `cutsForGrid(cols, rows)`, коэффициент высоты стопы и вывод итоговой формулы времени — см. [Резка, ламинация и доп. услуги, раздел 2 «Гильотинная резка»](cutting-lamination-services.md#2-гильотинная-резка-boway-bw-4908-v9).

Кратко: `time = stacks × cuts × cut_speed × (1 + stack_height/80 × 0.5) + setup_time` (по умолчанию `cut_speed = 0.5` мин/рез, `setup_time = 3` мин; высота стопы и число стоп считаются от толщины листа и коэффициента уплотнения 0.85, макс. высота стопы 80 мм).

### 4.5. Время плоттерной резки (типы Б и Д)

Настройки плоттера: `maxSpeed = 800 мм/сек`, `cornerPenalty = 0.3 сек/угол`, `movePenalty = 1.0 сек/переход`, `startPenalty = 2.0 сек/старт`.

Скорость по сложности контура:

| Сложность | Скорость, мм/сек | Что режется |
|-----------|------------------|-------------|
| simple | 500 | прямоугольники |
| medium | 350 | овалы, круги |
| complex | 250 | фигурные |
| veryComplex | 150 | стикерпаки |

```
totalPath       = elementsPerSheet × perimeterPerElement   // мм
cuttingTime     = totalPath / speed                         // сек
cornerTime      = (elementsPerSheet × 4) × 0.3              // сек
moveTime        = (elementsPerSheet - 1) × 1.0             // сек
startTime       = 2.0                                       // сек
timePerSheetSec = cuttingTime + cornerTime + moveTime + startTime
totalTimeMin    = (timePerSheetSec × sheets) / 60
```

Сводная формула: `time = (perimeter / speed) + corners×0.3 + (items-1)×1.0 + 2.0`, далее `total_time = time_per_sheet × sheets`.

### 4.6. Время комбинированной резки (тип Д = плоттер + ручная)

```
plotterTime        = PlotterCuttingCalculator(complexity = 'complex')
manualCutsPerSheet = cols + rows                  // напр. 5 + 8 = 13
timePerManualCut   = 0.3 мин/рез
manualTime         = sheets × manualCutsPerSheet × 0.3
totalTime          = plotterTime + manualTime
```

⚠️ ОТКРЫТЫЙ ВОПРОС: время одного ручного реза указано неоднозначно. В упрощённом классе (тип C) — `timePerCut = 0.05` мин/рез, в финальной спецификации (тип Д) — `0.3` мин/рез. Нужно зафиксировать единое значение.

### 4.7. Ламинация

`time = sheets × time_per_sheet + cutting_time`

## 5. Стоимость

### 5.1. Коэффициенты резки

```javascript
const multipliers = {
    'straight':          1.0,
    'contour':           1.3,
    'manual_notches':    1.2,
    'manual_no_notches': 1.1,
    'plotter_with_gap':  1.5
};
let multiplier = multipliers[cuttingType] || 1.0;

// Доп. коэффициент для плоттерной с полем (плоттер + ручная работа):
if (cuttingType === 'plotter_with_gap') {
    multiplier *= 1.3;
}
// Доп. коэффициент для материала без насечек при ручной резке:
if (material.backing_type === 'without_notches' && cuttingType.includes('manual')) {
    multiplier *= 1.2;
}
```

Таким образом для `plotter_with_gap` итоговый множитель — это базовый `1.5`, домноженный на `1.3` (отдельный коэффициент за совмещение плоттера и ручной работы). Эти два коэффициента применяются **независимо**: базовый 1.5 — за тип резки, ×1.3 — за комбинированную операцию.

Метод `CuttingTypeManager.calculateCuttingCost(calculation, cuttingType, material)` возвращает развёрнутую структуру стоимости резки:

```javascript
return {
    baseCost,                                // calculation.baseCuttingCost
    multiplier,                              // итоговый множитель (с учётом ×1.3 и/или ×1.2)
    totalCost: baseCost * multiplier,
    breakdown: {
        cuttingType: type.name,
        materialFactor: material.backing_type === 'without_notches' ? 1.2 : 1.0,
        complexity: type.priceMultiplier      // базовый множитель типа резки
    }
};
```

Поля разбивки: `materialFactor` — вклад материала (1.2 для без насечек, иначе 1.0), `complexity` — базовый коэффициент типа резки (`type.priceMultiplier`).

### 5.2. Итоговая формула стоимости

```
Цена = (печать + материалы) × коэффициент_резки + стоимость_резки + ламинация
```

где:
- `коэффициент_резки` зависит от типа (1.0–1.5);
- `стоимость_резки` зависит от времени и сложности резки.

Структура расчёта:

```javascript
totalCost = baseCost + cuttingCost + laminationCost;   // baseCost = печать + материалы
pricePerUnit = totalCost / quantity;
```

Стоимость резки выбирается по типу: `straight` → гильотина, `contour` → плоттер, `plotter_with_gap` → комбинированная, остальные → ручная.

⚠️ ОТКРЫТЫЙ ВОПРОС: в итоговой формуле коэффициент резки применяется к базовой стоимости И дополнительно добавляется отдельная «стоимость резки». При этом в реализации `calculate()` базовая стоимость и стоимость резки просто складываются без применения множителя к базе. Нужно уточнить, где именно применяется `cuttingMultiplier`.

⚠️ ОТКРЫТЫЙ ВОПРОС: в раннем варианте стоимость плоттерной резки считалась как `plotterTime × 30` (30 руб/мин). Тариф руб/мин для плоттера и ручной резки в финальной спецификации явно не зафиксирован.

## 6. Интерфейсы

### 6.1. Клиент — выбор типа резки

Карточки типов резки с иконкой, описанием, примером, ценовым коэффициентом и предупреждениями. Рекомендуемый тип помечается бейджем «Рекомендуем» и выбирается по умолчанию; типы с критическим предупреждением — disabled.

| Тип резки | Подпись цены |
|-----------|--------------|
| Прямой рез (гильотина) | базовый тариф |
| Контурная резка (плоттер) | +30% к базовому тарифу |
| Ручная резка (с насечками) | +20% |
| Ручная резка (без насечек) | +10%, с предупреждением «отделение будет сложнее» |
| Плоттерная с полем (рекомендуется) | +50% |

### 6.2. Клиент — выбор стикерпака

Сетка карточек предустановленных паков (превью, бейдж формата, размер в мм, число наклеек, цена «от»), поле количества стикерпаков и чекбокс «Добавить контурную резку».

### 6.3. Клиент — визуализация раскладки SRA3 (тип 3)

```
РАСПОЛОЖЕНИЕ НА ЛИСТЕ SRA3
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  1   │ │  2   │ │  3   │ │  4   │
└──────┘ └──────┘ └──────┘ └──────┘
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  5   │ │  6   │ │  7   │ │  8   │
└──────┘ └──────┘ └──────┘ └──────┘

Лист SRA3 (320×450 мм)
На листе: 8 наклеек
Размер наклейки: 50×50 мм
Вылеты: 3 мм
Метки плоттера: 8 мм от края
```

Реализуется через динамический SVG: контур листа, технологические поля (метки, штрих 5,5), область макетов с отступом, элементы по координатам раскладки, подписи. Из визуализации типа 3 предлагается переход на стикерпак («Хотите готовые наклейки?»).

### 6.4. Клиент — медиа-галерея материала

Основное фото + сетка миниатюр (фото/видео с иконкой ▶) + лайтбокс с навигацией стрелками, счётчиком и нижними миниатюрами. Видео воспроизводится прямо в лайтбоксе.

### 6.5. Менеджер — комментарии и параметры производства

Вкладки по ролям: Всем / Печатнику / Резчику / Оператору плоттера (и сборщику). Менеджер:
- пишет адресные комментарии каждому участку с приоритетом (info / warning / critical) и вложениями;
- переопределяет параметры текущей задачи с обязательным указанием причины: вылеты (bleed), зазоры (gap), скорость резки (по умолчанию 350 мм/сек), тип резки;
- видит историю изменений (старое → новое значение, причина, кто и когда).

Пример производственного задания:

```
ПРОИЗВОДСТВЕННОЕ ЗАДАНИЕ №123
ЗАКАЗ: Наклейки 50×50 мм, 1000 шт
МАТЕРИАЛ: Пленка самоклейка матовая
ТИП РЕЗКИ: Контурная + ручная

КОММЕНТАРИИ МЕНЕДЖЕРА:
[Печатнику] 12:30 - Проверь первый лист, важна цветопередача
[Резчику]   12:35 - Вылеты 3 мм используй как зазоры
[Оператору] 12:40 - Скорость плоттера снизить до 300

ПЕРЕОПРЕДЕЛЕННЫЕ ПАРАМЕТРЫ:
• Вылеты: 3 мм → 4 мм   Причина: "Материал скользкий, нужен запас"
• Скорость резки: 350 → 300 мм/сек   Причина: "Сложные углы, медленнее для качества"
```

### 6.6. Админка — настройка типов резки

Для каждого типа резки настраиваются: вылеты по умолчанию, оборудование (гильотина / плоттер Mimaki CG-130), скорость резки (для плоттера, напр. 350 мм/сек), время ручной резки (мин/рез), пример изображения. Для материала: тип подложки (с насечками / без / перфорированная), минимальный зазор для ручной резки, перечень доступных типов резки (с флагами «доступен» и «рекомендуемый», особыми зазорами), настраиваемые тексты предупреждений и условия их появления.

## 7. Производственное ТЗ по типам

| Тип | Операция | Инструкции |
|-----|----------|-----------|
| simple | `simple_stickers` | Прямой рез на гильотине, как обычные листовки |
| stickerpack | `stickerpack_production` | Печать на SRA3 → ручная резка под формат → (опц.) контурная резка элементов (плоттер) |
| shaped | `shaped_stickers` | Печать на SRA3 → плоттерная резка (Mimaki CG-130). Выдача листами |
| тип C / Д (`plotter_with_gap`) | `complex_cutting` | Стадия 1: плоттер режет контур (вылеты 3 мм = зазоры). Стадия 2: ручная дорезка — `cols-1` вертикальных + `rows-1` горизонтальных резов на лист |

Контроль качества для типа C: проверить совпадение контура после плоттера, ровность ручных резов, целостность вылетов.

⚠️ ОТКРЫТЫЙ ВОПРОС: количество ручных резов на лист в типе C указано двумя способами — `cols + rows` (раздел расчёта времени/класс) и `(cols-1) + (rows-1)` (производственное ТЗ). Нужно унифицировать.

## 8. Чек-лист готовности модуля

| Компонент | Описание | Статус |
|-----------|----------|--------|
| Тип 1: Простые наклейки | Как листовки, прямой рез | Готово |
| Тип 2: Стикерпаки | Печать на SRA3, ручная резка под формат | Готово |
| Тип 3: Фигурные наклейки | Печать на SRA3, плоттерная резка, выдача листами | Готово |
| Типы резки | Прямой, контурный, ручной с насечками, ручной без насечек, плоттерный с полем | Готово |
| Зависимость от материала | Если подложка без насечек — рекомендация и предупреждение | Готово |
| Расчёт времени резки | Скорость плоттера, углы, переходы, стартовый прокол | Готово |

### Ключевые параметры системы

| Параметр | Значение |
|----------|----------|
| Типы резки | 5: прямой, контурный, ручной с насечками, ручной без насечек, плоттерный с полем |
| Оборудование | Гильотина, плоттер Mimaki CG-130 |
| Лист | SRA3 320×450 мм |
| Вылеты | 2–3 мм (зависит от типа) |
| Зазоры | 0–6 мм (зависит от типа) |
| Насечки | Есть / нет (зависит от материала) |
| Расчёт времени | Учитывает скорость резки, углы, переходы, стартовый прокол |
| Визуализация | Динамическая SVG-схема для листа SRA3 |
| Материалы | Самоклейка с насечками и без |

⚠️ ОТКРЫТЫЙ ВОПРОС: значение вылетов противоречиво — задача калькулятора оперирует «вылетами 2 мм», простые наклейки и тип 3 используют 2 мм, тип C — 3 мм, классификация резки — «2–3 мм». Базовое значение по умолчанию для вылетов нужно зафиксировать.

⚠️ ОТКРЫТЫЙ ВОПРОС: скорость плоттера указана как 350 мм/сек (настройки админки и пример ТЗ) и одновременно через таблицу скоростей по сложности (150–800 мм/сек) в классе расчёта. Нужно согласовать, является ли 350 значением по умолчанию или применяется таблица сложности.

## Источник

Материал собран из файла `D:\roman\Desktop\PRINTOFFICE\context\raw\architecture.md`:
- строки 6565–6708 — «Система для наклеек с разными типами резки»: три бизнес-типа, архитектура переключения, БД (sticker_types, stickerpack_presets, sra3_visualizations), класс StickerCalculator, фронтенд, расширенная система выбора типа резки с учётом материала (насечки/без), предупреждения, админка;
- строки 6714–6838 — «Оптимизированная система»: упрощённая классификация A/B/C, тип C (контурная + ручная, вылеты 3 мм как зазоры), интерфейс с галереей материалов и примерами, медиа-галерея (фото/видео, лайтбокс), производственные комментарии и переопределение параметров;
- строки 6840–6921 — «Финальная спецификация модуля резки»: классификация 5 типов резки, БД (cutting_types, material_cutting_options, cutting_warnings), алгоритмы расчёта времени (гильотина, плоттер, комбинированная), интерфейс выбора, визуализация SRA3, формулы итоговой стоимости, ключевые параметры;
- строки 4061–4087 — сводные таблицы бизнес-логики наклеек и расчёта времени операций;
- строки 2331–2364 — раздел «Калькулятор наклеек»: чек-лист готовности и формула времени плоттерной резки.
