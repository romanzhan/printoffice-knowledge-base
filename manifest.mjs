// Манифест базы знаний PrintOffice.
// Только «чистые» бизнес-документы. Черновики (raw/), технические (10-tech/)
// и внутренние материалы (audit/SSOT/ADR/decisions/roadmap/questions/brief) исключены.
// Порядок и названия разделов — как увидит клиент в оглавлении.

export const SITE = {
  title: 'PrintOffice',
  subtitle: 'Система управления типографией',
  // Домен указывается в CNAME; здесь — только для подписи.
};

// Группы → страницы. `src` — путь относительно корня проекта (context/).
export const GROUPS = [
  {
    title: 'Обзор',
    pages: [
      { src: '00-overview.md', label: 'О продукте' },
    ],
  },
  {
    title: 'Бизнес-процессы',
    pages: [
      { src: '01-business-processes.md', label: 'Путь клиента (Event Map)' },
    ],
  },
  {
    title: 'CRM',
    pages: [
      { src: '02-crm/crm-overview.md', label: 'Обзор CRM' },
      { src: '02-crm/orders.md', label: 'Заказы' },
      { src: '02-crm/clients.md', label: 'Клиенты' },
      { src: '02-crm/communications.md', label: 'Коммуникации' },
      { src: '02-crm/roles-permissions.md', label: 'Роли и права' },
      { src: '02-crm/automations.md', label: 'Автоматизации' },
    ],
  },
  {
    title: 'Сайт и клиент',
    pages: [
      { src: '03-site-client/site-structure.md', label: 'Структура сайта' },
      { src: '03-site-client/homepage-ux.md', label: 'Главная и UX' },
      { src: '03-site-client/client-cabinet.md', label: 'Кабинет клиента' },
      { src: '03-site-client/brief-constructor.md', label: 'Конструктор брифов' },
    ],
  },
  {
    title: 'Калькуляторы',
    pages: [
      { src: '04-calculators/pricing-model.md', label: 'Модель цены и маржи' },
      { src: '04-calculators/digital-print.md', label: 'Цифровая печать' },
      { src: '04-calculators/offset.md', label: 'Офсетная печать' },
      { src: '04-calculators/wideformat.md', label: 'Широкоформат' },
      { src: '04-calculators/brochures.md', label: 'Брошюры' },
      { src: '04-calculators/stickers.md', label: 'Наклейки' },
      { src: '04-calculators/imposition-bleeds.md', label: 'Раскладка и вылеты' },
      { src: '04-calculators/cutting-lamination-services.md', label: 'Резка, ламинация, услуги' },
    ],
  },
  {
    title: 'Препресс',
    pages: [
      { src: '05-prepress/preflight.md', label: 'Проверка макета' },
      { src: '05-prepress/preview-markup.md', label: 'Превью с метками' },
      { src: '05-prepress/file-management.md', label: 'Управление файлами' },
    ],
  },
  {
    title: 'Производство',
    pages: [
      { src: '06-production/production-module.md', label: 'Производственный модуль' },
      { src: '06-production/equipment.md', label: 'Оборудование и нормативы' },
    ],
  },
  {
    title: 'Партнёры и доставка',
    pages: [
      { src: '07-partners-delivery/vendor-engine.md', label: 'Подбор подрядчика' },
      { src: '07-partners-delivery/partners.md', label: 'Партнёры' },
      { src: '07-partners-delivery/delivery.md', label: 'Доставка' },
    ],
  },
  {
    title: 'Интеграции',
    pages: [
      { src: '08-integrations.md', label: 'Интеграции' },
    ],
  },
  {
    title: 'Администрирование',
    pages: [
      { src: '09-admin-interface/admin-overview.md', label: 'Обзор админки' },
      { src: '09-admin-interface/constructors.md', label: 'Конструкторы' },
      { src: '09-admin-interface/crm-interface-prototype.md', label: 'Прототип интерфейса CRM' },
    ],
  },
];

// Плоский список + производные поля (slug, имя файла .html).
export function flatPages() {
  const out = [];
  for (const g of GROUPS) {
    for (const p of g.pages) {
      const slug = p.src.replace(/\.md$/, '').replace(/\//g, '--');
      out.push({ ...p, group: g.title, slug, html: slug + '.html' });
    }
  }
  return out;
}
