<?php
// hevy-webhook.php - Version Intégrale v5
// CORRECTIONS : déduplication par ID, appel API pour données complètes, CORS, logs enrichis, limite 500

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

// Pré-flight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---- CONFIGURATION ----
$SECRET_TOKEN  = "Bearer BodycontrolSecret2026_Hevy";
$HEVY_API_KEY  = "48144f81-2e39-4977-abf1-5e4aee014426";
$dataFile      = __DIR__ . '/hevy_data.json';
$logFile       = __DIR__ . '/hevy_logs.txt';
$MAX_WORKOUTS  = 500;

// ---- FONCTION LOG ----
function writeLog($message) {
    global $logFile;
    $line = "[" . date('Y-m-d H:i:s') . "] " . $message . "\n";
    file_put_contents($logFile, $line, FILE_APPEND);
}

// ---- FONCTION : charger les données existantes ----
function loadData($dataFile) {
    if (!file_exists($dataFile)) return [];
    $raw = file_get_contents($dataFile);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ---- FONCTION : sauvegarder les données ----
function saveData($dataFile, $data) {
    file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// ---- FONCTION : récupérer le workout complet depuis l'API Hevy ----
function fetchWorkoutFromAPI($workoutId, $apiKey) {
    $url = "https://api.hevyapp.com/v1/workouts/" . urlencode($workoutId);
    $opts = [
        'http' => [
            'method'  => 'GET',
            'header'  => "api-key: " . $apiKey . "\r\naccept: application/json\r\n",
            'timeout' => 10,
        ]
    ];
    $context  = stream_context_create($opts);
    $response = @file_get_contents($url, false, $context);

    if ($response === false) {
        writeLog("ERREUR: Impossible de contacter l'API Hevy pour workout_id=" . $workoutId);
        return null;
    }

    $decoded = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        writeLog("ERREUR: Réponse API Hevy non-JSON pour workout_id=" . $workoutId);
        return null;
    }

    // L'API retourne soit { "workout": {...} } soit directement le workout
    return isset($decoded['workout']) ? $decoded['workout'] : $decoded;
}

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET : statut du webhook ----
if ($method === 'GET') {
    $current = loadData($dataFile);
    echo json_encode([
        "status"   => "online",
        "version"  => "v5",
        "writable" => is_writable(__DIR__),
        "count"    => count($current),
        "api_key_configured" => ($HEVY_API_KEY !== "VOTRE_CLE_API_HEVY_ICI")
    ]);
    exit;
}

// ---- Vérification du token d'autorisation ----
$headers = function_exists('getallheaders') ? array_change_key_case(getallheaders(), CASE_LOWER) : [];
$authHeader = $headers['authorization']
    ?? $_SERVER['HTTP_AUTHORIZATION']
    ?? '';

if ($authHeader !== $SECRET_TOKEN) {
    writeLog("REFUS 401: Authorization header invalide. Reçu: " . substr($authHeader, 0, 30));
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit;
}

// ---- Lecture du corps de la requête ----
$inputJSON = file_get_contents('php://input');
writeLog("Webhook reçu. Body brut: " . substr($inputJSON, 0, 300));

$data = json_decode($inputJSON, true);

if (json_last_error() !== JSON_ERROR_NONE || !$data) {
    writeLog("ERREUR 400: JSON invalide ou vide. Erreur: " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON"]);
    exit;
}

// ---- Extraction de l'ID du workout depuis le payload Hevy ----
// Le webhook Hevy envoie UNIQUEMENT l'ID, pas les données complètes.
// Structure typique : { "workout_id": "xxx" } ou { "id": "xxx" } ou { "payload": { "id": "xxx" } }
$workoutId = null;

if (isset($data['workout_id']))             $workoutId = $data['workout_id'];
elseif (isset($data['id']))                 $workoutId = $data['id'];
elseif (isset($data['payload']['id']))      $workoutId = $data['payload']['id'];
elseif (isset($data['payload']['workout_id'])) $workoutId = $data['payload']['workout_id'];

if (!$workoutId) {
    writeLog("ERREUR: Impossible de trouver workout_id dans le payload. Clés reçues: " . implode(', ', array_keys($data)));
    // On stocke quand même le payload brut pour analyse
    $workoutId = 'unknown_' . time();
    $workoutData = $data;
} else {
    writeLog("Workout ID extrait: " . $workoutId . " — Appel API Hevy...");
    
    // ---- Appel API Hevy pour récupérer les données complètes ----
    if ($HEVY_API_KEY !== "VOTRE_CLE_API_HEVY_ICI") {
        $workoutData = fetchWorkoutFromAPI($workoutId, $HEVY_API_KEY);
        if ($workoutData) {
            writeLog("Données complètes récupérées. Titre: " . ($workoutData['title'] ?? 'sans titre') . " / Exercices: " . count($workoutData['exercises'] ?? []));
        } else {
            writeLog("AVERTISSEMENT: Appel API échoué, stockage du payload brut.");
            $workoutData = $data;
        }
    } else {
        writeLog("AVERTISSEMENT: Clé API Hevy non configurée — stockage du payload brut uniquement.");
        $workoutData = isset($data['payload']) ? $data['payload'] : $data;
    }
}

// ---- Déduplication : on n'insère pas si l'ID existe déjà ----
$current = loadData($dataFile);
$existingIndex = -1;

foreach ($current as $idx => $w) {
    $wId = $w['id'] ?? $w['workoutId'] ?? null;
    if ($wId === $workoutId) {
        $existingIndex = $idx;
        break;
    }
}

if ($existingIndex >= 0) {
    // Mise à jour de la séance existante
    $current[$existingIndex] = $workoutData;
    writeLog("Séance mise à jour (ID: " . $workoutId . ")");
} else {
    // Nouvelle séance : on insère au début
    array_unshift($current, $workoutData);
    writeLog("Nouvelle séance ajoutée (ID: " . $workoutId . ") — Total: " . count($current));
}

// Limiter à MAX_WORKOUTS
$current = array_slice($current, 0, $MAX_WORKOUTS);

saveData($dataFile, $current);

echo json_encode(["status" => "success", "workout_id" => $workoutId, "total" => count($current)]);
?>
