#!/bin/bash
# Деплой vibroplity.by на наш сервер sites-legacy (185.251.38.105) — как у остальных микросайтов.
# Заливает исходники в /srv/sites/vibroplity/src и запускает сборку на сервере (Docker node).
# ВНИМАНИЕ: сайт на Astro — сборке нужен Node ≥ 22.12 (см. CLAUDE.md, «Запуск на сервере»).
set -euo pipefail
cd "$(dirname "$0")"
rsync -az --delete --exclude node_modules --exclude dist --exclude .astro --exclude .git --exclude .env \
  --exclude .DS_Store --exclude .claude --exclude public/tg_config.php ./ root@185.251.38.105:/srv/sites/vibroplity/src/
ssh root@185.251.38.105 /srv/sites/build.sh vibroplity
curl -s -o /dev/null -w "https://vibroplity.by/ → %{http_code}\n" https://vibroplity.by/
