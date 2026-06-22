# Сайт: структура и витрина

Документ описывает движок сайта типографии PrintOffice: информационную архитектуру и URL-схему, техническую архитектуру (Next.js + TypeScript + Tailwind), SEO-фундамент, а также универсальную систему витрины (семейства товаров, варианты, кросс/ап-селл, бандлы) с многоуровневой системой отображения (глобально → категория → страница → исключения).

---

## 1. Информационная архитектура и подход

Построение сайта ведётся по трёхуровневой стратегии:

1. **Структура сайта (IA — Information Architecture)** — анализ аудитории (B2C/B2B), карта сайта (URL-структура, иерархия), типовые страницы (категории, товары, услуги, статьи), навигация (меню, хлебные крошки, фильтры).
2. **Техническая архитектура** — выбор фреймворка (Next.js + Strapi/Prismic как опция CMS), модульная структура (компоненты, API, БД), система управления контентом (админка), интеграция с калькуляторами.
3. **SEO-фундамент** — технический SEO (мета-теги, URL, sitemap, robots.txt), семантическое ядро (кластеризация запросов), контентная стратегия, внутренняя перелинковка, внешние факторы (скорость, мобильная адаптация, микроразметка).

---

## 2. URL-схема сайта

Базовый домен: `printoffice.ru` (в SEO-константах также фигурирует `printoffice.moscow` — см. открытый вопрос ниже).

```
printoffice.ru/
│
├── /catalog/                         # Каталог услуг
│   ├── /digital-printing/            # Цифровая печать
│   │   ├── /flyers/                  # Листовки
│   │   │   ├── /a4/                  # Листовки A4
│   │   │   ├── /a5/                  # Листовки A5
│   │   │   └── /custom/              # Свой размер
│   │   ├── /business-cards/          # Визитки
│   │   └── /posters/                 # Плакаты
│   │
│   ├── /offset-printing/             # Офсетная печать
│   │   ├── /flyers/                  # Листовки офсет
│   │   ├── /booklets/                # Буклеты
│   │   └── /brochures/               # Брошюры
│   │
│   ├── /wide-format/                 # Широкоформатная печать
│   │   ├── /pvc/                     # Печать на ПВХ
│   │   ├── /banner/                  # Баннеры
│   │   └── /self-adhesive/           # Самоклейка
│   │
│   ├── /brochures/                   # Брошюры
│   │   ├── /staple/                  # На скобе
│   │   ├── /spring/                  # На пружине
│   │   └── /kbs/                     # КБС
│   │
│   └── /stickers/                    # Наклейки
│       ├── /simple/                  # Простые
│       ├── /stickerpack/             # Стикерпаки
│       └── /shaped/                  # Фигурные
│
├── /calculator/                      # Универсальный калькулятор
│   ├── /digital/                     # Калькулятор цифровой печати
│   ├── /offset/                      # Калькулятор офсетной печати
│   ├── /wide/                        # Калькулятор широкоформата
│   ├── /brochure/                    # Калькулятор брошюр
│   └── /sticker/                     # Калькулятор наклеек
│
├── /services/                        # Услуги
│   ├── /copying/                     # Копирование
│   ├── /scanning/                    # Сканирование
│   ├── /lamination/                  # Ламинация
│   └── /binding/                     # Переплёт
│
├── /blog/                            # Блог (SEO-контент)
│   ├── /how-to-choose-paper/         # Как выбрать бумагу
│   ├── /printing-technologies/       # Технологии печати
│   └── /design-tips/                 # Советы по дизайну
│
├── /about/                           # О компании
│   ├── /contacts/                    # Контакты
│   ├── /delivery/                    # Доставка и оплата
│   └── /reviews/                     # Отзывы
│
└── /account/                         # Личный кабинет
    ├── /orders/                      # Мои заказы
    ├── /profile/                     # Профиль
    └── /briefs/                      # Мои брифы
```

---

## 3. Техническая архитектура движка

Многослойная архитектура: Frontend (Next.js) → API Layer (Next.js API Routes) → Backend (NestJS / сервисы) → Database (PostgreSQL + Prisma).

### Frontend (Next.js)

```
pages/
├── _app.tsx               # Корневой компонент, провайдеры
├── _document.tsx          # HTML-шаблон, мета-теги
├── index.tsx              # Главная страница
├── catalog/               # Каталог (динамические страницы)
├── calculator/            # Калькуляторы
├── account/               # Личный кабинет
└── api/                   # API-эндпоинты

components/
├── common/                # Общие компоненты (Header, Footer, Layout)
├── calculator/            # Компоненты калькуляторов
├── catalog/               # Компоненты каталога
├── account/               # Компоненты личного кабинета
└── seo/                   # SEO-компоненты (Meta, Schema.org)
```

### API Layer (Next.js API Routes)

```
pages/api/
├── auth/                  # Аутентификация (JWT, Telegram, email)
├── calculator/            # API калькуляторов
├── orders/                # API заказов
├── clients/               # API клиентов
├── production/            # API производства
└── admin/                 # API администрирования
```

### Backend (NestJS / Services)

```
modules/
├── calculator/            # Бизнес-логика калькуляторов
│   ├── digital/           # Цифровая печать
│   ├── offset/            # Офсетная печать
│   ├── wide/              # Широкоформат
│   ├── brochure/          # Брошюры
│   └── sticker/           # Наклейки
├── crm/                   # CRM
├── production/            # Производство
└── admin/                 # Администрирование
```

### Database (PostgreSQL + Prisma)

```
prisma/
├── schema.prisma          # Схема БД (все таблицы)
└── migrations/            # Миграции
```

⚠️ ОТКРЫТЫЙ ВОПРОС: на уровне диаграммы Backend заявлен на NestJS, при этом проектная настройка (раздел 4) поднимает API через Next.js API Routes без NestJS. Нужно зафиксировать единый стек бэкенда (Next.js API Routes vs. отдельный NestJS-сервис).

⚠️ ОТКРЫТЫЙ ВОПРОС: SQL-схемы витрины (раздел 6) написаны под MySQL (`AUTO_INCREMENT`, `ENUM`, `UNIQUE KEY`), а базовый стек проекта — PostgreSQL + Prisma. Требуется привести схему витрины к PostgreSQL/Prisma либо подтвердить выбор СУБД.

---

## 4. Настройка проекта Next.js + TypeScript + Tailwind

### 4.1. Инициализация

```bash
# Создание проекта Next.js с TypeScript и Tailwind
npx create-next-app@latest printoffice --typescript --tailwind --eslint
cd printoffice

# Установка дополнительных зависимостей
npm install @prisma/client @tanstack/react-query axios zod react-hook-form
npm install -D prisma @types/node

# Установка UI-компонентов (опционально)
npm install @headlessui/react @heroicons/react
```

### 4.2. Структура проекта

Полный листинг стартовой структуры каталогов Next.js-проекта приведён в [Структура проекта Next.js (детализированная, стартовая)](../10-tech/project-structure.md#структура-проекта-nextjs-детализированная-стартовая) (раздел документа «Структура проекта»). Там же — структура репозитория для GitHub по мере роста.

### 4.3. Ключевые версии зависимостей (package.json)

Полный `package.json` с версиями зависимостей приведён в разделе [Конфигурационные файлы → package.json](../10-tech/project-structure.md#packagejson) документа «Структура проекта». Ключевые ориентиры: Next.js `14.1.0`, React `^18.2.0`, Prisma/`@prisma/client` `^5.10.2`, `@tanstack/react-query` `^5.22.2`, `react-hook-form` `^7.51.0`, `zod` `^3.22.4`, TypeScript `^5.3.3`, Tailwind `^3.4.1`. Скрипт `postinstall: prisma generate` гарантирует генерацию Prisma-клиента после установки.

### 4.4. Конфигурация

Полные листинги конфигурационных файлов (`package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`) приведены в разделе [Конфигурационные файлы](../10-tech/project-structure.md#конфигурационные-файлы) документа «Структура проекта». Краткое содержание:

**tsconfig.json** — `target: ES2017`, `strict: true`, `moduleResolution: bundler`, алиас путей `"@/*": ["./src/*"]`.

**next.config.js** — `reactStrictMode: true`, `swcMinify: true`, оптимизация изображений (`formats: ['image/avif', 'image/webp']` — современные форматы для производительности), удаление `console` в production.

**tailwind.config.js** — кастомные палитры `primary` (синий, 50…900, основной `#0066ff`) и `secondary` (зелёный, основной `#22c55e`), шрифт `Inter`, центрированный контейнер с паддингом `1rem`.

**postcss.config.js** — плагины `tailwindcss` и `autoprefixer`.

### 4.5. Переменные окружения (.env.local)

Полный листинг `.env.local` приведён в разделе [Конфигурационные файлы → .env.local](../10-tech/project-structure.md#envlocal) документа «Структура проекта». Состав переменных: `DATABASE_URL` (PostgreSQL), `NEXT_PUBLIC_APP_URL`, `NODE_ENV`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN` (опционально).

### 4.6. Ключевые файлы

- **`src/pages/_app.tsx`** — оборачивает приложение в `QueryClientProvider` (react-query) и общий `Layout`.
- **`src/pages/_document.tsx`** — `<Html lang="ru">`, preconnect к Google Fonts, подключение шрифта `Inter`.
- **`src/components/layout/Layout.tsx`** — `min-h-screen flex flex-col` с `Header`, `main` и `Footer`.
- **`src/components/layout/Header.tsx`** — sticky-шапка с десктопной навигацией (Главная, Каталог, Калькулятор, Контакты) и мобильным бургер-меню (`md:hidden`).
- **`src/components/layout/Footer.tsx`** — копирайт с автоматическим годом.
- **`src/lib/prisma.ts`** — singleton `PrismaClient` через `globalThis` (защита от множественных подключений в dev).
- **`prisma/schema.prisma`** — provider `postgresql`, базовые модели `User` (role по умолчанию `client`) и `Format` (name/width/height).
- **`src/pages/api/health.ts`** — health-check эндпоинт, возвращает `{ status: 'ok', timestamp, environment }`.

### 4.7. Запуск проекта

```bash
npm install
npx prisma db push
npx prisma generate
npm run dev
# http://localhost:3000
```

---

## 5. SEO-фундамент

### 5.1. Чек-лист SEO-требований

**Технический SEO:**
- Динамическое формирование мета-тегов (title, description, keywords) для каждой страницы.
- ЧПУ-URL (человекопонятные ссылки) на русском/английском.
- Автоматическая генерация `sitemap.xml` (приоритеты, частота обновления).
- `robots.txt` (правила индексации, запреты).
- Canonical-ссылки (предотвращение дублей).
- `hreflang` (мультиязычность).
- Open Graph (`og:title`, `og:description`, `og:image`) и Twitter Cards.
- Структурированные данные Schema.org: `Product` (услуги), `LocalBusiness` (компания), `BreadcrumbList` (хлебные крошки), `Review` (отзывы), `FAQ` (вопросы-ответы).

**Производительность:**
- Core Web Vitals: LCP < 2.5 c, FID < 100 мс, CLS < 0.1.
- Ленивая загрузка изображений (`loading="lazy"`).
- Оптимизация изображений (WebP/AVIF, корректные размеры).
- Минификация CSS/JS, кэширование (браузерное, серверное), CDN для статики.

**Мобильная адаптация:**
- Responsive design (mobile-first).
- Мобильное бургер-меню.
- Touch-friendly элементы (кнопки не менее 44 px).
- Адаптивные калькуляторы.

**Контент:**
- Уникальные H1 для каждой страницы; правильная иерархия заголовков (H1 → H2 → H3).
- Alt-теги для изображений.
- Внутренняя перелинковка (связанные товары, статьи).
- Хлебные крошки (Breadcrumbs).

**Индексация:**

| Раздел | robots |
|---|---|
| Страницы каталога | index, follow |
| Корзина | noindex, nofollow |
| Личный кабинет | noindex, nofollow |
| Админка | noindex, nofollow + авторизация |

**Аналитика:** Яндекс.Метрика (цели, события), Google Analytics 4, верификация в Яндекс.Вебмастер и Google Search Console.

### 5.2. Структура SEO-модуля

```
src/
├── components/
│   └── seo/
│       ├── MetaTags.tsx          # Основной компонент мета-тегов
│       ├── SchemaMarkup.tsx      # Структурированные данные
│       ├── Breadcrumbs.tsx       # Хлебные крошки
│       └── index.ts              # Экспорт
├── lib/
│   └── seo/
│       ├── constants.ts          # SEO-константы (дефолты)
│       └── helpers.ts            # Вспомогательные функции
└── types/
    └── seo.ts                    # TypeScript-типы
```

### 5.3. Типы SEO (src/types/seo.ts)

```typescript
export interface SeoProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  noindex?: boolean;
  nofollow?: boolean;
  alternates?: { ru?: string; en?: string };
  breadcrumbs?: BreadcrumbItem[];
  product?: ProductSchema;
  organization?: OrganizationSchema;
}

export interface BreadcrumbItem { name: string; url: string; }

export interface ProductSchema {
  name: string;
  description: string;
  image?: string;
  price?: number;
  priceCurrency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  brand?: string;
  sku?: string;
}

export interface OrganizationSchema {
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
  email?: string;
  phone?: string;
  address?: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
}
```

### 5.4. Константы и данные организации (src/lib/seo/constants.ts)

| Поле | Значение |
|---|---|
| Title по умолчанию | Типография PrintOffice.Moscow |
| siteName | PrintOffice |
| twitterHandle | @printofficemoscow |
| locale | ru_RU |
| ogImage | /images/og-image.jpg |
| siteUrl | `process.env.NEXT_PUBLIC_APP_URL` или `https://printoffice.ru` |
| Email организации | zakaz@printoffice.moscow |
| Телефон | +7 (977) 366-44-01 |
| Адрес | ул. Орджоникидзе 11 стр 41, Москва, 115419, RU |
| sameAs | `https://t.me/printofficemoscow`, `https://vk.com/printoffice.moscow` |

Описание (description) по умолчанию: «Цифровая и офсетная, оперативная печать, широкоформатная. Расчёт стоимости онлайн. Быстрое изготовление и доставка по Москве.»
Keywords по умолчанию: печать, типография, листовки, визитки, брошюры, широкоформатная печать, офсетная печать, цифровая печать.

⚠️ ОТКРЫТЫЙ ВОПРОС: домен сайта указан неоднозначно — в SEO_DEFAULTS используется `https://printoffice.ru`, в helpers фолбэк `https://printoffice.moscow`, контактный email/Telegram/VK — на домене `printoffice.moscow`. Нужно зафиксировать основной домен и привести все ссылки/мета к нему.

### 5.5. Вспомогательные функции (src/lib/seo/helpers.ts)

- `formatPageTitle(title, includeSiteName=true)` — добавляет суффикс `| Типография PrintOffice`.
- `truncateDescription(description, maxLength=160)` — обрезает описание до 160 символов с многоточием.
- `getFullImageUrl(path)` — собирает абсолютный URL изображения (внешние URL не трогает).
- `getCurrentUrl(asPath)` — текущий URL без query-параметров.

### 5.6. Компонент MetaTags (src/components/seo/MetaTags.tsx)

Формирует полный набор мета-тегов: базовые (title, description, keywords, robots), canonical, hreflang (ru/en/x-default), Open Graph (`og:title/description/url/type/image/site_name/locale`), Twitter Cards (`summary_large_image`), технические (viewport, content-type, `format-detection: telephone=no`), favicon/apple-touch-icon/manifest, DNS-prefetch к шрифтам, а также вставляет `SchemaMarkup`.

Логика robots:

```javascript
const robots = [];
if (noindex) robots.push('noindex');
if (nofollow) robots.push('nofollow');
const robotsContent = robots.length > 0 ? robots.join(', ') : 'index, follow';
```

### 5.7. Компонент SchemaMarkup (Schema.org)

Генерирует массив JSON-LD блоков и рендерит их через `<script type="application/ld+json">`:

1. **Organization** — name, url, logo, email, telephone, sameAs, PostalAddress. При отсутствии данных подставляются дефолты из `SEO_DEFAULTS`.
2. **BreadcrumbList** — `itemListElement` из переданных хлебных крошек (position = index + 1).
3. **Product** — name, description, image, brand, sku и `Offer` (`price`, `priceCurrency` по умолчанию `RUB`, `availability` `https://schema.org/{InStock|OutOfStock|PreOrder}`).

### 5.8. Хлебные крошки (Breadcrumbs.tsx)

Компонент строит крошки либо из переданного массива `items`, либо автоматически из сегментов `router.asPath` (капитализация и замена дефисов на пробелы). Последний элемент — текущая страница (без ссылки), остальные — кликабельны.

### 5.9. Примеры использования MetaTags

| Страница | ogType | Особенности |
|---|---|---|
| Главная (`/`) | website | базовые мета без product |
| Листовки A5 (`/catalog/flyers/a5`) | product | breadcrumbs + ProductSchema (price 2500 ₽, sku FLYER-A5-100, бумага 130–300 г/м²) |
| Статья блога (`/blog/how-to-choose-paper`) | article | breadcrumbs без product |

### 5.10. Инструменты проверки SEO

- Мета-теги — инструменты разработчика (Elements → head).
- Open Graph — `https://developers.facebook.com/tools/debug/`.
- Twitter Cards — `https://cards-dev.twitter.com/validator`.
- Schema.org — `https://search.google.com/test/rich-results`.
- Яндекс.Вебмастер — `https://webmaster.yandex.ru/`.

---

## 6. Универсальная система витрины и кросс-продаж

Витрина — единый механизм для любых типов товаров, настраиваемый из админки без программиста.

### 6.1. Три типа взаимодействия с товарами

| Тип | Назначение | Примеры |
|---|---|---|
| **Тип 1: Варианты одного товара** (переключение) | Выбор разновидности внутри страницы | Брошюры: скоба / пружина / КБС; Буклеты: евро / гармошка / улитка; Наклейки: простые / стикерпак / фигурные; Визитки: одно-/двусторонние / с ламинацией |
| **Тип 2: Сопутствующие товары** (кросс-селлинг) | Дополняющие товары | Визитки → блокноты, ручки, конверты; Листовки → брошюры, плакаты; Наклейки → магниты, брелоки |
| **Тип 3: Популярные / рекомендуемые** (апселлинг) | Повышение чека | «Чаще всего заказывают вместе», персональные рекомендации по истории клиента, акционные товары |

### 6.2. Структура базы данных

> Примечание: схемы приведены в исходном синтаксисе (MySQL). См. открытый вопрос о приведении к PostgreSQL/Prisma в разделе 3.

```sql
-- Семейства товаров (группы вариантов)
CREATE TABLE product_families (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    description TEXT,
    display_type ENUM('tabs', 'icons', 'cards', 'buttons') DEFAULT 'icons',
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Варианты товаров в семействе
CREATE TABLE product_variants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    family_id INT NOT NULL,
    constructor_id INT NOT NULL,        -- ссылка на конструктор услуг
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    description TEXT,
    icon VARCHAR(255),                  -- путь к иконке
    preview_image VARCHAR(255),         -- превью-изображение
    badge VARCHAR(100),                 -- бейдж ("Популярный", "Эконом")
    is_default BOOLEAN DEFAULT false,   -- выбран по умолчанию
    is_recommended BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (family_id) REFERENCES product_families(id),
    FOREIGN KEY (constructor_id) REFERENCES service_constructors(id),
    INDEX idx_family (family_id)
);

-- Связи между товарами (кросс-селлинг / ап-селл / бандл)
CREATE TABLE product_relations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    source_constructor_id INT NOT NULL,         -- исходный товар
    target_constructor_id INT NOT NULL,         -- рекомендуемый товар
    relation_type ENUM('cross_sell', 'up_sell', 'bundle') DEFAULT 'cross_sell',
    title VARCHAR(255),                         -- "Часто заказывают вместе"
    description TEXT,
    discount_percent DECIMAL(5,2),              -- скидка при покупке вместе
    weight INT DEFAULT 100,                     -- вес рекомендации (выше = выше в списке)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_constructor_id) REFERENCES service_constructors(id),
    FOREIGN KEY (target_constructor_id) REFERENCES service_constructors(id),
    UNIQUE KEY unique_relation (source_constructor_id, target_constructor_id)
);

-- Статистика кросс-продаж (для автоматических рекомендаций)
CREATE TABLE cross_sell_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    source_constructor_id INT NOT NULL,
    target_constructor_id INT NOT NULL,
    view_count INT DEFAULT 0,                   -- показы
    click_count INT DEFAULT 0,                  -- клики
    conversion_count INT DEFAULT 0,             -- добавления в корзину
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_constructor_id) REFERENCES service_constructors(id),
    FOREIGN KEY (target_constructor_id) REFERENCES service_constructors(id),
    UNIQUE KEY unique_stat (source_constructor_id, target_constructor_id)
);

-- Блоки (виджеты) на странице
CREATE TABLE page_widgets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    widget_type ENUM('product_variants', 'cross_sell', 'upsell', 'popular') NOT NULL,
    title VARCHAR(255),
    settings JSON,                              -- настройки отображения
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (page_id) REFERENCES pages(id)
);
```

⚠️ ОТКРЫТЫЙ ВОПРОС: в исходнике DDL виджетов записан как `CREATE INTO page_widgets (...)` — синтаксическая ошибка; должно быть `CREATE TABLE page_widgets (...)` (исправлено в этом документе).

### 6.3. Примеры данных

```sql
-- Семейство "Брошюры" + варианты
INSERT INTO product_families (id, name, slug, display_type) VALUES
(1, 'Брошюры', 'brochures', 'icons');

INSERT INTO product_variants (family_id, constructor_id, name, slug, icon, is_default, sort_order) VALUES
(1, 101, 'На скобе',   'staple', '/icons/staple.svg', true,  10),
(1, 102, 'На пружине', 'spring', '/icons/spring.svg', false, 20),
(1, 103, 'КБС (клей)', 'kbs',    '/icons/kbs.svg',    false, 30);

-- Семейство "Буклеты" + варианты
INSERT INTO product_families (id, name, slug, display_type) VALUES
(2, 'Буклеты', 'booklets', 'cards');

INSERT INTO product_variants (family_id, constructor_id, name, slug, preview_image, is_default, sort_order) VALUES
(2, 201, 'Евробуклет',        'euro-booklet', '/images/euro-booklet.jpg', true,  10),
(2, 202, 'Гармошка 2 сгиба',  'accordion-2',  '/images/accordion-2.jpg',  false, 20),
(2, 203, 'Гармошка 3 сгиба',  'accordion-3',  '/images/accordion-3.jpg',  false, 30),
(2, 204, 'Улитка',            'snail',        '/images/snail.jpg',        false, 40);

-- Кросс-продажи для визиток (source 301)
INSERT INTO product_relations (source_constructor_id, target_constructor_id, relation_type, title, discount_percent, weight) VALUES
(301, 401, 'cross_sell', 'Часто заказывают вместе', 10, 100),  -- визитки + блокноты
(301, 402, 'cross_sell', 'Часто заказывают вместе', 15, 80),   -- визитки + ручки
(301, 403, 'cross_sell', 'Часто заказывают вместе',  5, 70);   -- визитки + конверты

-- Кросс/ап-продажи для листовок (source 101)
INSERT INTO product_relations (source_constructor_id, target_constructor_id, relation_type, title, discount_percent, weight) VALUES
(101, 201, 'up_sell',    'Перейти к брошюре',  0, 100),        -- листовки → брошюры
(101, 501, 'cross_sell', 'Добавить плакаты',  10,  80);        -- листовки + плакаты
```

### 6.4. Отображение вариантов на фронтенде

Способы отображения вариантов (задаются в `display_type` / настройках):

- **Иконки** — компактная сетка иконок с подписями (пример: брошюры). Поддерживает бейдж «Популярный».
- **Карточки** — крупные карточки с превью-макетом (пример: буклеты — евробуклет (1 сгиб), гармошка (2 сгиба), улитка (3 сгиба)).
- **Кнопки** — горизонтальный ряд кнопок (пример: наклейки — Простые / Стикерпак / Фигурные / Контурные).
- **Вкладки (tabs)** — табы с иконкой, названием и бейджем.

### 6.5. Блоки кросс-продаж на фронтенде

- **«Часто заказывают вместе»** (на странице товара) — карточки рекомендуемых товаров с ценой «от …», кнопкой «Добавить» и плашкой скидки при совместной покупке (например, «При покупке вместе скидка 10%»). Пример на странице визиток (односторонние, 500 шт — 1 500 руб): Блокноты A5 — от 250 руб (скидка 10%), Ручки — от 150 руб, Конверты C6 — от 100 руб.
- **«Вместе дешевле» (бандл)** — готовый комплект с суммарной ценой и экономией. Пример: Визитки (500 шт) + Блокноты A5 (10 шт) = 2 500 руб (экономия 250 руб), кнопка «Добавить комплект в корзину».
- **«Вам может понравиться» / «С этим также заказывают»** (в корзине) — карточки сопутствующих товаров: Брошюры A5 — от 3 000 руб, Плакаты A3 — от 1 500 руб, Наклейки — от 800 руб.

Сценарий кросс-продаж со страницы «Листовки» (`/catalog/flyers`): клиент выбрал формат A5, тираж 1000 шт, цена 2 500 руб. В блоке «Часто заказывают вместе» рекомендуются Визитки (от 1 500 ₽, скидка 10%), Блокноты A5 (от 250 ₽, скидка 15%), Ручки (от 150 ₽). Связи настраиваются один раз в разделе «Кросс-продажи» админки и работают на всех страницах, где есть калькулятор листовок.

Пример состояния корзины **без скидки** за комплект (промежуточная сумма):

```
ВАШ ЗАКАЗ:
• Листовки A5, 1000 шт — 2 500 руб
• Визитки, 500 шт — 1 500 руб
──────────────────────────────
ИТОГО: 4 000 руб
```

Пример отображения **скидки за комплект** в корзине (комплект «Листовки + Визитки», скидка -400 руб):

```
ВАШ ЗАКАЗ:
• Листовки A5, 1000 шт — 2 500 руб
• Визитки, 500 шт — 1 500 руб
──────────────────────────────
Скидка за комплект: -400 руб
──────────────────────────────
ИТОГО: 3 600 руб
```

### 6.6. API витрины и кросс-продаж

```javascript
// Варианты товара по семейству
router.get('/api/product/family/:familySlug', async (req, res) => {
    const { familySlug } = req.params;
    const family = await db.query(
        `SELECT * FROM product_families WHERE slug = $1 AND is_active = true`, [familySlug]);
    const variants = await db.query(`
        SELECT pv.*, sc.name as constructor_name
        FROM product_variants pv
        JOIN service_constructors sc ON sc.id = pv.constructor_id
        WHERE pv.family_id = $1 AND pv.is_active = true
        ORDER BY pv.sort_order`, [family.rows[0].id]);
    res.json({ family: family.rows[0], variants: variants.rows });
});

// Кросс-продажи по конструктору
router.get('/api/product/cross-sell/:constructorId', async (req, res) => {
    const { constructorId } = req.params;
    const relations = await db.query(`
        SELECT pr.*, sc.name, sc.slug, sc.default_price as price, sc.preview_image
        FROM product_relations pr
        JOIN service_constructors sc ON sc.id = pr.target_constructor_id
        WHERE pr.source_constructor_id = $1 AND pr.is_active = true AND sc.is_active = true
        ORDER BY pr.weight DESC
        LIMIT 6`, [constructorId]);
    res.json(relations.rows);
});

// Расчёт цены комплекта (бандла)
router.post('/api/bundle/price', async (req, res) => {
    const { items } = req.body; // [{constructorId, quantity, params}]
    let total = 0;
    const breakdown = [];
    for (const item of items) {
        const calculator = new UniversalCalculator();
        const result = await calculator.calculate(item.constructorId, item.params);
        total += result.total;
        breakdown.push({ constructorId: item.constructorId, price: result.total, quantity: item.quantity });
    }
    const bundleDiscount = await getBundleDiscount(items);
    const finalTotal = total * (1 - bundleDiscount / 100);
    res.json({ total: finalTotal, originalTotal: total, discount: bundleDiscount, breakdown });
});
```

Формула итоговой цены комплекта:

```
finalTotal = total * (1 - bundleDiscount / 100)
```

### 6.7. Эндпоинт рекомендаций с добором популярных

API `/api/product/recommendations/:constructorId` возвращает ручные связи `cross_sell` (сортировка по `weight DESC`, лимит 6). Если найдено менее 4 связей, недостающие позиции добираются популярными товарами:

```javascript
if (relations.rows.length < 4) {
    const popular = await getPopularProducts(constructorId, 6 - relations.rows.length);
    relations.rows.push(...popular);
}
```

### 6.8. Ключевые возможности витрины

| Функция | Описание |
|---|---|
| Семейства товаров | Группировка похожих товаров (брошюры, буклеты, наклейки) |
| Варианты отображения | Иконки, карточки, кнопки, табы — на выбор в админке |
| Кросс-продажи | Ручная настройка связей между товарами |
| Автоматические рекомендации | На основе статистики продаж |
| Комплекты со скидкой | Покупка нескольких товаров вместе |
| Гибкая настройка | Всё в админке без программиста |

---

## 7. Многоуровневая система отображения вариантов

Настройки отображения наследуются и переопределяются по уровням приоритета (низший → высший):

```
УРОВЕНЬ 1: ГЛОБАЛЬНЫЕ НАСТРОЙКИ (весь сайт)
        ↓
УРОВЕНЬ 2: НАСТРОЙКИ КАТЕГОРИИ (раздел "Брошюры", "Наклейки")
        ↓
УРОВЕНЬ 3: НАСТРОЙКИ СТРАНИЦЫ (конкретный URL)
        ↓
УРОВЕНЬ 4: ИСКЛЮЧЕНИЯ (скрыть конкретный вариант)
```

Логика разрешения: настройки страницы переопределяют настройки категории, а те — глобальные. Значения `0` / `NULL` / `'default'` означают «наследовать с верхнего уровня».

### 7.1. Структура БД (уровни настроек)

```sql
-- 1. Глобальные настройки отображения
CREATE TABLE display_settings_global (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSON NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO display_settings_global (setting_key, setting_value, description) VALUES
('default_variant_display', '{"type": "icons", "columns": 4, "show_badges": true}', 'Отображение вариантов по умолчанию'),
('cross_sell_display',      '{"type": "cards", "columns": 3, "show_discount": true}', 'Отображение кросс-продаж по умолчанию'),
('max_recommendations',     '{"value": 6}', 'Максимум рекомендаций на странице');

-- 2. Настройки категории
CREATE TABLE category_display_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT NOT NULL,
    variant_display_type ENUM('icons','cards','tabs','buttons','grid','list') DEFAULT 'icons',
    variant_columns INT DEFAULT 4,
    show_badges BOOLEAN DEFAULT true,
    show_prices BOOLEAN DEFAULT true,
    cross_sell_enabled BOOLEAN DEFAULT true,
    cross_sell_display_type ENUM('cards','list') DEFAULT 'cards',
    cross_sell_columns INT DEFAULT 3,
    sort_by ENUM('sort_order','price_asc','price_desc','popularity') DEFAULT 'sort_order',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    UNIQUE KEY unique_category (category_id)
);

-- 3. Настройки страницы (переопределяют категорию)
CREATE TABLE page_display_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    variant_display_type ENUM('icons','cards','tabs','buttons','grid','list','default') DEFAULT 'default',
    variant_columns INT DEFAULT 0,        -- 0 = из категории
    show_badges BOOLEAN DEFAULT NULL,     -- NULL = из категории
    show_prices BOOLEAN DEFAULT NULL,
    cross_sell_enabled BOOLEAN DEFAULT NULL,
    cross_sell_display_type ENUM('cards','list','default') DEFAULT 'default',
    cross_sell_columns INT DEFAULT 0,
    hidden_variants JSON,                 -- ID вариантов, которые скрыть
    visible_variants JSON,                -- если не пусто — показывать только их
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES pages(id),
    UNIQUE KEY unique_page (page_id)
);

-- 4. Индивидуальные настройки варианта
CREATE TABLE variant_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    variant_id INT NOT NULL,
    allow_hide BOOLEAN DEFAULT true,
    custom_icon VARCHAR(255),
    custom_preview VARCHAR(255),
    custom_badge VARCHAR(100),
    is_visible BOOLEAN DEFAULT true,      -- глобальная видимость варианта
    recommendation_weight INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);

-- 5. Статистика по вариантам (для автоматической сортировки)
CREATE TABLE variant_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    variant_id INT NOT NULL,
    view_count INT DEFAULT 0,
    click_count INT DEFAULT 0,
    order_count INT DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);
```

### 7.2. Логика разрешения настроек (API)

Класс `VariantDisplayManager` отвечает за выбор актуальных настроек и фильтрацию вариантов.

**`getDisplaySettings(pageId, categoryId)`** — приоритет: настройки страницы → настройки категории → глобальные дефолты.

**`getVariantsForPage(pageId, familyId)`** — алгоритм фильтрации:
1. Выбрать все активные варианты семейства (с подмешиванием `variant_settings`: `custom_visible`, `custom_icon`, `custom_badge`).
2. Применить настройки страницы:
   - если задан `visible_variants` (не пуст) — показывать **только** перечисленные;
   - если задан `hidden_variants` — **исключить** перечисленные.
3. Отфильтровать по глобальной видимости (`custom_visible !== false`).

```javascript
let variants = allVariants.rows;
if (pageSettings.rows.length > 0) {
    const { hidden_variants, visible_variants } = pageSettings.rows[0];
    if (visible_variants && visible_variants.length > 0) {
        variants = variants.filter(v => visible_variants.includes(v.id));
    }
    if (hidden_variants && hidden_variants.length > 0) {
        variants = variants.filter(v => !hidden_variants.includes(v.id));
    }
}
variants = variants.filter(v => v.custom_visible !== false);
```

**`getCrossSellForPage(pageId, constructorId)`** — если на странице `cross_sell_enabled === false`, вернуть пустой массив; иначе выбрать ручные связи `cross_sell` (по `weight DESC`, лимит 6) и при недоборе (<4) добавить популярные.

**`getPopularProducts(excludeConstructorId, limit)`** — выбор по статистике (`view_count`), исключая текущий конструктор и товары `type = 'complex'`.

### 7.3. Компоненты фронтенда

**`VariantSelector`** — универсальный селектор: загружает варианты (`/api/product/family/:familySlug`) и настройки отображения (`/api/display/settings?page=...`), затем рендерит по `variant_display_type`:
- `icons` → сетка `VariantIcon` с CSS `gridTemplateColumns: repeat(${columns}, 1fr)`;
- `cards` → сетка `VariantCard`;
- `tabs` → кнопки-табы с иконкой/названием/бейджем.

**`VariantIcon`** — иконка варианта с подписью; при `showBadge` показывает бейдж, при `showPrice` — цену «от {default_price} ₽»; класс `active` для выбранного.

### 7.4. Примеры сценариев настройки

**Сценарий 1 — Брошюры (иконки, все варианты):** категория «Брошюры», тип `icons`, 4 колонки, бейджи и цены включены, показываются все варианты (На скобе «Популярный» от 1000, Пружина от 1200, КБС от 1500, А5 от 800).

**Сценарий 2 — Буклеты (карточки, скрыть улитку):** страница `/catalog/booklets/accordion`, тип `cards`, 3 колонки, режим «показывать только выбранные»: евробуклет (от 500 ₽), гармошка 2 сгиба (от 700 ₽), гармошка 3 сгиба (от 900 ₽); улитка скрыта.

**Сценарий 3 — Наклейки (кнопки, скрыть ручную резку):** страница `/catalog/stickers/shaped`, тип `buttons`, режим «скрыть выбранные»: скрыта «ручная резка без насечек»; видимы Простые / Стикерпак / Фигурные / Контурные.

### 7.5. Массовые операции (SQL)

```sql
-- Скрыть все варианты определённого семейства
UPDATE product_variants SET is_active = false WHERE family_id IN (
    SELECT id FROM product_families WHERE name = 'Брошюры'
);

-- Применить настройки отображения ко всем страницам категории
UPDATE page_display_settings SET variant_display_type = 'cards', variant_columns = 4
WHERE page_id IN (SELECT id FROM pages WHERE category_id = 1);

-- Удалить все исключения для конкретной страницы
UPDATE page_display_settings SET hidden_variants = '[]', visible_variants = '[]'
WHERE page_id = 101;
```

---

## 8. Админка: настройка витрины

### 8.1. Меню админки (CMS)

| Раздел | Содержание |
|---|---|
| Дашборд | Статистика (заказы, прибыль, клиенты), уведомления, последние заказы |
| Калькуляторы | Цифровая печать, офсет (матрица цен, маржа), широкоформат (материалы, цены), брошюры (конструктор, блоки), наклейки (типы резки, материалы) |
| Заказы | Все / новые / в работе / завершённые / отменённые (списки, фильтры) |
| Клиенты | Список, B2C/B2B, сегменты (постоянные, новые, VIP) |
| Производство | Загрузка оборудования, ТЗ для участков, обратная связь, склад |
| Настройки | Конструкторы страниц, маржа и цены, формулы и правила, справочники (оборудование, материалы, форматы), пользователи (роли, права), SEO (мета-теги, sitemap) |

### 8.2. Семейства товаров

Раздел «Семейства товаров» отображает активные семейства с типом отображения (Иконки / Карточки / Кнопки / Вкладки) и числом вариантов. Действия: Редактировать, Клонировать, Отключить, Удалить.

**Редактирование варианта** содержит:
- Основные настройки: Название, Системный код (slug), Семейство, Конструктор (привязка к конструктору услуг), Описание.
- Визуальное представление: Иконка, Превью, Бейдж.
- Флаги: «Отображать по умолчанию», «Рекомендуемый», Порядок сортировки.
- Кнопки: Сохранить, Предпросмотр, Отмена.

### 8.3. Настройка кросс-продаж

Раздел «Кросс-продажи»: выбирается исходный товар, к нему добавляются целевые товары с параметрами: Тип (`cross_sell` / `up_sell` / `bundle`), Заголовок, Скидка %, Вес. Блок «Автоматические рекомендации» позволяет включить: рекомендации на основе статистики, популярные товары, акционные товары; и задать максимум рекомендаций (по умолчанию 4).

Пример настройки для визиток (ID 301):

| Целевой товар | Тип | Скидка | Вес |
|---|---|---|---|
| Блокноты A5 (401) | cross_sell | 10% | 100 |
| Ручки (402) | cross_sell | 15% | 80 |
| Конверты C6 (403) | cross_sell | 5% | 70 |

### 8.4. Настройки отображения по уровням (UI)

- **Глобальные настройки** — тип отображения вариантов (иконки/карточки/вкладки/кнопки/сетка), число колонок, показ бейджей/цен; для кросс-продаж — тип (карточки/список), колонки, показ скидки, максимум рекомендаций.
- **Настройки категории** — чекбокс «Использовать глобальные настройки» либо переопределение тех же параметров + сортировка вариантов (по порядку / цена ↑ / цена ↓ / популярность).
- **Настройки страницы** — переопределение отображения; блок «Видимые варианты» с режимами: «Показывать все активные» / «Показывать только выбранные» / «Скрыть выбранные»; блок «Исключения» (например, не показывать услугу «Ламинация» на странице брошюр на скобе, «Подложку» — только для пружины); блок «Кросс-продажи на этой странице» (выбор связанных товаров из `product_relations`).
- **Массовое управление вариантами** — действия для выбранных строк: скрыть/показать на всех страницах, установить порядок сортировки, применить настройки отображения; с фильтром по категории.

### 8.5. Инструкция администратору по кросс-продажам

1. Зайти в раздел «Кросс-продажи» админки.
2. Нажать «+ Добавить связь».
3. Выбрать исходную услугу (например, «Листовки»).
4. Выбрать целевую услугу (например, «Визитки»).
5. Указать скидку (например, 10%).
6. Сохранить.

После сохранения на странице исходной услуги автоматически появляется блок рекомендации.

Где какие настройки доступны:

| Где настраивается | Что можно настроить |
|---|---|
| Глобально | Тип отображения (карточки/иконки), количество колонок |
| Для категории | Переопределить глобальные настройки для всех страниц категории |
| Для конкретной страницы | Скрыть конкретные рекомендации, изменить порядок |
| Для конкретной связи | Заголовок, скидка, тип связи, вес/позиция, активность |

---

## 9. Привязка вариантов товара к страницам

Витрина связана с конструктором услуг: каждый `product_variant` ссылается на `constructor_id` (конструктор услуги). Это позволяет одной услуге («Визитки») выводиться как рекомендация на странице другой («Листовки») через таблицу `product_relations`, а одному семейству — отображаться на странице-обзоре в виде переключателя вариантов. Видимость вариантов на конкретном URL управляется через `page_display_settings` (`visible_variants` / `hidden_variants`) и индивидуальные `variant_settings`.

---

## Источник

Материал собран из следующих фрагментов папки `context/raw`:

- **`architecture.md`, строки 2868–2928** — архитектура движка сайта: roadmap (IA → техархитектура → SEO), URL-схема, техническая архитектура (Frontend/API/Backend/DB), SEO-чек-лист, модульная структура админки, базовый SEO-компонент, план старта.
- **`architecture.md`, строки 2929–3030** — настройка проекта Next.js + TypeScript + Tailwind: инициализация, структура, конфиги (package.json, tsconfig, next.config, tailwind, postcss, .env), ключевые файлы, запуск.
- **`architecture.md`, строки 3031–3127** — реализация SEO-компонента: типы, константы/хелперы, MetaTags, SchemaMarkup (Organization/BreadcrumbList/Product), Breadcrumbs, примеры использования, инструменты проверки, чек-лист готовности.
- **`crm-site-setup.md`, строки 1035–1182** — универсальная система витрины и кросс-продаж: семейства/варианты, связи (cross_sell/up_sell/bundle), статистика, виджеты; многоуровневая система отображения (глобально → категория → страница → исключения), API (VariantDisplayManager), компоненты фронтенда, сценарии, массовые операции.
- **`crm-site-setup.md`, строки 1213–1267** — кросс-продажи между разными услугами: где настраивать, структура связей, API рекомендаций, вид в CRM и на фронтенде, инструкция администратору, уровни доп. настроек.
- **`architecture.md`, строки 88–90** — пункты оглавления: универсальная система витрины и кросс-продаж, детальная настройка отображения вариантов и привязка к страницам.
