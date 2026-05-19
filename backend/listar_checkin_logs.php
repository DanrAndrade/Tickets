<?php
require_once 'config/db.php';
require_once 'auth_middleware.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit();
}

if (!verifyAuth($pdo)) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Não autorizado."]);
    exit;
}

try {
    // Busca os logs reais que incluem tanto as entradas autorizadas quanto as negadas
    $stmt = $pdo->query("SELECT * FROM checkin_logs ORDER BY data_leitura DESC LIMIT 200");
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["success" => true, "data" => $logs]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Erro ao buscar logs: " . $e->getMessage()]);
}
?>
