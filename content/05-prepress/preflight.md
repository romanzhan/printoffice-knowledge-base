# Препресс: автопроверка макета (preflight)

Автоматическая валидация PDF-макета при загрузке: проверка технических параметров печати (формат, размеры, dpi, цвет, вылеты, шрифты, слои, прозрачность), формирование статуса и отчёта, действия менеджера и отправка результата клиенту. Цель — заменить ручную проверку менеджером, исключить запуск в производство макетов с критическими ошибками («ошибка в макете, замеченная после печати, — это 100% убыток») и снять рутинную нагрузку.

## Назначение и роль в процессе

Как только клиент или менеджер загружает файл, система автоматически прогоняет его через префлайт-движок. Система выступает не просто «хранилищем файлов», а цифровым контролёром качества: макет не может быть отправлен в производство, пока критические ошибки не исправлены.

Допускается использование готовых библиотек (например, `pdf2tk`, PDF-lib) или облачных сервисов, либо собственной утилиты под стек проекта. Анализ PDF на сервере — технически нетривиальная задача, поэтому полноценный префлайт можно вынести на этап 2–3 разработки.

### Ограничения и риски автоматизации

- **Ложное чувство безопасности.** Автоматическая проверка не панацея: она не ловит смысловые ошибки (например, неправильный телефон в макете). Необходимо оставить место для ручного контроля менеджером.
- **Геометрия вылетов.** Геометрически проверить наличие вылетов сложно; в качестве приближения сверяются размеры файла с заявленным форматом заказа.

## Технические требования к макету (критерии preflight)

Файлы принимаются в формате PDF и должны соответствовать техническим требованиям:

| Параметр | Требование |
|---|---|
| Формат файла | PDF |
| Вылеты (bleed) | 3 мм со всех сторон |
| Разрешение | не ниже 300 dpi |
| Слои | все слои сведены |
| Шрифты | переведены в кривые (или встроены в PDF) |
| Цветовая модель | CMYK |

После загрузки макет проверяется. Если нужны правки — лёгкие вносятся бесплатно, сложные платно, либо клиента просят исправить макет самостоятельно. После подготовки макета делается принтскрин и согласовывается с клиентом; после согласования макета претензии по макету не принимаются.

## Чек-лист параметров проверки

Полный набор проверяемых параметров с порогами и статусами (pass / warning / fail):

### Формат файла

| Статус | Значение |
|---|---|
| ✅ pass | PDF (рекомендуется) |
| ⚠️ warning | CDR, AI, EPS, PSD (требуется конвертация) |
| ❌ fail | JPG, PNG, TIFF — только если нет вектора (предупреждение) |

### Размеры

Допуск ±2 мм относительно заказанного формата.

| Статус | Условие |
|---|---|
| ✅ pass | размер макета соответствует заказанному формату |
| ⚠️ warning | размер макета отличается (возможно масштабирование) |
| ❌ fail | размер макета слишком маленький или слишком большой |

### Разрешение (DPI)

| Статус | Порог |
|---|---|
| ✅ pass | 300 dpi (оптимально) |
| ⚠️ warning | 150–299 dpi (возможна потеря качества) |
| ❌ fail | < 150 dpi (печать невозможна) |

### Цветовая модель

| Статус | Значение |
|---|---|
| ✅ pass | CMYK (правильно для печати) |
| ⚠️ warning | RGB (будет конвертироваться, возможно изменение цветов) |
| ❌ fail | Lab, Grayscale (требуется конвертация) |

### Вылеты (bleed)

| Статус | Порог |
|---|---|
| ✅ pass | 3 мм со всех сторон (правильно) |
| ⚠️ warning | 1–2 мм (риск белых полей при резке) |
| ❌ fail | 0 мм (нет вылетов) |

### Шрифты

| Статус | Условие |
|---|---|
| ✅ pass | шрифты в кривых / встроены в PDF |
| ⚠️ warning | шрифты не встроены (нужно прислать или перевести в кривые) |
| ❌ fail | отсутствуют шрифты (печать невозможна) |

### Слои и прозрачность

| Статус | Условие |
|---|---|
| ✅ pass | слои не сведены (можно править) |
| ⚠️ warning | слои сведены (правки затруднены) |
| ⚠️ warning | присутствует прозрачность (может вызвать проблемы при печати) |

⚠️ ОТКРЫТЫЙ ВОПРОС: по требованиям к файлу (раздел AS-IS) слои должны быть **сведены**, а в чек-листе preflight статус «слои сведены» помечен как ⚠️ warning, а «слои не сведены» — как ✅ pass (логика «можно править»). Нужно согласовать желаемое поведение проверки слоёв: считать сведённые слои нормой (pass) или замечанием (warning).

## Статусы и уровни серьёзности

### Общий статус результата проверки

| Статус | Значение | Дальнейшее действие |
|---|---|---|
| `pass` | все параметры OK | печать возможна → отправить на согласование |
| `warning` | есть замечания | нужны правки → создать отчёт о проверке |
| `fail` | критические ошибки | печать невозможна → создать отчёт о проверке |

Логика определения общего статуса:

```
status = 'pass'
если есть хотя бы одна непройденная проверка severity = 'error'  → status = 'fail'
иначе если есть непройденная проверка severity = 'warning'        → status = 'warning'

canPrint      = (status != 'fail')
needsApproval = hasWarnings
```

### Уровни серьёзности правила (severity)

| severity | Назначение |
|---|---|
| `error` | критическая ошибка, блокирует запуск в производство |
| `warning` | замечание, требует внимания/правок, не блокирует печать |
| `info` | информационное сообщение (например, «Файл в формате PDF — отлично!») |

## Структура БД

### Таблица правил `preflight_rules` (настраивается в админке)

```sql
CREATE TABLE preflight_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) UNIQUE,
    description TEXT,

    -- Параметр проверки
    parameter ENUM('format', 'size', 'resolution', 'color', 'bleed', 'fonts', 'layers', 'transparency') NOT NULL,

    -- Условие
    condition_type ENUM('equals', 'not_equals', 'greater_than', 'less_than', 'between', 'contains') NOT NULL,
    condition_value VARCHAR(255),

    -- Уровень серьезности
    severity ENUM('error', 'warning', 'info') DEFAULT 'warning',

    -- Сообщение для клиента
    message_template TEXT NOT NULL,
    recommendation_template TEXT,

    -- Автоисправление (если возможно)
    auto_fix JSON,                          -- {"fix_type": "convert_to_cmyk", "params": {}}

    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Таблица результатов `preflight_results`

```sql
CREATE TABLE preflight_results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    file_id INT NOT NULL,
    order_id INT,

    -- Общий статус
    status ENUM('pass', 'warning', 'fail') NOT NULL,

    -- Детали проверки
    results JSON NOT NULL,                  -- массив результатов по каждому параметру

    -- Отчет
    report_text TEXT,
    report_url VARCHAR(500),                -- ссылка на PDF-отчет

    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (file_id) REFERENCES files(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    INDEX idx_file (file_id),
    INDEX idx_order (order_id)
);
```

### Примеры правил

```sql
INSERT INTO preflight_rules (name, code, parameter, condition_type, condition_value, severity, message_template, recommendation_template, sort_order) VALUES
('Проверка формата PDF', 'check_format_pdf', 'format', 'equals', 'application/pdf', 'info',
  'Файл в формате PDF — отлично!', NULL, 10),

('Проверка формата растровый', 'check_format_raster', 'format', 'contains', 'image/', 'warning',
  'Файл в растровом формате ({actual_value}). Для качественной печати рекомендуется векторный PDF.',
  'Пришлите, пожалуйста, макет в формате PDF или векторном формате (AI, EPS, CDR).', 20),

('Проверка разрешения', 'check_resolution', 'resolution', 'less_than', '300', 'error',
  'Разрешение макета {actual_value} dpi ниже требуемого (300 dpi). При печати изображение будет размытым.',
  'Пожалуйста, предоставьте макет с разрешением 300 dpi.', 30),

('Проверка вылетов', 'check_bleed', 'bleed', 'less_than', '3', 'error',
  'Вылеты (bleed) составляют {actual_value} мм, требуется 3 мм. При резке могут появиться белые поля.',
  'Добавьте вылеты 3 мм со всех сторон или воспользуйтесь нашим шаблоном.', 40),

('Проверка цветовой модели', 'check_color_cmyk', 'color', 'not_equals', 'CMYK', 'warning',
  'Цветовая модель {actual_value} не соответствует CMYK. Цвета могут измениться при печати.',
  'Пожалуйста, конвертируйте макет в CMYK или доверьтесь нашей автоматической конвертации.', 50);
```

## Класс PreflightChecker (анализ PDF)

Движок проверки: загружает активные правила, получает информацию о файле через Ghostscript/PDF-lib, применяет правила, вычисляет общий статус, генерирует и сохраняет отчёт.

```javascript
class PreflightChecker {
    constructor() {
        this.rules = [];
    }

    /** Загрузка правил проверки */
    async loadRules() {
        this.rules = await db.query(`
            SELECT * FROM preflight_rules
            WHERE is_active = true
            ORDER BY sort_order
        `);
        return this.rules.rows;
    }

    /** Проверка макета */
    async check(filePath, orderParams = {}) {
        const results = [];
        let hasErrors = false;
        let hasWarnings = false;

        // 1. Получаем информацию о файле
        const fileInfo = await this.getFileInfo(filePath);

        // 2. Применяем правила
        for (const rule of this.rules.rows) {
            const checkResult = await this.applyRule(rule, fileInfo, orderParams);
            results.push(checkResult);

            if (checkResult.severity === 'error' && !checkResult.passed) {
                hasErrors = true;
            }
            if (checkResult.severity === 'warning' && !checkResult.passed) {
                hasWarnings = true;
            }
        }

        // 3. Определяем общий статус
        let status = 'pass';
        if (hasErrors) status = 'fail';
        else if (hasWarnings) status = 'warning';

        // 4. Генерируем отчет
        const report = this.generateReport(results, fileInfo);

        // 5. Сохраняем результат
        const savedResult = await this.saveResult(filePath, results, status, report);

        return {
            status,
            hasErrors,
            hasWarnings,
            results,
            report,
            canPrint: status !== 'fail',
            needsApproval: hasWarnings,
            resultId: savedResult.id
        };
    }

    /** Применение одного правила */
    async applyRule(rule, fileInfo, orderParams) {
        let actualValue = null;
        let passed = true;

        switch(rule.parameter) {
            case 'format':
                actualValue = fileInfo.mimetype;
                passed = this.evaluateCondition(rule.condition_type, rule.condition_value, actualValue);
                break;

            case 'size':
                const expectedWidth = orderParams.width || 210;
                const expectedHeight = orderParams.height || 297;
                const widthMatch = Math.abs(fileInfo.width - expectedWidth) <= 2;
                const heightMatch = Math.abs(fileInfo.height - expectedHeight) <= 2;
                passed = widthMatch && heightMatch;
                actualValue = `${fileInfo.width}×${fileInfo.height} мм`;
                break;

            case 'resolution':
                actualValue = fileInfo.dpi;
                passed = this.evaluateCondition(rule.condition_type, rule.condition_value, actualValue);
                break;

            case 'color':
                actualValue = fileInfo.colorSpace;
                passed = this.evaluateCondition(rule.condition_type, rule.condition_value, actualValue);
                break;

            case 'bleed':
                actualValue = fileInfo.bleed;
                passed = this.evaluateCondition(rule.condition_type, rule.condition_value, actualValue);
                break;

            case 'fonts':
                actualValue = fileInfo.fonts;
                passed = fileInfo.fontsEmbedded;
                break;

            case 'layers':
                actualValue = fileInfo.layers;
                passed = !fileInfo.layersFlattened;
                break;

            case 'transparency':
                actualValue = fileInfo.hasTransparency;
                passed = !fileInfo.hasTransparency;
                break;
        }

        // Формируем сообщение
        let message = rule.message_template;
        if (actualValue !== null) {
            message = message.replace('{actual_value}', actualValue);
        }

        let recommendation = rule.recommendation_template;

        return {
            ruleId: rule.id,
            ruleName: rule.name,
            parameter: rule.parameter,
            passed,
            severity: rule.severity,
            actualValue,
            expectedValue: rule.condition_value,
            message,
            recommendation,
            canAutoFix: rule.auto_fix !== null,
            autoFix: rule.auto_fix
        };
    }

    /** Оценка условия */
    evaluateCondition(conditionType, conditionValue, actualValue) {
        switch(conditionType) {
            case 'equals':
                return actualValue === conditionValue;
            case 'not_equals':
                return actualValue !== conditionValue;
            case 'greater_than':
                return actualValue > parseFloat(conditionValue);
            case 'less_than':
                return actualValue < parseFloat(conditionValue);
            case 'between':
                const [min, max] = conditionValue.split(',');
                return actualValue >= parseFloat(min) && actualValue <= parseFloat(max);
            case 'contains':
                return actualValue?.includes(conditionValue);
            default:
                return true;
        }
    }

    /** Получение информации о файле (через Ghostscript или PDF-lib) */
    async getFileInfo(filePath) {
        const exec = require('child_process').exec;

        return new Promise((resolve, reject) => {
            // Получаем размеры страницы, разрешение, цветовое пространство
            exec(`gs -q -dNODISPLAY -dNOSAFER -dBATCH -sDEVICE=bbox "${filePath}" 2>&1`, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }

                const info = {
                    mimetype: 'application/pdf',
                    width: 0,
                    height: 0,
                    dpi: 300,
                    colorSpace: 'CMYK',
                    bleed: 3,
                    fontsEmbedded: true,
                    layersFlattened: false,
                    hasTransparency: false
                };

                // Извлекаем размеры из %%BoundingBox
                const bboxMatch = stdout.match(/%%BoundingBox: (\d+) (\d+) (\d+) (\d+)/);
                if (bboxMatch) {
                    const width = parseInt(bboxMatch[3]) - parseInt(bboxMatch[1]);
                    const height = parseInt(bboxMatch[4]) - parseInt(bboxMatch[2]);
                    info.width = Math.round(width / 2.83465);  // пункты в мм
                    info.height = Math.round(height / 2.83465);
                }

                resolve(info);
            });
        });
    }

    /** Генерация отчета */
    generateReport(results, fileInfo) {
        const errors = results.filter(r => r.severity === 'error' && !r.passed);
        const warnings = results.filter(r => r.severity === 'warning' && !r.passed);
        const infos = results.filter(r => r.severity === 'info');

        let report = `╔══════════════════════════════════════════════════════════════════╗
║                    ОТЧЕТ О ПРОВЕРКЕ МАКЕТА                      ║
╠══════════════════════════════════════════════════════════════════╣
║  Файл: ${fileInfo.originalName}
║  Размер: ${fileInfo.width}×${fileInfo.height} мм
║  Разрешение: ${fileInfo.dpi} dpi
║  Цветовая модель: ${fileInfo.colorSpace}
╚══════════════════════════════════════════════════════════════════╝
`;

        if (errors.length > 0) {
            report += `❌ КРИТИЧЕСКИЕ ОШИБКИ (${errors.length}):\n`;
            for (const err of errors) {
                report += `   • ${err.message}\n`;
                if (err.recommendation) report += `     → ${err.recommendation}\n`;
            }
            report += `\n`;
        }

        if (warnings.length > 0) {
            report += `⚠️ ПРЕДУПРЕЖДЕНИЯ (${warnings.length}):\n`;
            for (const warn of warnings) {
                report += `   • ${warn.message}\n`;
                if (warn.recommendation) report += `     → ${warn.recommendation}\n`;
            }
            report += `\n`;
        }

        if (errors.length === 0 && warnings.length === 0) {
            report += `✅ МАКЕТ ПРОШЕЛ ПРОВЕРКУ!\n`;
            report += `   Все параметры соответствуют требованиям печати.\n`;
        }

        return report;
    }

    /** Сохранение результата */
    async saveResult(filePath, results, status, report) {
        const result = await db.query(`
            INSERT INTO preflight_results (file_id, status, results, report_text, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id
        `, [filePath, status, JSON.stringify(results), report]);

        return { id: result.rows[0].id };
    }
}
```

### Замечания по реализации

- Размеры извлекаются из `%%BoundingBox` Ghostscript; перевод пунктов в миллиметры — деление на коэффициент `2.83465` (1 мм ≈ 2.83465 pt).
- Формула проверки размеров с допуском ±2 мм:

  ```
  widthMatch  = |fileInfo.width  - expectedWidth|  <= 2
  heightMatch = |fileInfo.height - expectedHeight| <= 2
  passed      = widthMatch && heightMatch
  ```

- Значения формата по умолчанию (если не задан заказ): ширина 210 мм, высота 297 мм (A4).
- В `message_template` подставляется фактическое значение через плейсхолдер `{actual_value}`.

⚠️ ОТКРЫТЫЙ ВОПРОС: в методе `check()` правила перебираются через `this.rules.rows`, тогда как `loadRules()` возвращает `this.rules.rows`, но присваивает `this.rules` целиком результат запроса. Способ хранения и обхода правил (`this.rules` vs `this.rules.rows`) в коде непоследователен — требуется унификация при реализации.

⚠️ ОТКРЫТЫЙ ВОПРОС: реальный анализ через Ghostscript в `getFileInfo()` извлекает только размеры из BoundingBox, а dpi, colorSpace, bleed, fontsEmbedded, layersFlattened, hasTransparency возвращаются заглушками (хардкод). Механизм фактического определения этих параметров (разрешение, цвет, вылеты, шрифты, слои, прозрачность) не реализован и требует доработки или подключения внешней библиотеки/сервиса.

## Автоисправление (auto_fix)

Правило может содержать поле `auto_fix` (JSON), описывающее возможность автоматического исправления, например:

```json
{ "fix_type": "convert_to_cmyk", "params": {} }
```

Если `auto_fix` задан, результат проверки помечается `canAutoFix = true`. В тексте сообщений клиенту автоисправление упоминается как опция (например: «...или доверьтесь нашей автоматической конвертации» для перевода в CMYK).

## Админка: настройка правил проверки

Раздел «Правила проверки макетов (Preflight)» со списком правил и кнопкой «Добавить правило». Каждое правило отображается карточкой:

- код и название правила (например, `check_resolution`);
- порядок сортировки (`sort_order`);
- параметр, условие, уровень серьёзности;
- сообщение для клиента;
- действия: **Редактировать**, **Клонировать**, **Отключить**, **Удалить**.

Пример карточек правил:

| Правило (code) | Параметр | Условие | Уровень | Порядок | Сообщение |
|---|---|---|---|---|---|
| Проверка формата (`check_format_pdf`) | формат файла | равно PDF | info | 10 | «Файл в формате PDF — отлично!» |
| Проверка размеров (`check_size`) | размеры | соответствуют заказу | error | 20 | «Размер макета не соответствует заказанному формату» |
| Проверка разрешения (`check_resolution`) | разрешение | меньше 300 | error | 30 | «Разрешение {actual_value} dpi ниже требуемого (300 dpi)» |
| Проверка вылетов (`check_bleed`) | вылеты | меньше 3 | error | 40 | «Вылеты {actual_value} мм, требуется 3 мм» |

## Интерфейс менеджера (результат проверки)

Экран «Проверка макета» с привязкой к заказу (номер заказа, клиент, имя файла). Содержит:

- общий результат проверки (например, «⚠️ Есть замечания»);
- блок **Критические ошибки** с сообщением и рекомендацией по каждой;
- блок **Предупреждения** с сообщением и рекомендацией;
- блок **Информация** с пройденными/информационными проверками.

Пример заполненного экрана (заказ №12345, клиент Иван Иванов, файл `maket_final.pdf`, общий результат «⚠️ Есть замечания»):

**❌ Критические ошибки (1)**

- Разрешение макета **150 dpi** ниже требуемого (300 dpi). При печати изображение будет размытым.
  → Пожалуйста, предоставьте макет с разрешением 300 dpi.

**⚠️ Предупреждения (2)**

- Файл в растровом формате **PNG**. Для качественной печати рекомендуется векторный PDF.
  → Пришлите, пожалуйста, макет в формате PDF или векторном формате.
- Цветовая модель **RGB** не соответствует CMYK. Цвета могут измениться при печати.
  → Пожалуйста, конвертируйте макет в CMYK.

**ℹ️ Информация**

- Файл в формате PDF — отлично!
- Шрифты встроены в файл.

### Действия менеджера

- **Отправить клиенту на доработку**
- **Править сами**
- **Игнорировать и печатать**

## Отправка отчёта клиенту

Класс `PreflightReportSender` формирует сообщение по статусу и рассылает его клиенту через Telegram и email, а также прикладывает PDF-отчёт.

```javascript
class PreflightReportSender {
    async sendReportToClient(orderId, preflightResult, clientContact) {
        const { report_text, status, hasErrors, hasWarnings } = preflightResult;

        let message = '';

        if (status === 'fail') {
            message = `❌ **Макет требует исправления**

Мы проверили ваш макет и обнаружили критические ошибки, которые не позволят качественно напечатать заказ.

${report_text}

**Что делать?**
Пожалуйста, исправьте макет по замечаниям выше и пришлите заново.

Если у вас есть вопросы — напишите нам.`;
        } else if (status === 'warning') {
            message = `⚠️ **Макет требует внимания**

Мы проверили ваш макет и обнаружили некоторые недочеты.

${report_text}

**Рекомендация:**
Рекомендуем исправить замечания для лучшего качества печати.

Если вы согласны на печать с текущим макетом — подтвердите, пожалуйста.`;
        } else {
            message = `✅ **Макет прошел проверку!**

Ваш макет соответствует всем техническим требованиям.

${report_text}

Мы готовы начать печать. Подтвердите, пожалуйста, старт производства.`;
        }

        // Отправляем клиенту
        await this.sendTelegram(clientContact.telegram, message);
        await this.sendEmail(clientContact.email, 'Результат проверки макета', report_text);

        // Отправляем сам отчет (PDF)
        await this.sendPdfReport(clientContact, preflightResult);
    }
}
```

Тексты сообщений по статусам:

| Статус | Заголовок | Призыв к действию |
|---|---|---|
| `fail` | «Макет требует исправления» | исправить по замечаниям и прислать заново |
| `warning` | «Макет требует внимания» | исправить рекомендуется; либо подтвердить печать «как есть» |
| `pass` | «Макет прошёл проверку!» | подтвердить старт производства |

## Связь со статусной моделью макета

Префлайт — часть жизненного цикла макета. Превью с водяным знаком (watermark), статусы макета (Черновик → На проверке у менеджера → На согласовании с клиентом → Согласован → В производстве/В печати), версионность и фиксация согласования (IP, дата, время, версия) описаны в смежной документации по жизненному циклу и согласованию макета. После статуса «Согласован» файл блокируется для замены без создания новой версии; претензии по макету после согласования не принимаются.

## Источник

Материал собран из:

- `raw/production.md`, строки 1–65 — «Проверка макета (автоматическая валидация PDF)»: общая схема preflight, чек-лист параметров с порогами и статусами, SQL-таблицы `preflight_rules` и `preflight_results` с примерами правил, класс `PreflightChecker` (Ghostscript/PDF-lib, applyRule, evaluateCondition, getFileInfo, generateReport, saveResult), статусы pass/warning/fail и severity error/warning/info, админка правил, интерфейс менеджера с действиями, класс `PreflightReportSender` (отправка отчёта клиенту).
- `raw/architecture.md`, строки 9799–9876 (дубль строк 1285–1316, взят один экземпляр) — эталонный ответ архитектора про автоматический префлайт при загрузке: что проверяем (300 dpi, CMYK, вылеты через сверку размеров, шрифты в кривых), готовые библиотеки/свой движок, риски автоматизации (ложное чувство безопасности, техсложность).
- `raw/architecture.md`, строка 135 — технические требования к файлу из описания бизнес-процессов AS-IS (PDF, вылеты 3 мм, 300 dpi, сведённые слои, шрифты в кривые).
