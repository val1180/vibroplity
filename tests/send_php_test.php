<?php
/**
 * Локальный тест public/send.php без сети (crm-lead v1).
 * Запуск: tests/send_php_test.sh (Docker php:8.3-cli) или `php tests/send_php_test.php <site>`.
 *
 * Поднимает два встроенных PHP-сервера на 127.0.0.1: сайт (копия public/send.php
 * с тестовым tg_config.php) и заглушку, которая изображает CRM, Telegram Bot API
 * и decantstore. Настоящие Telegram/CRM не вызываются: все адреса — 127.0.0.1.
 */
error_reporting(E_ALL);

$site = $argv[1] ?? basename(dirname(__DIR__));
$repo = dirname(__DIR__);
$work = sys_get_temp_dir() . '/send_php_test_' . getmypid();
$siteRoot = "$work/site/public";
$mockLog  = "$work/mock.log";
$rlTmp    = "$work/tmp";
@mkdir($siteRoot, 0777, true);
@mkdir($rlTmp, 0777, true);
copy("$repo/public/send.php", "$siteRoot/send.php");

$SITE_PORT = 18090;
$MOCK_PORT = 18091;
$DEAD_PORT = 18099; // ничего не слушает — «CRM недоступна»

// ---- заглушка CRM / Telegram / decantstore ----
file_put_contents("$work/mock.php", <<<'PHP'
<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
file_put_contents(getenv('MOCK_LOG'), json_encode(['path' => $path, 'body' => file_get_contents('php://input')]) . "\n", FILE_APPEND | LOCK_EX);
header('Content-Type: application/json');
if (preg_match('~^/crm/(\w+)~', $path, $m)) {
    switch ($m[1]) {
        case 'accepted': echo '{"ok":true,"lead_id":42,"duplicate":false}'; break;
        case 'honeypot': echo '{"ok":true}'; break;
        case 'e403': http_response_code(403); echo '{"ok":false,"error":"bad secret"}'; break;
        case 'e422': http_response_code(422); echo '{"ok":false,"errors":{"phone":["required"]}}'; break;
        case 'e429': http_response_code(429); echo '{"ok":false}'; break;
        case 'e500': http_response_code(500); echo 'oops'; break;
        case 'slow': sleep(6); echo '{"ok":true,"lead_id":1}'; break;
    }
    exit;
}
echo '{"ok":true}';
PHP);

// Несколько воркеров заглушки: пока «медленная CRM» спит, Telegram-заглушка отвечает.
$env = ['MOCK_LOG' => $mockLog, 'TMPDIR' => $rlTmp, 'PATH' => getenv('PATH'), 'PHP_CLI_SERVER_WORKERS' => '4'];
$mock = proc_open(['php', '-S', "127.0.0.1:$MOCK_PORT", "$work/mock.php"], [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $p1, null, $env);
$web  = proc_open(['php', '-S', "127.0.0.1:$SITE_PORT", '-t', $siteRoot], [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', "$work/site_stderr.log", 'w']], $p2, null, $env);
usleep(600000);

$failures = 0;
function check(bool $cond, string $what): void
{
    global $failures;
    echo ($cond ? '  ok   ' : '  FAIL ') . $what . "\n";
    if (!$cond) $failures++;
}

function write_config(string $siteRoot, ?string $crmUrl, int $mockPort): void
{
    $cfg = [
        'token' => 'TEST-TOKEN',
        'chat'  => '262272891',
        'group' => '-100500',
        'tg_api' => "http://127.0.0.1:$mockPort/tg",
        'lead_register_url' => "http://127.0.0.1:$mockPort/reg",
    ];
    if ($crmUrl !== null) $cfg['crm_leads_url'] = $crmUrl;
    file_put_contents("$siteRoot/tg_config.php", '<?php return ' . var_export($cfg, true) . ';');
}

function post_lead(int $port, string $site, array $body): array
{
    $ch = curl_init("http://127.0.0.1:$port/send.php");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "Referer: https://$site.by/arenda.html?utm_source=yandex&utm_campaign=test",
            'X-Forwarded-For: 203.0.113.7',
        ],
        CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 60,
    ]);
    $t = microtime(true);
    $res = curl_exec($ch);
    return ['code' => curl_getinfo($ch, CURLINFO_HTTP_CODE), 'json' => json_decode((string) $res, true), 'raw' => $res, 'sec' => microtime(true) - $t];
}

function mock_calls(string $log): array
{
    $calls = [];
    foreach (is_file($log) ? file($log, FILE_IGNORE_NEW_LINES) : [] as $line) {
        $c = json_decode($line, true);
        $c['json'] = json_decode($c['body'], true);
        $calls[] = $c;
    }
    return $calls;
}

$text = "📩 <b>Заявка — тест</b>\nИмя: Тест Тестович\nТелефон: +375 29 111-22-33";
$cases = [
    // имя => [адрес CRM, ждём ли CRM-вызов, CRM приняла?]
    'crm-accepted'  => ["http://127.0.0.1:$MOCK_PORT/crm/accepted", true, true],
    'crm-honeypot-reply' => ["http://127.0.0.1:$MOCK_PORT/crm/honeypot", true, false],
    'crm-403'       => ["http://127.0.0.1:$MOCK_PORT/crm/e403", true, false],
    'crm-422'       => ["http://127.0.0.1:$MOCK_PORT/crm/e422", true, false],
    'crm-429'       => ["http://127.0.0.1:$MOCK_PORT/crm/e429", true, false],
    'crm-500'       => ["http://127.0.0.1:$MOCK_PORT/crm/e500", true, false],
    'crm-timeout'   => ["http://127.0.0.1:$MOCK_PORT/crm/slow", true, false],
    'crm-down'      => ["http://127.0.0.1:$DEAD_PORT/crm/x", false, false],
    'crm-not-configured' => [null, false, false],
];

echo "send.php test — $site\n";
foreach ($cases as $name => [$url, $crmCalled, $accepted]) {
    echo "[$name]\n";
    write_config($siteRoot, $url, $MOCK_PORT);
    @unlink($mockLog);
    array_map('unlink', glob("$rlTmp/*") ?: []);
    $r = post_lead($SITE_PORT, $site, ['text' => $text, 'hp' => '', 'name' => 'Тест', 'phone' => '+375291112233']);
    usleep(200000);
    $calls = mock_calls($mockLog);
    $crm   = array_values(array_filter($calls, fn($c) => str_starts_with($c['path'], '/crm/')));
    $tg    = array_values(array_filter($calls, fn($c) => str_starts_with($c['path'], '/tg/')));
    $personal = array_filter($tg, fn($c) => ($c['json']['chat_id'] ?? '') === '262272891');
    $group    = array_filter($tg, fn($c) => ($c['json']['chat_id'] ?? '') === '-100500');
    check($r['code'] === 200 && ($r['json']['ok'] ?? null) === true, "ответ 200 ok:true (HTTP {$r['code']}, {$r['raw']})");
    check(count($crm) === ($crmCalled ? 1 : 0), 'вызов CRM: ' . count($crm));
    if ($crm) {
        $j = $crm[0]['json'];
        check(($j['site'] ?? '') === $site && ($j['text'] ?? '') === $text && ($j['hp'] ?? null) === '', 'CRM: site, text, hp');
        check(($j['client_ip'] ?? '') === '203.0.113.7', 'CRM: client_ip ' . ($j['client_ip'] ?? '-'));
        check(str_starts_with($j['page'] ?? '', "https://$site.by/") && ($j['utm_source'] ?? '') === 'yandex' && ($j['utm_campaign'] ?? '') === 'test', 'CRM: page и utm из Referer');
    }
    check(count($personal) === 1, 'копия в личный чат: ' . count($personal));
    check(count($group) === ($accepted ? 0 : 1), 'группа «Лиды»: ' . count($group) . ($accepted ? ' (ждём 0 — шлёт CRM)' : ' (ждём 1 — запасной путь)'));
    if (str_contains((string) file_get_contents("$siteRoot/send.php"), 'lead_register_url')) {
        $reg = array_filter($calls, fn($c) => $c['path'] === '/reg');
        check(count($reg) === ($accepted ? 0 : 1), 'регистрация «Беру» на decantstore: ' . count($reg));
    }
    if ($name === 'crm-403' || $name === 'crm-422') {
        $log = (string) @file_get_contents("$work/site/crm_leads.log");
        check(str_contains($log, 'ошибка настройки CRM') && !str_contains($log, '/crm/'), 'ошибка настройки записана в журнал сайта (без адреса с секретом)');
        @unlink("$work/site/crm_leads.log");
    }
    if ($name === 'crm-timeout') {
        check($r['sec'] < 5.0, sprintf('таймаут CRM ≤ 3 с (весь запрос %.1f с)', $r['sec']));
    }
}

echo "[honeypot]\n";
write_config($siteRoot, "http://127.0.0.1:$MOCK_PORT/crm/honeypot", $MOCK_PORT);
@unlink($mockLog);
array_map('unlink', glob("$rlTmp/*") ?: []);
$r = post_lead($SITE_PORT, $site, ['text' => $text, 'hp' => 'http://spam.example', 'company_site' => 'http://spam.example']);
usleep(200000);
$calls = mock_calls($mockLog);
$crm = array_values(array_filter($calls, fn($c) => str_starts_with($c['path'], '/crm/')));
check($r['code'] === 200 && ($r['json']['ok'] ?? null) === true, 'ответ 200 ok:true');
check(count(array_filter($calls, fn($c) => str_starts_with($c['path'], '/tg/'))) === 0, 'в Telegram ничего');
check(count($crm) === 1 && ($crm[0]['json']['hp'] ?? '') === 'http://spam.example', 'CRM получила hp');

$stderr = (string) @file_get_contents("$work/site_stderr.log");
$fatal = preg_match('~(Fatal|Parse error|Warning|Deprecated)~', $stderr);
check(!$fatal, 'в журнале PHP нет Fatal/Warning/Deprecated');
if ($fatal) echo $stderr;

proc_terminate($web);
proc_terminate($mock);
exec('rm -rf ' . escapeshellarg($work));
echo $failures === 0 ? "ВСЁ ЗЕЛЁНОЕ ($site)\n" : "ОШИБОК: $failures ($site)\n";
exit($failures === 0 ? 0 : 1);
