import { defineConfig } from 'astro/config';

// Статика: каждая страница — отдельный .html в dist/ (как у остальных микросайтов:
// nginx на sites-legacy отдаёт файлы, ссылки вида /legkie-vibroplity.html).
export default defineConfig({
  site: 'https://vibroplity.by',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', assets: 'assets' },
  compressHTML: true,
});
