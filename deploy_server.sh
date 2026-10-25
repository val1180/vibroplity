#!/bin/bash
# Деплой vibroplity.by на сервер CRM (93.125.18.77) — НЕ на sites-legacy: отдельный IP от trambovka.by
# (владелец 25.10). Сборка локально в Docker (Node 22, Astro), на сервер — только dist.
# На сервере сайт лежит в /srv/static/vibroplity/site; tg_config.php там свой — не стирать.
set -euo pipefail
cd "$(dirname "$0")"
docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -c "npm ci --silent && npm run build"
rsync -rltz --chmod=D755,F644 --delete --exclude tg_config.php --exclude crm_leads.log dist/ root@93.125.18.77:/srv/static/vibroplity/site/
curl -s -o /dev/null -w "https://vibroplity.by/ → %{http_code}\n" https://vibroplity.by/
