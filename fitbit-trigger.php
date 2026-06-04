<?php
// fitbit-trigger.php
// Déclenche un sync manuel du daemon /opt/bioz-fitbit-sync depuis bioz.app.
// Vit à /var/www/bioz/fitbit-trigger.php sur le VPS, derrière Nginx.
// Le daemon est dans /opt/bioz-fitbit-sync (group www-data, perms 750/640) pour
// que PHP puisse l'exécuter.

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: X-Bioz-Uid, Content-Type");
header("Content-Type: application/json");

// Préflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "method_not_allowed"]);
    exit;
}

// Auth basique : seuls les UIDs Firebase autorisés peuvent déclencher.
$ALLOWED_UIDS = ['RYJ3FtIg41PocftTdEr7XDt07T73'];
$uid = $_SERVER['HTTP_X_BIOZ_UID'] ?? '';
if (!$uid || !in_array($uid, $ALLOWED_UIDS, true)) {
    http_response_code(401);
    echo json_encode(["error" => "unauthorized"]);
    exit;
}

// Lancer le sync (synchrone, prend ~5-8s)
$start = microtime(true);
$output = shell_exec('cd /opt/bioz-fitbit-sync && /usr/bin/node dist/sync.js 2>&1');
$duration = round(microtime(true) - $start, 1);

// Détection succès : la ligne "✅ Sync terminé" doit apparaître dans la sortie
$ok = $output !== null && (strpos($output, 'Sync termin') !== false);

// Extraire la ligne de récap pour un message court
$summary = '';
if ($output !== null) {
    $lines = array_filter(array_map('trim', explode("\n", $output)));
    foreach (array_reverse($lines) as $line) {
        if (preg_match('/jours upsert|Sync termin/u', $line)) {
            $summary = $line;
            break;
        }
    }
}

echo json_encode([
    "ok" => $ok,
    "duration_sec" => $duration,
    "summary" => $summary ?: 'Sync exécuté',
    "output" => $output,
]);
