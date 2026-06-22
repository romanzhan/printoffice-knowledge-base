// Копирует «чистые» исходные .md из корня проекта (../) в ./content/,
// чтобы репозиторий веб-сервиса был самодостаточным (для GitHub Actions/Pages).
import { flatPages } from './manifest.mjs';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');           // context/
const contentDir = join(here, 'content');

let ok = 0, miss = 0, local = 0;
for (const p of flatPages()) {
  if (p.local) { local++; continue; } // авторская страница в content/ — не синхронизируется из исходников
  const from = join(root, p.src);
  const to = join(contentDir, p.src);
  if (!existsSync(from)) { console.warn('НЕТ ИСХОДНИКА:', p.src); miss++; continue; }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  ok++;
}
console.log(`Синхронизировано: ${ok}, авторских (пропущено): ${local}, отсутствует: ${miss}`);
if (miss) process.exit(1);
