<?php
/**
 * Telegram lead proxy.
 * Keeps the bot token on the SERVER — it must never appear in client-side JS.
 * The frontend POSTs { "text": "<message>" } here; this script relays it to
 * the personal chat (plain) and the "Лиды" group (with a "Беру" button),
 * exactly as the old in-browser code did.
 *
 * ⚠️ Token + chat ids live in the gitignored tg_config.php (not committed).
 * After rotating in @BotFather, update tg_config.php on each site.
 */
header('Content-Type: application/json; charset=utf-8');

// Secrets loaded from gitignored tg_config.php (never committed, never client-exposed).
$__cfgFile    = __DIR__ . '/tg_config.php';
$__cfg        = is_file($__cfgFile) ? (require $__cfgFile) : [];
$TG_BOT_TOKEN = $__cfg['token'] ?? '';
$TG_CHAT_ID   = $__cfg['chat']  ?? '';
$TG_GROUP_ID  = $__cfg['group'] ?? '';
// Адрес Bot API: переопределяется только локальным тестом (tests/send_php_test.sh).
$TG_API       = rtrim((string) ($__cfg['tg_api'] ?? 'https://api.telegram.org'), '/');

// ===== crm-lead v1 — общий блок микросайтов (копия одна и та же во всех send.php) =====
// Заявка сначала уходит в CRM (POST /api/site-leads/<секрет>). CRM сохранила
// лид (200 + lead_id) — в группу «Лиды» сайт сам не шлёт, это сделает CRM.
// Любой сбой (нет адреса, 403/422, 429/5xx, таймаут) — прежняя отправка в
// Telegram, заявка не теряется. Адрес с секретом — в tg_config.php:
// 'crm_leads_url' => 'https://crm.stroyrent.by/api/site-leads/<SECRET>'
// (или define('CRM_LEADS_URL', '...')). Нет адреса — сайт работает по-старому.

/** Адрес приёма заявок CRM из tg_config.php ('' — CRM не подключена). */
function crm_lead_url(array $cfg): string
{
    if (defined('CRM_LEADS_URL')) {
        return trim((string) constant('CRM_LEADS_URL'));
    }
    return trim((string) ($cfg['crm_leads_url'] ?? ''));
}

/** Адрес посетителя. nginx на sites-legacy отдаёт PHP напрямую, поэтому
 *  REMOTE_ADDR — и есть посетитель; заголовкам прокси верим, только если
 *  запрос пришёл с локального/частного адреса (стоит прокси перед PHP). */
function crm_lead_client_ip(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    if ($ip === '' || !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        foreach (['HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR'] as $header) {
            $candidate = trim(explode(',', (string) ($_SERVER[$header] ?? ''))[0]);
            if (filter_var($candidate, FILTER_VALIDATE_IP)) {
                return $candidate;
            }
        }
    }
    return $ip;
}

/** Страница отправки и utm-метки из Referer (fetch со своей страницы шлёт полный адрес). */
function crm_lead_page_fields(): array
{
    $fields = [];
    $ref = (string) ($_SERVER['HTTP_REFERER'] ?? '');
    if ($ref === '' || !preg_match('~^https?://~i', $ref)) {
        return $fields;
    }
    $fields['page'] = mb_substr($ref, 0, 500);
    parse_str((string) parse_url($ref, PHP_URL_QUERY), $query);
    foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $key) {
        if (isset($query[$key]) && is_string($query[$key]) && $query[$key] !== '') {
            $fields[$key] = mb_substr($query[$key], 0, 200);
        }
    }
    return $fields;
}

/** Журнал сайта: error_log PHP-FPM + файл рядом с веб-корнем (секрет не пишем). */
function crm_lead_log(string $site, string $message): void
{
    $line = '[' . date('c') . "] [crm-leads {$site}] {$message}";
    error_log($line);
    @file_put_contents(dirname(__DIR__) . '/crm_leads.log', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
}

/**
 * POST заявки в CRM. Таймаут 3 с, соединение ≤ 1,5 с.
 * status: off — адрес не задан; accepted — лид сохранён (есть lead_id);
 * honeypot — 200 ok без lead_id; config_error — 403/422; unavailable — всё прочее.
 */
function crm_lead_send(string $url, array $payload): array
{
    $result = ['status' => 'off', 'code' => 0, 'lead_id' => null, 'error' => ''];
    if ($url === '' || !function_exists('curl_init')) {
        return $result;
    }
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER    => true,
        CURLOPT_POST              => true,
        CURLOPT_HTTPHEADER        => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_POSTFIELDS        => $json === false ? '{}' : $json,
        CURLOPT_CONNECTTIMEOUT_MS => 1500,
        CURLOPT_TIMEOUT_MS        => 3000,
        CURLOPT_NOSIGNAL          => true,
        CURLOPT_FOLLOWLOCATION    => false,
    ]);
    $body = curl_exec($ch);
    $result['code'] = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($body === false) {
        $result['error'] = curl_error($ch);
    }
    unset($ch);

    $answer = is_string($body) ? json_decode($body, true) : null;
    if ($body === false) {
        $result['status'] = 'unavailable';
    } elseif ($result['code'] === 200 && is_array($answer) && ($answer['ok'] ?? false) === true) {
        if (isset($answer['lead_id']) && $answer['lead_id'] !== null && $answer['lead_id'] !== '') {
            $result['status']  = 'accepted';
            $result['lead_id'] = $answer['lead_id'];
        } else {
            $result['status'] = 'honeypot';
        }
    } elseif ($result['code'] === 403 || $result['code'] === 422) {
        $result['status'] = 'config_error';
        $result['error']  = mb_substr(is_string($body) ? $body : '', 0, 300);
    } else {
        $result['status'] = 'unavailable';
        $result['error']  = mb_substr(is_string($body) ? $body : '', 0, 120);
    }
    return $result;
}

/**
 * Заявка в CRM. true — CRM приняла лид и сама пришлёт его в группу «Лиды»;
 * false — отправлять в Telegram по-старому (сбои пишутся в журнал сайта).
 */
function crm_lead_deliver(string $site, array $cfg, string $text, array $extra = []): bool
{
    $payload = ['site' => $site, 'text' => $text, 'hp' => '', 'client_ip' => crm_lead_client_ip()]
        + crm_lead_page_fields();
    foreach ($extra as $key => $value) {
        if (is_scalar($value) && (string) $value !== '') {
            $payload[$key] = mb_substr((string) $value, 0, 2000);
        }
    }
    $crm = crm_lead_send(crm_lead_url($cfg), $payload);
    switch ($crm['status']) {
        case 'accepted':
            return true;
        case 'off':
            return false;
        case 'honeypot':
            crm_lead_log($site, 'CRM ответила ok без lead_id на заявку без ловушки — шлём в Telegram');
            return false;
        case 'config_error':
            crm_lead_log($site, "ошибка настройки CRM: HTTP {$crm['code']} {$crm['error']} — шлём в Telegram");
            return false;
        default:
            crm_lead_log($site, "CRM недоступна: HTTP {$crm['code']} {$crm['error']} — шлём в Telegram");
            return false;
    }
}

/** Ловушка сработала: передаём в CRM для учёта спама (если подключена), в Telegram не шлём. */
function crm_lead_honeypot(string $site, array $cfg, string $text, string $hp): void
{
    if ($text === '' || mb_strlen($text) > 4000) {
        return;
    }
    crm_lead_send(crm_lead_url($cfg), ['site' => $site, 'text' => $text, 'hp' => mb_substr($hp, 0, 200),
        'client_ip' => crm_lead_client_ip()] + crm_lead_page_fields());
}
// ===== /crm-lead v1 =====

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false]);
    exit;
}

// Only accept requests originating from our own pages.
$__origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
if ($__origin !== '' && !preg_match('~^https?://(www\.)?vibroplity\.by(/|$)~', $__origin)) {
    http_response_code(403);
    echo json_encode(['ok' => false]);
    exit;
}

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

// Only our JS sends JSON with an "hp" key — reject anything else (curl, form posts).
if (!is_array($data) || !array_key_exists('hp', $data)) {
    http_response_code(400);
    echo json_encode(['ok' => false]);
    exit;
}

$text = trim((string) ($data['text'] ?? ''));

// Honeypot: bots fill the hidden "website" field — pretend success, send nothing.
if (trim((string) $data['hp']) !== '') {
    crm_lead_honeypot('vibroplity', $__cfg, $text, trim((string) $data['hp']));
    echo json_encode(['ok' => true]);
    exit;
}

// Reject empty / oversized payloads (Telegram caps messages at 4096 chars).
if ($text === '' || mb_strlen($text) > 4000) {
    http_response_code(400);
    echo json_encode(['ok' => false]);
    exit;
}

// Rate limit: max 5 leads per 10 minutes per IP (file-based, no extensions needed).
$__ip   = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$__rlFile = sys_get_temp_dir() . '/tg_rl_' . md5('vibroplity' . $__ip);
$__now  = time();
$__hits = [];
if (is_file($__rlFile)) {
    $__hits = array_filter(
        array_map('intval', file($__rlFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []),
        function ($t) use ($__now) { return $__now - $t < 600; }
    );
}
if (count($__hits) >= 5) {
    http_response_code(429);
    echo json_encode(['ok' => false]);
    exit;
}
$__hits[] = $__now;
@file_put_contents($__rlFile, implode("\n", $__hits), LOCK_EX);

function tg_send($token, array $payload) {
    global $TG_API;
    $ch = curl_init("{$TG_API}/bot{$token}/sendMessage");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_TIMEOUT        => 15,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code === 200;
}

$leadId = base_convert((string) time(), 10, 36) . substr(md5((string) mt_rand()), 0, 4);
// Сначала CRM: лид сохранён — в группу «Лиды» сайт не шлёт (CRM пришлёт сама).
// Не настроена / ошибка / недоступна — группа по-старому, заявка не теряется.
$crmAccepted = crm_lead_deliver('vibroplity', $__cfg, $text);
$ok = $crmAccepted;

// Personal chat — no buttons. Копия владельцу уходит всегда, независимо от CRM.
if (tg_send($TG_BOT_TOKEN, [
    'chat_id'    => $TG_CHAT_ID,
    'text'       => $text,
    'parse_mode' => 'HTML',
])) {
    $ok = true;
}

// "Лиды" group — with the "Беру" claim button. Только если CRM лид не приняла.
if (!$crmAccepted && $TG_GROUP_ID && tg_send($TG_BOT_TOKEN, [
    'chat_id'      => $TG_GROUP_ID,
    'text'         => $text,
    'parse_mode'   => 'HTML',
    'reply_markup' => [
        'inline_keyboard' => [[
            ['text' => '🙋 Беру', 'callback_data' => "take_{$leadId}"],
        ]],
    ],
])) {
    $ok = true;
}

echo json_encode(['ok' => $ok]);
