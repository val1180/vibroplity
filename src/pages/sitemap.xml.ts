import { SITE } from '../data/site';
import { TASK_PAGES, CLASS_PAGES } from '../data/pages';

// Карта сайта вручную: адреса с .html, как их отдаёт nginx (build.format: 'file').
const pages = [
  { loc: '/', priority: '1.0' },
  ...TASK_PAGES.map((t) => ({ loc: `/${t.slug}.html`, priority: '0.9' })),
  ...CLASS_PAGES.map((t) => ({ loc: `/${t.slug}.html`, priority: '0.8' })),
  { loc: '/kontakty.html', priority: '0.6' },
  { loc: '/privacy.html', priority: '0.2' },
];

export function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${SITE.url}${p.loc}</loc><lastmod>${today}</lastmod><priority>${p.priority}</priority></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
