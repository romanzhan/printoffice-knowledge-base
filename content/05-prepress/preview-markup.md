# Препресс: интерактивное превью с метками

Интерактивное превью макета с типографскими метками (рез, сгиб, безопасная зона, вылеты, фольга, лак, биговка, контур): структура данных, генерация SVG/Canvas с легендой и зумом, настройка меток по продукту/формату, пользовательские метки заказа и интеграция с калькулятором. Дополнительно описана динамическая программная отрисовка иконок формата/крепления.

## Назначение и сценарий работы

Клиент видит, как будет выглядеть его макет после печати: где пройдут резы, сгибы, где расположены безопасная зона, вылеты, области фольгирования и лакировки. Превью интерактивное (зум, легенда, скачивание PDF/PNG) и интегрировано с калькулятором — при выборе продукта и формата, а также при добавлении услуг (фольгирование, лак), превью перегенерируется.

### Пайплайн обработки

```
Загружен макет (PDF)
        ↓
Автоматическая разметка:
  • определение формата
  • расчёт вылетов
  • определение сгибов
  • добавление меток
        ↓
Генерация превью (HTML Canvas / SVG)
        ↓
Отображение клиенту:
  • миниатюра макета
  • метки реза (красные линии)
  • метки сгиба (оранжевые линии)
  • безопасная зона (зелёный контур)
  • зона вылетов (синий контур)
  • фольгирование (золотые области)
  • лак (голубые области)
```

## Типы меток

Метки описываются цветом, стилем и толщиной линии. Параметры по умолчанию:

| Название | Код (`code`) | Цвет | Стиль линии | Толщина | Порядок (`sort_order`) |
|---|---|---|---|---|---|
| Линия реза | `cut` | `#FF0000` | solid | 2 | 10 |
| Линия сгиба | `fold` | `#FF6600` | dashed | 2 | 20 |
| Безопасная зона | `safe` | `#00CC00` | dotted | 1 | 30 |
| Зона вылетов | `bleed` | `#0066CC` | solid | 1 | 40 |
| Фольгирование | `foil` | `#FFD700` | solid | 3 | 50 |
| Выборочный лак | `varnish` | `#00CCFF` | dashed | 2 | 60 |
| Биговка | `scoring` | `#9933CC` | dotted | 2 | 70 |
| Контурная резка | `contour` | `#FF00FF` | solid | 2 | 80 |

> Примечание: в таблице `markup_types` для `bleed` (зоны вылетов) толщина линии задана `1`, тогда как в коде генерации SVG прямоугольник вылетов рисуется с `stroke-width="2"`. См. открытый вопрос ниже.

### Легенда (для клиента)

- 🟥 Красная линия — линия реза (по ней будет обрезано).
- 🟧 Оранжевая пунктирная — линия сгиба.
- 🟩 Зелёный пунктир — безопасная зона (важный текст не должен выходить за неё).
- 🔵 Синяя линия — зона вылетов (фон должен доходить до этой линии).
- 🟡 Золотая область — фольгирование.
- 🔷 Голубая область — выборочный лак.
- 🟣 Фиолетовая линия — контурная резка.

## Параметры по умолчанию

- Вылеты (bleed): **3 мм**.
- Безопасная зона (safe margin): **5 мм**.
- Показывать линии реза: да.
- Показывать метки реза по углам: да.

## Структура данных (SQL)

### Таблица типов меток

```sql
CREATE TABLE markup_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(20) DEFAULT '#000000',
    line_style ENUM('solid', 'dashed', 'dotted') DEFAULT 'solid',
    line_width INT DEFAULT 2,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO markup_types (name, code, color, line_style, line_width, sort_order) VALUES
('Линия реза',       'cut',     '#FF0000', 'solid',  2, 10),
('Линия сгиба',      'fold',    '#FF6600', 'dashed', 2, 20),
('Безопасная зона',  'safe',    '#00CC00', 'dotted', 1, 30),
('Зона вылетов',     'bleed',   '#0066CC', 'solid',  1, 40),
('Фольгирование',    'foil',    '#FFD700', 'solid',  3, 50),
('Выборочный лак',   'varnish', '#00CCFF', 'dashed', 2, 60),
('Биговка',          'scoring', '#9933CC', 'dotted', 2, 70),
('Контурная резка',  'contour', '#FF00FF', 'solid',  2, 80);
```

### Таблица настроек меток по типам продукции

```sql
CREATE TABLE product_markup_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_type VARCHAR(50) NOT NULL,      -- 'flyer', 'brochure', 'business_card', 'sticker'
    format_id INT,
    bleed_mm INT DEFAULT 3,
    safe_margin_mm INT DEFAULT 5,
    default_markups JSON,                    -- какие метки показывать по умолчанию
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (format_id) REFERENCES formats(id)
);
```

### Таблица пользовательских меток заказа

Позиции и размеры задаются в миллиметрах от левого верхнего угла.

```sql
CREATE TABLE order_markups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    markup_type_id INT NOT NULL,

    -- Позиция метки (в мм от левого верхнего угла)
    position_x DECIMAL(10,2),
    position_y DECIMAL(10,2),
    width DECIMAL(10,2),
    height DECIMAL(10,2),

    -- Дополнительные параметры
    params JSON,                             -- {"angle": 45, "radius": 10}

    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (markup_type_id) REFERENCES markup_types(id)
);
```

## Класс генерации превью `MarkupPreviewGenerator`

Класс загружает типы меток из БД, генерирует SVG с метками и оборачивает его в HTML с легендой и элементами управления зумом.

### Масштаб отображения

Максимальный размер превью ограничен 600 px по большей стороне:

```
scale = min(maxSize / width, maxSize / height)   // maxSize = 600
displayWidth  = width  * scale
displayHeight = height * scale
```

### Порядок отрисовки слоёв SVG

1. Фоновое изображение макета (`<image>` с URL `/api/preview/{fileId}?scale={scale}`).
2. Зона вылетов (bleed) — прямоугольник по краю, синий пунктир, подпись «Зона вылетов (N мм)».
3. Безопасная зона (safe margin) — отступ `safeMargin` со всех сторон, зелёный пунктир, подпись «Безопасная зона (N мм)».
4. Линии реза — прямоугольник с отступом `bleed`, красная сплошная линия.
5. Метки реза по углам — крестики размером `cutMarkSize = 10` в четырёх углах прямоугольника реза.
6. Линии сгибов — для каждого сгиба (вертикальный/горизонтальный) оранжевая пунктирная линия.
7. Фольгирование — полупрозрачные золотые прямоугольники `rgba(255, 215, 0, 0.3)` с обводкой `#FFD700`.
8. Выборочный лак — полупрозрачные голубые прямоугольники `rgba(0, 204, 255, 0.2)` с пунктирной обводкой `#00CCFF`.
9. Контурная резка — `<path>` по переданному контуру, обводка `#FF00FF`.

### Опции `generatePreview`

| Опция | Назначение | Значение по умолчанию |
|---|---|---|
| `format` | Формат (A4, A5 и т.д.) | — |
| `bleed` | Вылеты в мм | 3 |
| `safeMargin` | Безопасная зона в мм | 5 |
| `folds` | Позиции сгибов: `[{position: 105, orientation: 'vertical'}]` | `[]` |
| `foilAreas` | Области фольгирования | `[]` |
| `varnishAreas` | Области лака | `[]` |
| `contourCut` | Контурная резка | `[]` |

Метод возвращает `{ previewUrl, svg, dimensions }`.

### Реализация класса (JavaScript)

```javascript
class MarkupPreviewGenerator {
    constructor() {
        this.markupTypes = [];
    }

    /** Загрузка типов меток */
    async loadMarkupTypes() {
        const result = await db.query(`
            SELECT * FROM markup_types WHERE is_active = true ORDER BY sort_order
        `);
        this.markupTypes = result.rows;
    }

    /** Генерация превью для макета */
    async generatePreview(orderId, fileId, options = {}) {
        const {
            format,              // формат (A4, A5, etc)
            bleed = 3,           // вылеты в мм
            safeMargin = 5,      // безопасная зона в мм
            folds = [],          // позиции сгибов [{position: 105, orientation: 'vertical'}]
            foilAreas = [],      // области фольгирования
            varnishAreas = [],   // области лака
            contourCut = []      // контурная резка
        } = options;

        // 1. Получаем размеры формата
        const formatSize = this.getFormatSize(format);

        // 2. Генерируем SVG
        const svg = this.generateSVG({
            width: formatSize.width,
            height: formatSize.height,
            bleed, safeMargin, folds, foilAreas, varnishAreas, contourCut, fileId
        });

        // 3. Сохраняем превью
        const previewUrl = await this.savePreview(orderId, svg);

        return { previewUrl, svg, dimensions: formatSize };
    }

    /** Генерация SVG с метками */
    generateSVG(params) {
        const { width, height, bleed, safeMargin, folds, foilAreas, varnishAreas, contourCut, fileId } = params;

        // Масштаб для отображения (ограничиваем максимальный размер)
        const maxSize = 600;
        const scale = Math.min(maxSize / width, maxSize / height);
        const displayWidth = width * scale;
        const displayHeight = height * scale;

        let svg = `<svg width="${displayWidth}" height="${displayHeight}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

        // 1. Фоновое изображение (макет)
        svg += `<image href="/api/preview/${fileId}?scale=${scale}" x="0" y="0" width="${width}" height="${height}" />`;

        // 2. Зона вылетов (Bleed)
        svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#0066CC" stroke-width="2" stroke-dasharray="4,4" />`;
        svg += `<text x="5" y="15" font-size="8" fill="#0066CC">Зона вылетов (${bleed} мм)</text>`;

        // 3. Безопасная зона (Safe margin)
        svg += `<rect x="${safeMargin}" y="${safeMargin}" width="${width - safeMargin*2}" height="${height - safeMargin*2}" fill="none" stroke="#00CC00" stroke-width="1" stroke-dasharray="2,2" />`;
        svg += `<text x="${safeMargin + 5}" y="${safeMargin + 12}" font-size="8" fill="#00CC00">Безопасная зона (${safeMargin} мм)</text>`;

        // 4. Линии реза
        svg += `<rect x="${bleed}" y="${bleed}" width="${width - bleed*2}" height="${height - bleed*2}" fill="none" stroke="#FF0000" stroke-width="2" />`;
        svg += `<text x="${bleed + 5}" y="${bleed + 12}" font-size="8" fill="#FF0000">Линия реза</text>`;

        // 5. Метки реза по углам
        const cutMarkSize = 10;
        const cutPositions = [
            { x: bleed, y: bleed },                    // левый верхний
            { x: width - bleed, y: bleed },            // правый верхний
            { x: bleed, y: height - bleed },           // левый нижний
            { x: width - bleed, y: height - bleed }    // правый нижний
        ];
        for (const pos of cutPositions) {
            svg += `<line x1="${pos.x - cutMarkSize}" y1="${pos.y}" x2="${pos.x + cutMarkSize}" y2="${pos.y}" stroke="#FF0000" stroke-width="1" />`;
            svg += `<line x1="${pos.x}" y1="${pos.y - cutMarkSize}" x2="${pos.x}" y2="${pos.y + cutMarkSize}" stroke="#FF0000" stroke-width="1" />`;
        }

        // 6. Линии сгибов
        for (const fold of folds) {
            const foldX = fold.orientation === 'vertical' ? fold.position : 0;
            svg += `<line x1="${foldX}" y1="0" x2="${foldX}" y2="${height}" stroke="#FF6600" stroke-width="2" stroke-dasharray="8,4" />`;
            svg += `<text x="${foldX + 5}" y="15" font-size="8" fill="#FF6600">Линия сгиба</text>`;
        }

        // 7. Фольгирование
        for (const foil of foilAreas) {
            svg += `<rect x="${foil.x}" y="${foil.y}" width="${foil.width}" height="${foil.height}" fill="rgba(255, 215, 0, 0.3)" stroke="#FFD700" stroke-width="2" />`;
            svg += `<text x="${foil.x + 5}" y="${foil.y + 15}" font-size="8" fill="#FFD700">Фольгирование</text>`;
        }

        // 8. Выборочный лак
        for (const varnish of varnishAreas) {
            svg += `<rect x="${varnish.x}" y="${varnish.y}" width="${varnish.width}" height="${varnish.height}" fill="rgba(0, 204, 255, 0.2)" stroke="#00CCFF" stroke-width="2" stroke-dasharray="4,4" />`;
            svg += `<text x="${varnish.x + 5}" y="${varnish.y + 15}" font-size="8" fill="#00CCFF">Выборочный лак</text>`;
        }

        // 9. Контурная резка
        for (const contour of contourCut) {
            svg += `<path d="${contour.path}" fill="none" stroke="#FF00FF" stroke-width="2" />`;
            svg += `<text x="${contour.x + 5}" y="${contour.y + 15}" font-size="8" fill="#FF00FF">Контурная резка</text>`;
        }

        svg += `</svg>`;
        return svg;
    }
}
```

> Примечание по линиям сгиба: в исходной реализации переменные `foldY`, `foldWidth`, `foldHeight` для горизонтальной ориентации вычисляются, но фактически линия сгиба всегда рисуется как вертикальная (от `y=0` до `y=height` по координате `foldX`). Горизонтальный сгиб не отрисовывается. См. открытый вопрос.

### HTML-превью с легендой и зумом

Метод `generateHtmlPreview(svg, options)` оборачивает SVG в HTML-страницу с:

- Панелью управления зумом: кнопки «+ Увеличить», «- Уменьшить», «100%» и индикатор текущего масштаба.
- Контейнером превью со стилем (белый фон, скругление, тень).
- Блоком легенды (флекс-раскладка) с цветными маркерами по каждому типу метки.

Логика зума (JavaScript):

```javascript
let currentScale = 1;

function zoomIn()  { currentScale = Math.min(currentScale + 0.1, 3);   applyZoom(); }
function zoomOut() { currentScale = Math.max(currentScale - 0.1, 0.5); applyZoom(); }
function resetZoom() { currentScale = 1; applyZoom(); }

function applyZoom() {
    preview.style.transform = 'scale(' + currentScale + ')';
    preview.style.transformOrigin = 'top left';
    zoomLevel.textContent = Math.round(currentScale * 100) + '%';
}
```

Границы зума: минимум `0.5` (50%), максимум `3` (300%), шаг `0.1` (10%).

## Интерфейс клиента (личный кабинет)

Экран «Предпросмотр макета» по заказу содержит:

- **Превью макета** — интерактивная область с макетом и метками; кнопки «+ Увеличить», «- Уменьшить», «Скачать PDF», «Скачать PNG».
- **Легенда** — расшифровка цветовых меток (см. раздел «Типы меток»).
- **Рекомендации**:
  - Важные элементы (текст, логотип) должны находиться внутри зелёной безопасной зоны.
  - Фоновое изображение должно доходить до синей зоны вылетов.
  - Области фольгирования и лака отмечены цветными зонами.
- **Действия**: «Подтвердить, что всё верно», «Сообщить о проблеме».

## Админка: настройка меток для продуктов

Настройка выполняется по паре «Продукт + Формат» (например, Листовки + A4).

### Основные параметры

- Вылеты (bleed): значение в мм (по умолчанию 3).
- Безопасная зона: значение в мм (по умолчанию 5).
- Показывать линии реза: да/нет.
- Показывать метки реза по углам: да/нет.

### Сгибы (для буклетов)

Добавление сгибов с типом и позицией, например: тип сгиба «Евробуклет (1 сгиб)», позиция `105` мм. Каждый сгиб можно сохранить или удалить.

### Дополнительные эффекты

Чекбоксы доступных эффектов: Фольгирование, Выборочный лак, Конгрев, Тиснение, Высечка, Биговка.

### Пример превью

Блок «Пример превью» отображает результат с текущими настройками, обновляется по кнопке «Обновить превью». Внизу — «Сохранить настройки».

## Интеграция с калькулятором (`MarkupIntegration`)

Два события связывают калькулятор с генератором превью.

### `onProductSelect(productType, format, orderId)`

При выборе типа продукции и формата:

1. Загружаются настройки меток для продукта из `product_markup_settings`.
2. Генерируется превью через `MarkupPreviewGenerator.generatePreview` с `bleed`, `safeMargin`, `folds` из настроек.
3. Возвращается HTML для отображения и сами настройки.

### `onServiceAdd(orderId, serviceType, params)`

При изменении параметров (добавление услуги):

- `serviceType === 'foiling'` → области фольгирования из `params.areas`.
- `serviceType === 'varnish'` → области лака из `params.areas`.
- Превью перегенерируется с новыми метками, возвращается обновлённый HTML.

```javascript
class MarkupIntegration {
    /** При выборе типа продукции и формата */
    async onProductSelect(productType, format, orderId) {
        const settings = await db.query(`
            SELECT * FROM product_markup_settings
            WHERE product_type = $1 AND format_id = $2
        `, [productType, format.id]);

        const generator = new MarkupPreviewGenerator();
        const preview = await generator.generatePreview(orderId, null, {
            format: format.name,
            bleed: settings.bleed_mm,
            safeMargin: settings.safe_margin_mm,
            folds: settings.default_folds
        });

        return {
            html: generator.generateHtmlPreview(preview.svg),
            settings: settings
        };
    }

    /** При изменении параметров (добавление фольгирования) */
    async onServiceAdd(orderId, serviceType, params) {
        const generator = new MarkupPreviewGenerator();
        let foilAreas = [];
        let varnishAreas = [];

        if (serviceType === 'foiling') foilAreas = params.areas;
        if (serviceType === 'varnish') varnishAreas = params.areas;

        const preview = await generator.generatePreview(orderId, null, {
            foilAreas, varnishAreas
        });

        return generator.generateHtmlPreview(preview.svg);
    }
}
```

> Примечание: в `onProductSelect` используется поле `settings.default_folds`, но в таблице `product_markup_settings` определён столбец `default_markups`. См. открытый вопрос.

> Примечание: в `onServiceAdd` превью перегенерируется только с `foilAreas`/`varnishAreas`, без передачи ранее выбранных формата, вылетов и сгибов. См. открытый вопрос.

## Динамическая визуализация продукта (программная отрисовка иконок)

Вместо статичных картинок-превью для каждой комбинации формата и ориентации используется программная отрисовка SVG по реальным размерам продукта. Компонент получает `width`, `height`, `bindingSide`, `bindingType` и рисует точную схему в реальном времени, поддерживая любой формат (включая нестандартные размеры).

Формула для клиента:

```
выбранный формат → realWidth, realHeight → программная отрисовка SVG → клиент видит точную схему
```

### Компонент `ProductVisualization` (React)

Параметры:

| Параметр | Тип | Назначение | По умолчанию |
|---|---|---|---|
| `width` | number | ширина продукта в мм | — |
| `height` | number | высота продукта в мм | — |
| `bindingSide` | string | сторона крепления: `left`, `top`, `right`, `bottom` | `left` |
| `bindingType` | string | тип крепления: `staple`, `spring`, `kbs`, `none` | `spring` |
| `orientation` | string | ориентация: `portrait`, `landscape` | `portrait` |
| `showDimensions` | boolean | показывать ли размеры | `true` |
| `scale` | number | масштаб отображения (по умолчанию 1px = 1мм, но ограничивается) | `1` |

Ограничение масштаба отображения:

```
maxDisplaySize = 200            // px
displayScale = min(scale, maxDisplaySize / max(width, height))
displayWidth  = width  * displayScale
displayHeight = height * displayScale
```

Позиция крепления в зависимости от стороны:

```javascript
switch (bindingSide) {
    case 'left':   return { x: 0,             y: displayHeight / 2 };
    case 'right':  return { x: displayWidth,  y: displayHeight / 2 };
    case 'top':    return { x: displayWidth / 2, y: 0 };
    case 'bottom': return { x: displayWidth / 2, y: displayHeight };
    default:       return { x: 0,             y: displayHeight / 2 };
}
```

SVG строится из слоёв: тень продукта, основной прямоугольник, крепление (`BindingMarker`), размеры (`DimensionLabels`), линии корешка/сгиба (`SpineLines`, только при `bindingType !== 'none'`).

```jsx
const ProductVisualization = ({
    width, height,
    bindingSide = 'left',
    bindingType = 'spring',
    orientation = 'portrait',
    showDimensions = true,
    scale = 1
}) => {
    const maxDisplaySize = 200;
    const displayScale = Math.min(scale, maxDisplaySize / Math.max(width, height));
    const displayWidth = width * displayScale;
    const displayHeight = height * displayScale;

    const bindingPosition = useMemo(() => {
        switch (bindingSide) {
            case 'left':   return { x: 0, y: displayHeight / 2 };
            case 'right':  return { x: displayWidth, y: displayHeight / 2 };
            case 'top':    return { x: displayWidth / 2, y: 0 };
            case 'bottom': return { x: displayWidth / 2, y: displayHeight };
            default:       return { x: 0, y: displayHeight / 2 };
        }
    }, [bindingSide, displayWidth, displayHeight]);

    return (
        <svg
            width={displayWidth + (bindingType !== 'none' ? 40 : 0)}
            height={displayHeight + (bindingType !== 'none' ? 40 : 0)}
            viewBox={`-20 -20 ${displayWidth + 40} ${displayHeight + 40}`}
            className="product-visualization"
        >
            <rect x={-5} y={-5} width={displayWidth + 10} height={displayHeight + 10} rx="4" fill="rgba(0,0,0,0.05)" />
            <rect x={0} y={0} width={displayWidth} height={displayHeight} rx="4" fill="white" stroke="#333" strokeWidth="1.5" className="product-rect" />
            <BindingMarker type={bindingType} x={bindingPosition.x} y={bindingPosition.y} side={bindingSide} displayWidth={displayWidth} displayHeight={displayHeight} />
            {showDimensions && (
                <DimensionLabels width={width} height={height} displayWidth={displayWidth} displayHeight={displayHeight} orientation={orientation} />
            )}
            {bindingType !== 'none' && (
                <SpineLines side={bindingSide} displayWidth={displayWidth} displayHeight={displayHeight} />
            )}
        </svg>
    );
};
```

### Компонент крепления `BindingMarker`

Корректирует позицию и поворот в зависимости от стороны (`left`/`right` — поворот 0°, `top`/`bottom` — поворот 90°) и рисует разные элементы по типу:

- `spring` — пружина (зигзаг-путь + кружок с символом ⛭).
- `staple` — скоба (прямоугольник с тремя горизонтальными линиями).
- `kbs` — клеевое бесшвейное скрепление (квадрат с подписью «клей»).
- `none` — ничего не рисуется (`return null`).

```jsx
const BindingMarker = ({ type, x, y, side, displayWidth, displayHeight }) => {
    if (type === 'none') return null;

    let adjustedX = x, adjustedY = y, rotation = 0;
    switch (side) {
        case 'left':   adjustedX = -12;               adjustedY = y; rotation = 0;  break;
        case 'right':  adjustedX = displayWidth + 2;  adjustedY = y; rotation = 0;  break;
        case 'top':    adjustedX = x; adjustedY = -12;                rotation = 90; break;
        case 'bottom': adjustedX = x; adjustedY = displayHeight + 2;  rotation = 90; break;
    }

    if (type === 'spring') {
        return (
            <g transform={`translate(${adjustedX}, ${adjustedY}) rotate(${rotation})`}>
                <path d="M 0 0 L 0 -20 L 5 -20 L 5 0 L 10 0 L 10 -20 L 15 -20 L 15 0" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="7.5" cy="-10" r="3" fill="none" stroke="#666" strokeWidth="1" />
                <text x="7.5" y="-8" fontSize="6" textAnchor="middle" fill="#666">⛭</text>
            </g>
        );
    }
    if (type === 'staple') {
        return (
            <g transform={`translate(${adjustedX - 5}, ${adjustedY - 8})`}>
                <rect x="0" y="0" width="10" height="16" rx="2" fill="none" stroke="#666" strokeWidth="1" />
                <line x1="2" y1="4" x2="8" y2="4" stroke="#666" strokeWidth="1" />
                <line x1="2" y1="8" x2="8" y2="8" stroke="#666" strokeWidth="1" />
                <line x1="2" y1="12" x2="8" y2="12" stroke="#666" strokeWidth="1" />
            </g>
        );
    }
    if (type === 'kbs') {
        return (
            <g transform={`translate(${adjustedX - 10}, ${adjustedY - 10}) rotate(${rotation})`}>
                <rect x="0" y="0" width="20" height="20" rx="2" fill="#f0f0f0" stroke="#999" strokeWidth="1" />
                <text x="10" y="14" fontSize="10" textAnchor="middle" fill="#666">клей</text>
            </g>
        );
    }
    return null;
};
```

### Компонент размеров `DimensionLabels`

Рисует горизонтальную и вертикальную размерные линии (пунктир) с подписями в мм и индикатором ориентации («Книжная» / «Альбомная»). Целые значения выводятся без десятичных, дробные — с одним знаком:

```javascript
const formatDim = (val) => val % 1 === 0 ? val.toString() : val.toFixed(1);
```

### Компонент линий корешка/сгиба `SpineLines`

Для брошюр рисует оранжевую пунктирную линию корешка (`#ff9900`, `strokeDasharray="4 4"`) вдоль стороны крепления, со смещением 5% от соответствующего края:

- `left` — вертикальная линия на `displayWidth * 0.05`.
- `right` — вертикальная линия на `displayWidth * 0.95`.
- `top` — горизонтальная линия на `displayHeight * 0.05`.
- `bottom` — горизонтальная линия на `displayHeight * 0.95`.

### Интеграция с калькулятором брошюр

Компонент `BrochureCalculator` управляет состоянием: `format`, `orientation`, `bindingType`, `bindingSide`. Текущие размеры зависят от ориентации:

```javascript
currentWidth  = orientation === 'portrait' ? format.width  : format.height;
currentHeight = orientation === 'portrait' ? format.height : format.width;
```

Сторона крепления определяется автоматически при изменении ориентации/типа. По текущим правилам и для пружины, и для скобы:

```javascript
const getBindingSide = (orientation, bindingType) => {
    if (bindingType === 'staple') {
        return orientation === 'portrait' ? 'left' : 'top';
    }
    return orientation === 'portrait' ? 'left' : 'top';
};
```

Пояснения для клиента под визуализацией:

- Пружина: крепится слева (книжная) или сверху (альбомная).
- Скоба: крепится слева (книжная) или сверху (альбомная).
- КБС: клеевой корешок.

В селекторе формата доступен пункт «Свой размер...» с полями ввода ширины и высоты.

### Нестандартные форматы

Компонент `CustomFormatVisualization` позволяет вводить произвольные ширину и высоту (диапазон 50–500 мм), ориентация определяется автоматически:

```javascript
orientation = customWidth < customHeight ? 'portrait' : 'landscape'
```

### Настройка визуализации в админке

Общие настройки:

| Параметр | Значение по умолчанию |
|---|---|
| Цвет обложки | `#FFFFFF` |
| Цвет страниц | `#F5F5F5` |
| Цвет корешка | `#CCCCCC` |
| Цвет пружины | `#666666` |
| Показывать размеры | Да |
| Единицы измерения | мм |
| Максимальный размер визуализации | 200 px |

Настройки креплений — правила определения стороны крепления (для пружины и скобы) по ориентации: книжная → слева, альбомная → сверху (значения настраиваемые).

Блок предпросмотра позволяет выбрать формат, ориентацию и тип крепления; визуализация обновляется автоматически.

### Преимущества подхода

| Преимущество | Описание |
|---|---|
| Динамичность | Визуализация обновляется мгновенно при любом изменении параметров |
| Поддержка нестандартов | Клиент может ввести любой размер — схема подстроится автоматически |
| Нет необходимости в картинках | Не нужно загружать сотни изображений для всех комбинаций форматов и ориентаций |
| Единый источник истины | Размеры берутся из справочника форматов, нет расхождений с текстовым описанием |
| Лёгкая кастомизация | Цвета, толщина линий, стиль иконок настраиваются в админке |
| SEO-дружественность | SVG-графика индексируется, можно добавить текстовые описания |
| Адаптивность | Масштабируется под любой размер экрана |

## Открытые вопросы

⚠️ ОТКРЫТЫЙ ВОПРОС: Толщина линии зоны вылетов (`bleed`) расходится: в таблице `markup_types` задано `line_width = 1`, а в коде генерации SVG прямоугольник вылетов рисуется со `stroke-width="2"`. Нужно определить единое значение.

⚠️ ОТКРЫТЫЙ ВОПРОС: Горизонтальные линии сгиба не реализованы. В `generateSVG` для сгибов вычисляются `foldY`/`foldWidth`/`foldHeight`, но фактически линия сгиба всегда рисуется вертикальной (по `foldX` от `y=0` до `y=height`). Требуется доработать отрисовку горизонтальных сгибов.

⚠️ ОТКРЫТЫЙ ВОПРОС: Несоответствие имён полей настроек меток. В `onProductSelect` читается `settings.default_folds`, тогда как в таблице `product_markup_settings` определён столбец `default_markups`. Нужно согласовать схему данных и код (а также определить, где хранятся позиции сгибов по умолчанию).

⚠️ ОТКРЫТЫЙ ВОПРОС: При `onServiceAdd` превью перегенерируется только с `foilAreas`/`varnishAreas`, без передачи ранее выбранных формата, вылетов, безопасной зоны и сгибов — это приведёт к потере контекста макета. Требуется передавать полный набор параметров текущего заказа.

⚠️ ОТКРЫТЫЙ ВОПРОС: Логика `getBindingSide` для типов `spring` и `staple` идентична (обе ветки возвращают одно и то же), а ветки для `kbs`/`none` не описаны. Нужно уточнить правила определения стороны крепления по всем типам.

## Источник

Материал собран из папки `D:\roman\Desktop\PRINTOFFICE\context\raw`:

- `production.md`, строки 67–108 — раздел «Доработка: Визуализация макета с метками (превью для клиента)»: концепция и пайплайн, типы меток, SQL-структуры (`markup_types`, `product_markup_settings`, `order_markups`), класс `MarkupPreviewGenerator` (генерация SVG, HTML-превью, зум, легенда), интерфейс клиента, настройка меток в админке, интеграция с калькулятором (`MarkupIntegration`: `onProductSelect`/`onServiceAdd`). Первоисточник — чат DeepSeek.
- `architecture.md`, строки 12192–12268 — раздел «Иконки размеров-формата / Программная отрисовка иконок с динамическими размерами»: компоненты `ProductVisualization`, `BindingMarker`, `DimensionLabels`, `SpineLines`, интеграция с `BrochureCalculator`, нестандартные форматы, настройка визуализации в админке, преимущества подхода. Первоисточник — чат DeepSeek.
