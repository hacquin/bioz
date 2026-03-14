<?php
// proxy.php - Version "Bulldozer"
// On force les paramètres pour être sûr que Withings comprenne.

// 1. CORS (Autorisations navigateur)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: *"); // On autorise tout
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

// Si c'est juste une vérification du navigateur, on dit OK et on s'arrête.
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Récupérer l'URL
$url = isset($_GET['url']) ? $_GET['url'] : '';
if (empty($url)) {
    echo json_encode(["error" => "URL manquante"]);
    exit;
}

// 3. Préparer CURL
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Debug only

// 4. HEADER AUTHORIZATION (La partie critique)
// On cherche le token partout où il pourrait se cacher
$authHeader = '';
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
} elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
} elseif (function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    if (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
    }
}

// On force les headers pour Withings
$headersToSend = [
    "Accept: application/json",
    "Content-Type: application/x-www-form-urlencoded" // On force ce format !
];
if ($authHeader) {
    $headersToSend[] = "Authorization: " . $authHeader;
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $headersToSend);

// 5. GESTION DU POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    curl_setopt($ch, CURLOPT_POST, true);
    // On lit les données brutes envoyées par React
    $input = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

// 6. Exécution
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($response === false) {
    echo json_encode(["error" => "CURL Failed: " . curl_error($ch)]);
} else {
    http_response_code($httpCode);
    echo $response;
}
curl_close($ch);
?>