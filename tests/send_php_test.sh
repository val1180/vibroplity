#!/bin/bash
# Локальный тест public/send.php без сети: CRM и Telegram — заглушки на 127.0.0.1.
# Копия теста с trambovka. Есть PHP с curl — запускается им; нет — в Docker (php:8.3-cli).
# Запуск: ./tests/send_php_test.sh
set -euo pipefail
SITE="vibroplity"
cd "$(dirname "$0")/.."
if command -v php >/dev/null && php -m | grep -qi '^curl$'; then
  php -l public/send.php && php tests/send_php_test.php "$SITE"
else
  docker run --rm --network none -v "$PWD":/repo:ro -w /repo php:8.3-cli \
    sh -c 'php -l public/send.php && php tests/send_php_test.php "$0"' "$SITE"
fi
