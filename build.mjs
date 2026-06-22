// Генератор статической базы знаний PrintOffice.
// Вход: ./content/**.md (синхронизируется sync.mjs). Выход: ./docs/ (GitHub Pages).
// Самодостаточно: без рантайм-CDN. Только markdown-it на этапе сборки.
import MarkdownIt from 'markdown-it';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, GROUPS, flatPages } from './manifest.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, 'content');
const outDir = join(here, 'docs');
const assetsSrc = join(here, 'assets');

const pages = flatPages();
const includedSet = new Map(); // normalized src -> page
for (const p of pages) includedSet.set(p.src.replace(/\\/g, '/'), p);

// ---------- утилиты ----------
function slugify(s) {
  return String(s).trim().toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Убираем служебные/внутренние блоки для «чистого» клиентского вида.
function cleanMarkdown(src) {
  let t = src;
  // отрезаем секцию атрибуции «## Источник» до конца файла.
  // ВАЖНО: только заголовок, целиком равный «Источник» (не «Источники …»).
  t = t.replace(/\n#{1,6}[ \t]+Источник[ \t]*(?:\r?\n[\s\S]*)?$/u, '\n');
  // убираем строки-заметки аудита
  t = t.replace(/^>?\s*\*\*Правка аудита.*$/gmu, '');
  return t;
}

// Переписывание ссылок в markdown: внутренние .md → .html, мёртвые → текст.
function rewriteLinks(md, currentSrc) {
  const curDir = posix.dirname(currentSrc.replace(/\\/g, '/'));
  return md.replace(/(!?)\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, bang, text, target) => {
    if (bang) return m;                                   // изображения не трогаем
    if (/^(https?:|mailto:|tel:)/i.test(target)) return m; // внешние
    if (target.startsWith('#')) return m;                  // якорь внутри страницы
    if (/\.html(#|$)/i.test(target)) return m;             // уже готовая ссылка на страницу
    const [rawPath, hash] = target.split('#');
    if (!rawPath) return m;
    let norm = posix.normalize(posix.join(curDir, rawPath)).replace(/^\.\//, '');
    const hit = includedSet.get(norm);
    if (hit) {
      const h = hash ? '#' + slugify(decodeURIComponent(hash)) : '';
      return `[${text}](${hit.html}${h})`;
    }
    // ссылка на исключённый/несуществующий документ → разворачиваем в обычный текст
    return text;
  });
}

// markdown-it с id у заголовков и сбором оглавления.
function makeMd() {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });
  return md;
}

function renderArticle(md, rawSrc, currentSrc) {
  const cleaned = rewriteLinks(cleanMarkdown(rawSrc), currentSrc);
  const env = {};
  const tokens = md.parse(cleaned, env);
  const toc = [];
  const usedIds = new Map();
  const sections = [];     // для полнотекстового поиска по подзаголовкам
  let cur = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'heading_open') {
      const inline = tokens[i + 1];
      const text = inline && inline.content ? inline.content : '';
      let id = slugify(text) || 'section';
      const n = usedIds.get(id) || 0;
      usedIds.set(id, n + 1);
      if (n) id = `${id}-${n}`;
      t.attrSet('id', id);
      const level = Number(t.tag.slice(1));
      if (level === 2 || level === 3) toc.push({ level, id, text });
      cur = { anchor: id, heading: text, level, text: '' };
      sections.push(cur);
    } else if (t.type === 'inline' && cur && (i === 0 || tokens[i - 1].type !== 'heading_open')) {
      cur.text += ' ' + t.content;
    }
  }
  const title = sections.length ? sections[0].heading : '';
  const html = md.renderer.render(tokens, md.options, env);
  return { html, toc, title, sections };
}

// ---------- шаблон страницы ----------
const GROUP_ICONS = {
  'Обзор': '🧭',
  'Бизнес-процессы': '🔄',
  'CRM': '👥',
  'Сайт и клиент': '🌐',
  'Калькуляторы': '🧮',
  'Препресс': '📐',
  'Производство': '🏭',
  'Партнёры и доставка': '🚚',
  'Интеграции': '🔌',
  'Администрирование': '⚙️',
};

function sidebarHtml(activeSlug) {
  let s = '';
  for (const g of GROUPS) {
    const icon = GROUP_ICONS[g.title] || '';
    s += `<div class="nav-group"><div class="nav-group__title"><span class="gi" aria-hidden="true">${icon}</span><span>${esc(g.title)}</span></div><ul>`;
    for (const p of g.pages) {
      const slug = p.src.replace(/\.md$/, '').replace(/\//g, '--');
      const active = slug === activeSlug ? ' class="active"' : '';
      s += `<li${active}><a href="${slug}.html">${esc(p.label)}</a></li>`;
    }
    s += `</ul></div>`;
  }
  return s;
}

function tocHtml(toc) {
  if (!toc.length) return '';
  let s = '<nav class="toc"><div class="toc__title">На этой странице</div><ul>';
  for (const h of toc) s += `<li class="lvl${h.level}"><a href="#${h.id}">${esc(h.text)}</a></li>`;
  s += '</ul></nav>';
  return s;
}

function pageHtml({ bodyTitle, slug, contentHtml, toc, isHome }) {
  const tabTitle = bodyTitle ? `${bodyTitle} — ${SITE.title}` : `${SITE.title} — ${SITE.subtitle}`;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(tabTitle)}</title>
<link rel="preconnect" href="">
<link rel="stylesheet" href="assets/styles.css">
</head>
<body data-page="${esc(slug || 'index')}">
<header class="topbar"><div class="topbar__inner">
  <button class="burger" aria-label="Меню" onclick="document.body.classList.toggle('nav-open')">☰</button>
  <a class="brand" href="index.html"><span class="brand__name">${esc(SITE.title)}</span><span class="brand__sub">${esc(SITE.subtitle)}</span></a>
  <button class="search-trigger" id="searchBtn" type="button" aria-label="Поиск (Ctrl K)">
    <svg class="ico" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
    <span class="search-trigger__label">Поиск по базе знаний…</span>
    <span class="kbd"><kbd>Ctrl</kbd><kbd>K</kbd></span>
  </button>
</div></header>
<div class="layout">
  <aside class="sidebar">${sidebarHtml(slug)}</aside>
  <main class="content${isHome ? ' content--home' : ''}">
    <article class="md">${contentHtml}</article>
  </main>
  ${isHome ? '' : `<aside class="toc-col">${tocHtml(toc)}</aside>`}
</div>
<div class="scrim" onclick="document.body.classList.remove('nav-open')"></div>
<div class="cmdk" id="cmdk" hidden role="dialog" aria-modal="true" aria-label="Поиск по базе знаний">
  <div class="cmdk__backdrop" data-close></div>
  <div class="cmdk__panel" role="combobox" aria-expanded="true" aria-haspopup="listbox">
    <div class="cmdk__head">
      <svg class="ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>
      <input id="q" class="cmdk__input" type="text" placeholder="Поиск по разделам и подзаголовкам…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Поисковый запрос">
      <button class="cmdk__esc" type="button" data-close aria-label="Закрыть">esc</button>
    </div>
    <div id="results" class="cmdk__results" role="listbox"></div>
    <div class="cmdk__foot">
      <span class="cmdk__hintkey"><kbd>↑</kbd><kbd>↓</kbd> навигация</span>
      <span class="cmdk__hintkey"><kbd>↵</kbd> открыть</span>
      <span class="cmdk__hintkey"><kbd>esc</kbd> закрыть</span>
      <span class="cmdk__powered">поиск MiniSearch</span>
    </div>
  </div>
</div>
<script src="assets/minisearch.js" defer></script>
<script src="assets/search.js" defer></script>
</body>
</html>`;
}

// ---------- домашняя страница ----------
function homeIntroMarkdown() {
  return `# PrintOffice — система управления типографией

Структурированное описание проекта **PrintOffice** — системы управления типографией полного цикла: сайт с калькуляторами + CRM + производство + интеграции.

Исходные материалы — большой массив разрозненных диалогов и заметок — переработаны, очищены от черновиков и дублей и приведены к единой навигируемой структуре. Слева — оглавление по разделам; ниже — быстрый переход. Вверху работает поиск (Ctrl K).

## Разделы
`;
}

function homeCardsHtml() {
  let cards = '';
  for (const g of GROUPS) {
    const first = g.pages[0];
    const slug = first.src.replace(/\.md$/, '').replace(/\//g, '--');
    const icon = GROUP_ICONS[g.title] || '';
    const items = g.pages.map(p => esc(p.label)).join(' · ');
    cards += `<a class="home-card" href="${slug}.html">
      <span class="home-card__icon" aria-hidden="true">${icon}</span>
      <span class="home-card__title">${esc(g.title)}</span>
      <span class="home-card__pages">${items}</span>
    </a>`;
  }
  return `<div class="home-cards">${cards}</div>`;
}

function homeNoteHtml() {
  return `<p class="home-note">Это рабочая база знаний по проекту. Технические черновики и внутренние материалы из неё исключены — оставлено только содержательное описание продукта и процессов.</p>`;
}

// ---------- сборка ----------
function build() {
  if (!existsSync(contentDir)) { console.error('Нет ./content — сначала запустите: npm run sync'); process.exit(1); }
  // Чистим содержимое docs, не удаляя сам каталог (он может быть заблокирован IDE/индексатором на Windows).
  if (existsSync(outDir)) {
    for (const entry of readdirSync(outDir)) {
      try { rmSync(join(outDir, entry), { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }); }
      catch (e) { console.warn('не удалось очистить', entry, '-', e.code); }
    }
  }
  mkdirSync(join(outDir, 'assets'), { recursive: true });

  const md = makeMd();
  const records = [];

  // контентные страницы + индекс по разделам
  for (const p of pages) {
    const srcFile = join(contentDir, p.src);
    if (!existsSync(srcFile)) { console.warn('пропуск (нет файла):', p.src); continue; }
    const raw = readFileSync(srcFile, 'utf8');
    const { html, toc, title, sections } = renderArticle(md, raw, p.src);
    const out = pageHtml({ bodyTitle: title || p.label, slug: p.slug, contentHtml: html, toc, isHome: false });
    writeFileSync(join(outDir, p.html), out, 'utf8');
    for (const s of sections) {
      const text = s.text.replace(/\s+/g, ' ').trim();
      if (s.level > 1 && !text && !s.heading) continue;
      records.push({
        id: p.slug + '#' + s.anchor,
        url: s.level === 1 ? p.html : `${p.html}#${s.anchor}`,
        group: p.group,
        page: p.label,
        heading: s.level === 1 ? p.label : s.heading,
        level: s.level,
        text: text.slice(0, 1500),
      });
    }
  }

  // домашняя
  const homeIntro = renderArticle(md, homeIntroMarkdown(), 'index.md');
  const homeContent = homeIntro.html + homeCardsHtml() + homeNoteHtml();
  writeFileSync(join(outDir, 'index.html'), pageHtml({ bodyTitle: '', slug: '', contentHtml: homeContent, toc: [], isHome: true }), 'utf8');

  // ассеты
  cpSync(join(assetsSrc, 'styles.css'), join(outDir, 'assets', 'styles.css'));
  cpSync(join(assetsSrc, 'search.js'), join(outDir, 'assets', 'search.js'));
  cpSync(join(here, 'node_modules', 'minisearch', 'dist', 'umd', 'index.js'), join(outDir, 'assets', 'minisearch.js'));
  writeFileSync(join(outDir, 'search-index.json'), JSON.stringify(records), 'utf8');
  writeFileSync(join(outDir, '.nojekyll'), '');

  console.log(`Готово: ${pages.length} страниц + домашняя, ${records.length} разделов в индексе → docs`);
}

build();
