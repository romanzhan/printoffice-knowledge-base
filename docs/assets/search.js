// Поиск по базе знаний: MiniSearch (полнотекст, префикс+опечатки, ранжирование)
// + UI «командной палитры». Подсветка активного пункта оглавления (scrollspy).
(function () {
  const cmdk = document.getElementById('cmdk');
  const input = document.getElementById('q');
  const results = document.getElementById('results');
  const btn = document.getElementById('searchBtn');
  if (!cmdk || !input || !results) return;

  let mini = null, records = [], loaded = false, cur = [], sel = -1;

  async function load() {
    if (loaded) return;
    loaded = true;
    try {
      const r = await fetch('search-index.json');
      records = await r.json();
      mini = new MiniSearch({
        fields: ['heading', 'page', 'group', 'text'],
        storeFields: ['url', 'group', 'page', 'heading', 'level', 'text'],
        searchOptions: { boost: { heading: 4, page: 3, group: 1.5, text: 1 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
      });
      mini.addAll(records);
    } catch (e) { records = []; }
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function highlight(text, terms) {
    let s = esc(text);
    const uniq = [...new Set((terms || []).filter(Boolean))].sort((a, b) => b.length - a.length);
    for (const t of uniq) {
      const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      s = s.replace(re, '<mark>$1</mark>');
    }
    return s;
  }

  function snippet(text, terms) {
    if (!text) return '';
    const low = text.toLowerCase();
    let pos = -1;
    for (const t of (terms || [])) { const i = low.indexOf(t.toLowerCase()); if (i >= 0 && (pos < 0 || i < pos)) pos = i; }
    if (pos < 0) pos = 0;
    const start = Math.max(0, pos - 50);
    let s = text.slice(start, start + 200).trim();
    if (start > 0) s = '… ' + s;
    if (start + 200 < text.length) s += ' …';
    return highlight(s, terms);
  }

  function emptyState() {
    const pages = records.filter(r => r.level === 1).slice(0, 8);
    return `<div class="cmdk__hint">Введите запрос — ищем по всем разделам и подзаголовкам. Поддерживаются части слов и опечатки.</div>
      <div class="cmdk__quick-title">Быстрый переход</div>
      <div class="cmdk__quick">${pages.map(p =>
        `<a class="cmdk__qitem" href="${p.url}" data-go><span class="r-bc">${esc(p.group)}</span><span class="r-title">${esc(p.heading)}</span></a>`).join('')}</div>`;
  }

  function render() {
    const q = input.value.trim();
    if (!q) { results.innerHTML = emptyState(); sel = -1; bind(); return; }
    if (!cur.length) {
      results.innerHTML = `<div class="cmdk__empty"><div class="cmdk__empty-ico">🔍</div>Ничего не найдено по запросу «${esc(q)}»</div>`;
      return;
    }
    results.innerHTML = cur.map((r, i) =>
      `<a class="cmdk__item${i === sel ? ' sel' : ''}" href="${r.url}" data-go data-i="${i}" role="option" aria-selected="${i === sel}">
        <div class="r-bc">${esc(r.group)} <span class="sep">›</span> ${esc(r.page)}</div>
        <div class="r-title">${highlight(r.heading, r._terms)}</div>
        ${r.text ? `<div class="r-snip">${snippet(r.text, r._terms)}</div>` : ''}
      </a>`).join('');
    bind();
  }

  function bind() {
    results.querySelectorAll('[data-go]').forEach(a => {
      a.addEventListener('mousemove', () => { const i = a.dataset.i; if (i != null && +i !== sel) { sel = +i; markSel(); } });
      a.addEventListener('click', () => { setTimeout(close, 0); });
    });
  }

  function markSel() {
    const items = results.querySelectorAll('.cmdk__item');
    items.forEach((el, i) => { el.classList.toggle('sel', i === sel); el.setAttribute('aria-selected', i === sel); });
    const el = items[sel];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  async function run() {
    await load();
    const q = input.value.trim();
    if (!q) { cur = []; render(); return; }
    let res = mini ? mini.search(q) : [];
    if (!res.length && mini) res = mini.search(q, { combineWith: 'OR' }); // мягкий фолбэк
    cur = res.slice(0, 24).map(r => ({ ...r, _terms: r.terms }));
    sel = cur.length ? 0 : -1;
    render(); markSel();
  }

  function open() {
    load();
    cmdk.hidden = false;
    document.body.classList.add('cmdk-open');
    requestAnimationFrame(() => { cmdk.classList.add('show'); input.focus(); input.select(); });
    if (!input.value) render();
  }
  function close() {
    cmdk.classList.remove('show');
    document.body.classList.remove('cmdk-open');
    setTimeout(() => { cmdk.hidden = true; }, 160);
  }

  if (btn) btn.addEventListener('click', open);
  cmdk.addEventListener('mousedown', e => { if (e.target.hasAttribute('data-close')) { e.preventDefault(); close(); } });
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (cur.length) { sel = Math.min(sel + 1, cur.length - 1); markSel(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (cur.length) { sel = Math.max(sel - 1, 0); markSel(); } }
    else if (e.key === 'Enter') { e.preventDefault(); const r = cur[sel] || cur[0]; if (r) { location.href = r.url; close(); } }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  // Горячие клавиши по e.code (физическая клавиша) — работают при любой раскладке (в т.ч. кириллице)
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') { e.preventDefault(); cmdk.hidden ? open() : close(); }
    else if (e.code === 'Slash' && !e.ctrlKey && !e.metaKey && !e.altKey && cmdk.hidden
             && !/^(input|textarea|select)$/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
  });

  // Подсветка активного пункта правого оглавления при прокрутке
  const tocLinks = Array.from(document.querySelectorAll('.toc a'));
  if (tocLinks.length) {
    const map = new Map();
    tocLinks.forEach(a => { const el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); if (el) map.set(el, a); });
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { tocLinks.forEach(a => a.classList.remove('active')); const a = map.get(en.target); if (a) a.classList.add('active'); }
      });
    }, { rootMargin: '-64px 0px -70% 0px', threshold: 0 });
    map.forEach((_, el) => obs.observe(el));
  }
})();
